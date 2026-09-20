require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Routes
const paymentRoutes = require("./routes/paymentRoutes");
const packageRoutes = require("./routes/packageRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global queue for MikroTik router polling
global.pendingJobs = global.pendingJobs || [];

// Database Connection
mongoose
    .connect(
        process.env.MONGO_URI ||
        "mongodb://127.0.0.1:27017/witime"
    )
    .then(() => {
        console.log("MongoDB Connected Successfully");
    })
    .catch((err) => {
        console.error("MongoDB Connection Error:", err);
    });

// --------------------------------------------------
// MIKROTIK POLLING ENDPOINT
// --------------------------------------------------

app.get("/api/mikrotik/jobs", (req, res) => {
    if (
        !global.pendingJobs ||
        global.pendingJobs.length === 0
    ) {
        return res.send("");
    }

    const commandsToRun = global.pendingJobs.join("\n");

    global.pendingJobs = [];

    console.log(
        "🚀 Dispatching queued commands to MikroTik:\n" +
        commandsToRun
    );

    res.type("text/plain").send(commandsToRun);
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

app.listen(PORT, () => {
    console.log(
        `WiTime Server running on port ${PORT}`
    );
});