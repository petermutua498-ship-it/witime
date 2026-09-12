require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const requireAdmin = require("./middleware/adminAuth");
const User = require("./models/Users");

const packageRoutes = require("./routes/packageRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const verifyRoutes = require("./routes/verifyRoutes");
const callbackRoutes = require("./routes/callbackRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentAdminRoutes = require("./routes/paymentAdminRoutes");
const usersRoutes = require("./routes/usersRoutes");
const reportsRoutes = require("./routes/reportsRoutes");
const connectedRoutes = require("./routes/connectedRoutes");
const mikrotikRoutes = require("./routes/mikrotikRoutes");
const mikrotikSyncRoutes = require("./routes/mikrotikSyncRoutes");
const mikrotikCloudRoutes = require("./routes/mikrotikCloudRoutes");

const {
    getActiveHotspotUsers,
    routerOsTimeToSeconds
} = require("./services/mikrotikService");

const app = express();

// ======================================
// BASIC CONFIGURATION
// ======================================
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================
// REQUEST LOGGER
// ======================================
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ======================================
// SESSION MANAGEMENT
// ======================================
app.use(
    session({
        secret: process.env.SESSION_SECRET || "witime-local-secret",
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000
        }
    })
);

// ======================================
// MONGODB CONNECTION
// ======================================
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((error) => {
        console.error("❌ MongoDB connection error:", error);
    });

// ======================================
// API ROUTES
// ======================================
app.use("/api/admin", adminRoutes);
app.use("/api/packages", packageRoutes);
app.use("/", paymentRoutes);
app.use("/", verifyRoutes);
app.use("/", callbackRoutes);

app.use("/api/dashboard", requireAdmin, dashboardRoutes);
app.use("/api/payments", requireAdmin, paymentAdminRoutes);
app.use("/api/users", requireAdmin, usersRoutes);
app.use("/api/reports", requireAdmin, reportsRoutes);

app.use("/api/connected", connectedRoutes);
app.use("/api/admin/mikrotik", mikrotikRoutes);
app.use("/api/mikrotik", mikrotikSyncRoutes);
app.use("/api/mikrotik/cloud", mikrotikCloudRoutes);

// ======================================
// ADMIN PAGE PROTECTION & ROUTING
// ======================================
function requireAdminPage(req, res, next) {
    if (req.session && req.session.admin) {
        return next();
    }
    return res.redirect("/admin/login.html");
}

app.get("/admin/login.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin", "login.html"));
});

const adminPages = [
    "dashboard.html",
    "packages.html",
    "users.html",
    "user-details.html",
    "payments.html",
    "reports.html",
    "settings.html"
];

adminPages.forEach((page) => {
    app.get(`/admin/${page}`, requireAdminPage, (req, res) => {
        res.sendFile(path.join(__dirname, "public", "admin", page));
    });
});

// Render Express Backend Route
app.get("/api/get-active-users", async (req, res) => {
    try {
        // Fetch all recent paid transactions that haven't expired
        const activePaidUsers = await Payment.find({ status: "Paid" });

        // Format as lightweight response
        const userList = activePaidUsers.map(u => ({
            phone: u.phone,
            profile: u.packageProfile || "default"
        }));

        res.json({ users: userList });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================
// STATIC FILES & ROOT ROUTE
// ======================================
// Serve static assets from public
app.use(express.static(path.join(__dirname, "public")));

// Express Root Route - Explicitly handle both "/" and query parameters
app.get("/", (req, res) => {
    try {
        const indexPath = path.join(__dirname, "public", "index.html");

        if (fs.existsSync(indexPath)) {
            return res.sendFile(indexPath);
        }

        // Inline fallback HTML if public/index.html does not exist in repo
        return res.status(200).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>WiTime Hotspot Portal</title>
                <style>
                    body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; background: #f4f6f9; color: #333; }
                    .card { background: white; padding: 30px; border-radius: 12px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
                    .btn { display: inline-block; padding: 14px 28px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; border: none; cursor: pointer; font-size: 16px; width: 100%; box-sizing: border-box; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>WiTime Hotspot Portal</h2>
                    <p>Welcome to WiTime High-Speed Wi-Fi.</p>
                    <button class="btn" onclick="autoLogin()">Connect Free Wi-Fi</button>
                </div>
                <script>
                    function autoLogin() {
                        const params = new URLSearchParams(window.location.search);
                        const linkLogin = params.get('link-login-only') || 'http://192.168.88.1/login';
                        
                        const form = document.createElement('form');
                        form.method = 'POST';
                        form.action = linkLogin;

                        const user = document.createElement('input');
                        user.type = 'hidden'; user.name = 'username'; user.value = 'witime';
                        form.appendChild(user);

                        const pass = document.createElement('input');
                        pass.type = 'hidden'; pass.name = 'password'; pass.value = '';
                        form.appendChild(pass);

                        document.body.appendChild(form);
                        form.submit();
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("❌ Error in / route:", err);
        return res.status(500).send("Server Error: " + err.message);
    }
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        status: "online",
        service: "WiTime",
        time: new Date().toISOString()
    });
});

// ======================================
// INTERNAL JOB QUEUE ROUTE FOR PAYMENTS
// ======================================
app.post("/api/router/add-job", (req, res) => {
    const { phone, packageName } = req.body;

    if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
    }

    if (!global.pendingJobs) {
        global.pendingJobs = [];
    }

    const profile = packageName || "default";
    const addCmd = `/ip hotspot user add name="${phone}" password="${phone}" profile="${profile}" comment="Paid via M-Pesa"`;
    
    global.pendingJobs.push(addCmd);
    console.log(`📡 Queued MikroTik user creation command for ${phone}`);

    res.json({ success: true, queueLength: global.pendingJobs.length });
});

// ======================================
// MIKROTIK JOB QUEUE ENDPOINT (HTTP POLLING)
// ======================================
app.get("/api/router/jobs", async (req, res) => {
    const token = req.headers["x-router-token"];
    const expectedToken = process.env.ROUTER_SECRET_TOKEN || "witime123@pinchez123";

    res.setHeader("Content-Type", "text/plain");

    if (!token || token !== expectedToken) {
        console.warn(`[WiTime Router] Unauthorized polling attempt with token: ${token}`);
        return res.status(403).send("Unauthorized");
    }

    try {
        if (!global.pendingJobs) {
            global.pendingJobs = [];
        }

        if (global.pendingJobs.length > 0) {
            const commands = global.pendingJobs.join("\n");
            console.log(`[WiTime Router] Sending ${global.pendingJobs.length} command(s) to MikroTik.`);
            global.pendingJobs = [];
            return res.status(200).send(commands);
        }

        return res.status(200).send("");
    } catch (error) {
        console.error("[WiTime Router] Error serving router jobs:", error);
        return res.status(500).send("");
    }
});

// ======================================
// MIKROTIK → WITIME ACTIVE USER SYNC
// (Only triggers direct socket if MIKROTIK_HOST is explicitly set)
// ======================================
// AFTER (Updated Sync Block with Host Guard)
setInterval(async () => {
    const host = process.env.MIKROTIK_HOST;

    // 🛑 GUARD: Block direct TCP connection if database is disconnected
    // or if the server is running in the cloud with a local/unreachable IP.
    if (
        mongoose.connection.readyState !== 1 ||
        !host ||
        host === "192.168.88.1" ||
        host === "localhost" ||
        host === "127.0.0.1"
    ) {
        return;
    }

    try {
        const result = await getActiveHotspotUsers({
            host: host,
            username: process.env.MIKROTIK_USERNAME,
            password: process.env.MIKROTIK_PASSWORD,
            port: Number(process.env.MIKROTIK_PORT || 8728)
        });

        if (!result.success) {
            console.error("❌ MikroTik sync failed:", result.message);
            return;
        }

        const activeUsers = result.users || [];
        const bulkOps = activeUsers
            .map((activeUser) => {
                const phone = String(activeUser.user || "").trim();
                if (!phone) return null;

                const remainingSeconds = routerOsTimeToSeconds(activeUser.sessionTimeLeft);

                return {
                    updateOne: {
                        filter: { phone },
                        update: {
                            $set: {
                                status: "Online",
                                ipAddress: activeUser.address || "",
                                macAddress: activeUser.macAddress || "",
                                mikrotikSessionId: activeUser.id || "",
                                mikrotikTimeLeft: activeUser.sessionTimeLeft || "",
                                remainingSeconds: remainingSeconds,
                                remainingTime: activeUser.sessionTimeLeft || "0s",
                                lastSeen: new Date()
                            }
                        }
                    }
                };
            })
            .filter(Boolean);

        if (bulkOps.length > 0) {
            await User.bulkWrite(bulkOps);
            console.log(`✅ Synced ${bulkOps.length} active MikroTik user(s)`);
        }
    } catch (error) {
        console.error("❌ MikroTik → WiTime sync error:", error);
    }
}, 30 * 1000);

// ======================================
// AUTOMATIC OFFLINE CLEANUP
// ======================================
let offlineCleanupRunning = false;

setInterval(async () => {
    if (offlineCleanupRunning || mongoose.connection.readyState !== 1) {
        return;
    }

    offlineCleanupRunning = true;

    try {
        const timeout = new Date(Date.now() - 90 * 1000);
        const result = await User.updateMany(
            {
                status: "Online",
                lastSeen: { $lt: timeout }
            },
            {
                $set: {
                    status: "Offline",
                    ipAddress: "",
                    macAddress: "",
                    mikrotikSessionId: ""
                }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`🔴 ${result.modifiedCount} user(s) automatically marked Offline`);
        }
    } catch (error) {
        console.error("❌ Offline cleanup error:", error);
    } finally {
        offlineCleanupRunning = false;
    }
}, 30 * 1000);

// ======================================
// AUTOMATIC PACKAGE EXPIRY (HTTP JOB QUEUE SAFE)
// ======================================
let expiryCheckRunning = false;

setInterval(async () => {
    if (expiryCheckRunning || mongoose.connection.readyState !== 1) {
        return;
    }

    expiryCheckRunning = true;

    try {
        const now = new Date();
        const expiredUsers = await User.find({
            expiryTime: { $lte: now },
            remainingTime: { $ne: "Expired" },
            status: { $in: ["Online", "Offline"] }
        });

        if (expiredUsers.length === 0) {
            return;
        }
        

        if (!global.pendingJobs) {
            global.pendingJobs = [];
        }

        for (const user of expiredUsers) {
            // Push RouterOS disconnect commands to the HTTP polling queue
            if (user.phone) {
                global.pendingJobs.push(`/ip hotspot active remove [find user="${user.phone}"]`);
                global.pendingJobs.push(`/ip hotspot user remove [find name="${user.phone}"]`);
            }

            user.status = "Offline";
            user.remainingTime = "Expired";
            user.ipAddress = "";
            user.macAddress = "";
            user.mikrotikSessionId = "";
            user.lastSeen = null;

            await user.save();
            console.log(`⏰ Expired user processed & queued for removal: ${user.phone}`);
        }
    } catch (error) {
        console.error("❌ Package expiry checker error:", error);
    } finally {
        expiryCheckRunning = false;
    }
}, 30 * 1000);

// ======================================
// KEEP ALIVE
// ======================================
const PORT = process.env.PORT || 3000;
const SERVER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

setInterval(async () => {
    try {
        const response = await fetch(`${SERVER_URL}/api/health`);
        console.log(`🏓 Keep-alive ping: ${response.status}`);
    } catch (error) {
        console.log("⚠️ Keep-alive ping failed:", error.message);
    }
}, 10 * 60 * 1000);

// ======================================
// SERVER START
// ======================================
app.listen(PORT, () => {
    console.log(`🚀 WiTime running on port ${PORT}`);
});