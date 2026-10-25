require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const Payment = require("./models/Payment");
// Routes
const paymentRoutes = require("./routes/paymentRoutes");
const packageRoutes = require("./routes/packageRoutes");
const Job = require("./models/Job");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cookieParser = require("cookie-parser");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing.");
}

app.set("trust proxy", 1);

app.use(
    session({
        name: "witime.sid",
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

       store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "sessions",
}),

        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 14 * 24 * 60 * 60 * 1000
        }
    })
);

// Global queue for MikroTik router polling
global.pendingJobs = global.pendingJobs || [];

// --------------------------------------------------
// DATABASE CONNECTION
// --------------------------------------------------

async function connectDatabase() {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error(
            "MONGO_URI is missing from environment variables."
        );
    }

    await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000
    });

    console.log("MongoDB Connected Successfully");
}

// --------------------------------------------------
// ADMIN AUTHENTICATION ROUTES
// --------------------------------------------------

app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;

    // Make sure ADMIN_USERNAME and ADMIN_PASSWORD are in your .env file
    if (
        username === process.env.ADMIN_USERNAME &&
        password === process.env.ADMIN_PASSWORD
    ) {
        return res.json({
            success: true,
            message: "Login successful",
            token: "witime_secure_admin_session_token"
        });
    }

    return res.status(401).json({
        success: false,
        message: "Invalid username or password."
    });
});

// --------------------------------------------------
// MIKROTIK POLLING ENDPOINT
// --------------------------------------------------


app.get("/api/mikrotik/jobs", async (req, res) => {
    try {
        // Find all pending jobs
        const pendingJobs = await Job.find({ status: "pending" });

        if (!pendingJobs || pendingJobs.length === 0) {
            return res.send("");
        }

        // Extract the commands text
        const commandsToRun = pendingJobs.map(j => j.command).join("\n");

        // Mark these jobs as sent so they aren't repeated
        const jobIds = pendingJobs.map(j => j._id);
        await Job.updateMany({ _id: { $in: jobIds } }, { status: "sent" });

        console.log("🚀 Dispatching queued commands to MikroTik from MongoDB:\n" + commandsToRun);

        res.type("text/plain").send(commandsToRun);
    } catch (error) {
        console.error("MikroTik polling error:", error);
        res.status(500).send("");
    }
});

app.get("/api/check-payment/:phone", async (req, res) => {

    try {

        const phone = req.params.phone;

        const payment = await Payment.findOne({
            phone: phone
        }).sort({
            createdAt: -1
        });

        if (!payment) {

            return res.json({
                status: "NotFound"
            });

        }

        res.json({

            status: payment.status,

            phone: payment.phone,

            packageName: payment.packageName,

            amount: payment.amount,

            loginTime: payment.loginTime,

            expiryTime: payment.expiryTime

        });

    } catch (error) {

        console.error(
            "Check payment error:",
            error
        );

        res.status(500).json({

            status: "Error",

            message: "Unable to check payment."

        });

    }

});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: Date.now()
    });
});

// --------------------------------------------------
// API ROUTES
// --------------------------------------------------

// Package routes
app.use("/api/packages", packageRoutes);

// Payment routes
app.use("/api", paymentRoutes);

app.use("/api/auth", require("./routes/authRoutes"));


// --------------------------------------------------
// STATIC FRONTEND FILES
// --------------------------------------------------

app.use(
    express.static(path.join(__dirname, "public"))
);

app.get("*", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await connectDatabase();

        app.listen(PORT, () => {
            console.log(
                `WiTime Server running on port ${PORT}`
            );
        });
    } catch (err) {
        console.error(
            "WiTime startup failed:",
            err.message
        );

        process.exit(1);
    }
}

startServer();