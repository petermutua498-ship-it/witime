
const express = require("express");
const router = express.Router();

const Package = require("../models/Package");
const requireAccount = require("../middleware/requireAccount");

// Protect every package endpoint.
router.use(requireAccount);

// GET ALL PACKAGES — only this account's packages
router.get("/", async (req, res) => {
  try {
    const packages = await Package.find({
      owner: req.account._id,
    }).sort({ price: 1 });

    res.json(packages);
  } catch (err) {
    console.error("Get packages error:", err.message);
    res.status(500).json({
      success: false,
      message: "Unable to load packages.",
    });
  }
});

// GET ONE PACKAGE — must belong to this account
router.get("/:id", async (req, res) => {
  try {
    const pkg = await Package.findOne({
      _id: req.params.id,
      owner: req.account._id,
    });

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found.",
      });
    }

    res.json({ success: true, package: pkg });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID.",
      });
    }

    console.error("Get package error:", err.message);
    res.status(500).json({
      success: false,
      message: "Unable to load package.",
    });
  }
});

// CREATE PACKAGE — assign owner on the server
router.post("/", async (req, res) => {
  try {
    const { name, price, duration, durationUnit, status } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      price === undefined ||
      price === null ||
      price === "" ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0 ||
      duration === undefined ||
      duration === null ||
      duration === "" ||
      !Number.isFinite(Number(duration)) ||
      Number(duration) < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid name, price and duration.",
      });
    }

    const cleanName = name.trim();

    const exists = await Package.findOne({
      owner: req.account._id,
      name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "You already have a package with that name.",
      });
    }

    const allowedUnits = [
      "Minutes",
      "Hours",
      "Days",
      "Weeks",
      "Months",
    ];

    if (durationUnit && !allowedUnits.includes(durationUnit)) {
      return res.status(400).json({
        success: false,
        message: "Invalid duration unit.",
      });
    }

    if (
      status !== undefined &&
      !["Active", "Inactive"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid package status.",
      });
    }

    const pkg = await Package.create({
      owner: req.account._id,
      name: cleanName,
      price: Number(price),
      duration: Number(duration),
      durationUnit: durationUnit || "Hours",
      status: status || "Active",
    });

    res.status(201).json({
      success: true,
      message: "Package added successfully.",
      package: pkg,
    });
  } catch (err) {
    console.error("Create package error:", err.message);
    res.status(500).json({
      success: false,
      message: "Unable to create package.",
    });
  }
});

// UPDATE PACKAGE — owner must match
router.put("/:id", async (req, res) => {
  try {
    const { name, price, duration, durationUnit, status } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid package name.",
        });
      }
      updates.name = name.trim();
    }

    if (price !== undefined) {
      if (
        price === "" ||
        !Number.isFinite(Number(price)) ||
        Number(price) < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid price.",
        });
      }
      updates.price = Number(price);
    }

    if (duration !== undefined) {
      if (
        duration === "" ||
        !Number.isFinite(Number(duration)) ||
        Number(duration) < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid duration.",
        });
      }
      updates.duration = Number(duration);
    }

    if (durationUnit !== undefined) {
      if (
        !["Minutes", "Hours", "Days", "Weeks", "Months"].includes(durationUnit)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid duration unit.",
        });
      }
      updates.durationUnit = durationUnit;
    }

    if (status !== undefined) {
      if (!["Active", "Inactive"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid package status.",
        });
      }
      updates.status = status;
    }

    const pkg = await Package.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: req.account._id,
      },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found.",
      });
    }

    res.json({
      success: true,
      message: "Package updated successfully.",
      package: pkg,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID.",
      });
    }

    console.error("Update package error:", err.message);
    res.status(500).json({
      success: false,
      message: "Unable to update package.",
    });
  }
});

// DELETE PACKAGE — owner must match
router.delete("/:id", async (req, res) => {
  try {
    const pkg = await Package.findOneAndDelete({
      _id: req.params.id,
      owner: req.account._id,
    });

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found.",
      });
    }

    res.json({
      success: true,
      message: "Package deleted successfully.",
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID.",
      });
    }

    console.error("Delete package error:", err.message);
    res.status(500).json({
      success: false,
      message: "Unable to delete package.",
    });
  }
});

// TOGGLE STATUS — owner must match
router.patch("/:id/status", async (req, res) => {
  try {
    const pkg = await Package.findOne({
      _id: req.params.id,
      owner: req.account._id,
    });

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found.",
      });
    }

    pkg.status = pkg.status === "Active" ? "Inactive" : "Active";
    await pkg.save();

    res.json({
      success: true,
      status: pkg.status,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID.",
      });
    }

    console.error("Toggle package status error:", err.message);
    res.status(500).json({
      success: false,
      message: "Unable to change package status.",
    });
  }
});

module.exports = router;
