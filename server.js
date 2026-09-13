require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const paymentRoutes = require("./routes/paymentRoutes"); // Ensure path matches your structure
const Payment = require("./models/Payment");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global pending jobs array for MikroTik polling
global.pendingJobs = global.pendingJobs || [];

// Database Connection
mongoose
    .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/witime")
    .then(() => console.log("MongoDB Connected Successfully"))
    .catch((err) => console.error("MongoDB Connection Error:", err));

// API Routes
app.use("/api", paymentRoutes);

// --------------------------------------------------
// MIKROTIK INTEGRATION ENDPOINTS
// --------------------------------------------------

// 1. Endpoint polled by MikroTik router scheduler (fetchJobs)
app.get("/api/mikrotik/jobs", (req, res) => {
    if (!global.pendingJobs || global.pendingJobs.length === 0) {
        return res.send(""); // Return empty string if no pending jobs
    }

    // Join pending CLI commands with newlines and clear the queue
    const commandsToRun = global.pendingJobs.join("\n");
    global.pendingJobs = [];

    console.log("🚀 Dispatching queued commands to MikroTik router:\n" + commandsToRun);
    res.type("text/plain").send(commandsToRun);
});

// 2. Endpoint polled by frontend JS to verify if user creation job was fetched by MikroTik
app.get("/api/user-ready/:phone", (req, res) => {
    const { phone } = req.params;

    // Check if there are still pending jobs in the queue for this phone number
    const isPending = global.pendingJobs && global.pendingJobs.some((cmd) => cmd.includes(phone));

    // If the job is no longer in pendingJobs, MikroTik has successfully fetched it
    res.json({ ready: !isPending });
});

// 3. Endpoint polled by frontend JS to check connection status and timestamps
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
// STATIC FILE SERVING
// --------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Server Initialization
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});