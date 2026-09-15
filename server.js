require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const paymentRoutes = require("./routes/paymentRoutes"); // Ensure path matches your project structure
const Payment = require("./models/Payment");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global pending jobs queue for MikroTik router polling
global.pendingJobs = global.pendingJobs || [];

// Database Connection
mongoose
    .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/witime")
    .then(() => console.log("MongoDB Connected Successfully"))
    .catch((err) => console.error("MongoDB Connection Error:", err));

// --------------------------------------------------
// 1. PACKAGES ENDPOINT (Fixes "Unable to load packages")
// --------------------------------------------------
app.get("/api/packages", (req, res) => {
    // Serves the pricing options loaded by index.html / script.js
    const packages = [
        { id: "1", name: "30 Mins", price: "Ksh 10", duration: "30 Mins" },
        { id: "2", name: "1 Hour", price: "Ksh 20", duration: "1 Hour" },
        { id: "3", name: "24 Hours", price: "Ksh 50", duration: "24 Hours" }
    ];

    res.json({ success: true, packages });
});

// --------------------------------------------------
// 2. MIKROTIK POLLING & SYNC ENDPOINTS
// --------------------------------------------------

// Polled by MikroTik router scheduler (fetchJobs) to grab pending CLI commands
app.get("/api/mikrotik/jobs", (req, res) => {
    if (!global.pendingJobs || global.pendingJobs.length === 0) {
        return res.send("");
    }

    const commandsToRun = global.pendingJobs.join("\n");
    global.pendingJobs = [];

    console.log("🚀 Dispatching queued commands to MikroTik:\n" + commandsToRun);
    res.type("text/plain").send(commandsToRun);
});

// Polled by frontend JS to verify if MikroTik has fetched the user creation command
app.get("/api/user-ready/:phone", (req, res) => {
    const { phone } = req.params;
    const isPending = global.pendingJobs && global.pendingJobs.some((cmd) => cmd.includes(phone));

    // Returns ready: true once MikroTik has polled and cleared the pending job
    res.json({ ready: !isPending });
});

// Polled by frontend JS to check connection status and timestamps
app.get("/api/connected/:phone", async (req, res) => {
    try {
        const { phone } = req.params;
        const payment = await Payment.findOne({ phone }).sort({ createdAt: -1 });

        if (!payment) {
            return res.status(404).json({ status: "NotFound" });
        }

        res.json({
            status: payment.status,
            loginTime: payment.loginTime,
            expiryTime: payment.expiryTime,
            packageName: payment.packageName
        });
    } catch (error) {
        console.error("Error fetching connection status:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Health check endpoint for network testing
app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: Date.now() });
});

// --------------------------------------------------
// 3. MOUNT PAYMENT ROUTES & STATIC FILES
// --------------------------------------------------
app.use("/api", paymentRoutes);

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`WiTime Server running on port ${PORT}`);
});