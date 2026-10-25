
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const Account = require("../models/Account");
const requireAccount = require("../middleware/requireAccount");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again later.",
  },
});

function setLoginCookie(res, account) {
  const token = jwt.sign(
    { accountId: account._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("witimeToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.post("/register", authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || cleanName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid name.",
      });
    }

    if (
      cleanEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    if (password.length < 10 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must be 10–72 characters long.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured.");
    }

    const existing = await Account.findOne({ email: cleanEmail });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with that email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const account = await Account.create({
      name: cleanName,
      email: cleanEmail,
      passwordHash,
    });

    setLoginCookie(res, account);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      account: {
        id: account._id,
        name: account.name,
        email: account.email,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with that email already exists.",
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create your account.",
    });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured.");
    }

    const account = await Account.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash");

    if (
      !account ||
      !(await bcrypt.compare(password, account.passwordHash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (account.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This account is suspended.",
      });
    }

    setLoginCookie(res, account);

    return res.json({
      success: true,
      message: "Login successful.",
      account: {
        id: account._id,
        name: account.name,
        email: account.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to log in.",
    });
  }
});

router.get("/me", requireAccount, (req, res) => {
  res.json({
    success: true,
    account: {
      id: req.account._id,
      name: req.account.name,
      email: req.account.email,
    },
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie("witimeToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  res.json({
    success: true,
    message: "Logged out successfully.",
  });
});

module.exports = router;
