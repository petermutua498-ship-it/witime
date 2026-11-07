const express = require("express");

const router = express.Router();

const MikrotikSettings =
    require("../models/mikrotikSettings");

const RouterOSClient =
    require("routeros-client").RouterOSClient;

const PaymentSettings = require("../models/PaymentSettings");

// ======================================
// ADMIN CREDENTIALS
// ======================================

const ADMIN_USERNAME =
    process.env.ADMIN_USERNAME 

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD

console.log("Admin username loaded:", ADMIN_USERNAME);
console.log(
    "Admin password configured:",
    !!process.env.ADMIN_PASSWORD
);

// ======================================
// LOGIN
// POST /api/admin/login
// ======================================

router.post("/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        console.log("Admin login attempt:", username);

        if (!username || !password) {

            return res.status(400).json({
                success: false,
                message: "Username and password are required."
            });

        }

        if (
            username !== ADMIN_USERNAME ||
            password !== ADMIN_PASSWORD
        ) {

            console.log("❌ Invalid admin credentials");

            return res.status(401).json({
                success: false,
                message: "Invalid username or password."
            });

        }

       req.session.admin = {
    username: ADMIN_USERNAME,
    loggedIn: true
};

        // VERY IMPORTANT:
        // Explicitly save the session before responding.

        req.session.save((error) => {

            if (error) {

                console.error(
                    "❌ Session save error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: "Administrator session could not be created."
                });

            }

            console.log(
                "✅ Administrator session created:",
                req.sessionID
            );

            return res.json({

                success: true,

                message: "Login successful.",

                admin: {
                    username: ADMIN_USERNAME
                }

            });

        });

    } catch (error) {

        console.error(
            "Admin login error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Login failed."
        });

    }

});

// ======================================
// PROTECT ADMIN ROUTES
// ======================================

router.use((req, res, next) => {

    if (!req.session?.admin?.loggedIn) {
        return res.status(401).json({
            success: false,
            message: "Administrator login required."
        });
    }

    next();
});

// ======================================
// CURRENT ADMIN
// GET /api/admin/me
// ======================================

router.get("/me", (req, res) => {

    console.log(
        "Checking admin session:",
        req.sessionID
    );

    if (!req.session || !req.session.admin) {

        return res.status(401).json({
            success: false,
            message: "Not authenticated."
        });

    }

    console.log(
        "Admin session:",
        req.session.admin
    );

    return res.json({
        success: true,
        admin: req.session.admin
    });

});
// ======================================
// CHECK
// GET /api/admin/check
// ======================================

router.get("/check", (req, res) => {

    if (!req.session.admin) {

        return res.status(401).json({
            success: false,
            authenticated: false
        });

    }

    return res.json({
        success: true,
        authenticated: true,
        admin: req.session.admin
    });

});

// ======================================
// LOGOUT
// POST /api/admin/logout
// ======================================

router.post("/logout", (req, res) => {

    console.log(
        "Logging out session:",
        req.sessionID
    );

    req.session.destroy((error) => {

        if (error) {

            console.error(
                "Logout error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to logout."
            });

        }

        res.clearCookie("witime.sid", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        });

        return res.json({
            success: true,
            message: "Logged out successfully."
        });

    });

});

// ======================================
// TEST MIKROTIK CONNECTION
// POST /api/admin/mikrotik/test
// ======================================

router.post("/mikrotik/test", async (req, res) => {

    let client;

    try {

        const {
            host,
            username,
            password,
            port
        } = req.body;

        console.log("MikroTik test requested:", {
            host,
            username,
            passwordEntered: !!password,
            port
        });


        // ----------------------------------
        // Get saved settings if password
        // wasn't supplied
        // ----------------------------------

        let savedSettings = null;

        if (!password) {

            savedSettings =
                await MikrotikSettings
                    .findOne()
                    .select("+password");

        }


        const finalHost =
            host ||
            savedSettings?.host;

        const finalUsername =
            username ||
            savedSettings?.username;

        const finalPassword =
            password ||
            savedSettings?.password;

        const finalPort =
            Number(port) ||
            savedSettings?.port ||
            8728;


        if (
            !finalHost ||
            !finalUsername ||
            !finalPassword
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "MikroTik host, username and password are required."
            });

        }


        // ----------------------------------
        // Connect to MikroTik
        // ----------------------------------

        client = new RouterOSClient({

            host: finalHost,

            user: finalUsername,

            password: finalPassword,

            port: finalPort,

            timeout: 8000

        });


        await client.connect();


        console.log(
            "✅ MikroTik connection successful:",
            finalHost
        );


        // ----------------------------------
        // Close test connection
        // ----------------------------------

        try {

            await client.close();

        } catch (closeError) {

            console.log(
                "MikroTik close warning:",
                closeError.message
            );

        }


        return res.json({

            success: true,

            message:
                "MikroTik connection successful.",

            mikrotik: {
                host: finalHost,
                username: finalUsername,
                port: finalPort
            }

        });


    } catch (error) {

        console.error(
            "❌ MikroTik connection failed:",
            error.message
        );


        if (client) {

            try {
                await client.close();
            } catch (_) {}

        }


        return res.status(500).json({

            success: false,

            message:
                "MikroTik connection failed: " +
                error.message

        });

    }

});

// ======================================
// SAVE MIKROTIK SETTINGS
// POST /api/admin/mikrotik/save
// ======================================

router.post("/mikrotik/save", async (req, res) => {

    let client;

    try {

        const {
            host,
            username,
            password,
            port
        } = req.body;


        if (!host || !username) {

            return res.status(400).json({

                success: false,

                message:
                    "Router IP and username are required."

            });

        }


        // ----------------------------------
        // Get existing password if user
        // didn't enter a new one
        // ----------------------------------

        let existingSettings = null;

        if (!password) {

            existingSettings =
                await MikrotikSettings
                    .findOne()
                    .select("+password");

        }


        const finalPassword =
            password ||
            existingSettings?.password;


        if (!finalPassword) {

            return res.status(400).json({

                success: false,

                message:
                    "MikroTik password is required."

            });

        }


        const finalPort =
            Number(port) || 8728;


        // ----------------------------------
        // TEST BEFORE SAVING
        // ----------------------------------

        client = new RouterOSClient({

            host,

            user: username,

            password: finalPassword,

            port: finalPort,

            timeout: 8000

        });


        await client.connect();


        console.log(
            "✅ MikroTik credentials verified."
        );


        // ----------------------------------
        // Close connection
        // ----------------------------------

        try {

            await client.close();

        } catch (_) {}


        client = null;


        // ----------------------------------
        // Save to MongoDB
        // ----------------------------------

        let settings =
            await MikrotikSettings.findOne();


        if (settings) {

            settings.host =
                host;

            settings.username =
                username;

            settings.password =
                finalPassword;

            settings.port =
                finalPort;

            await settings.save();

        } else {

            settings =
                await MikrotikSettings.create({

                    host,

                    username,

                    password:
                        finalPassword,

                    port:
                        finalPort

                });

        }


        console.log(
            "✅ MikroTik settings saved."
        );


        return res.json({

            success: true,

            message:
                "MikroTik settings saved successfully.",

            mikrotik: {

                host,

                username,

                port:
                    finalPort

            }

        });


    } catch (error) {

        console.error(
            "❌ MikroTik save error:",
            error.message
        );


        if (client) {

            try {
                await client.close();
            } catch (_) {}

        }


        return res.status(500).json({

            success: false,

            message:
                "MikroTik settings could not be saved: " +
                error.message

        });

    }

});

// ======================================
// GET MIKROTIK SETTINGS
// GET /api/admin/mikrotik/settings
// ======================================

router.get("/mikrotik/settings", async (req, res) => {

    try {

        const settings =
            await MikrotikSettings.findOne();


        if (!settings) {

            return res.json({

                success: true,

                configured: false

            });

        }


        return res.json({

            success: true,

            configured: true,

            mikrotik: {

                host:
                    settings.host,

                username:
                    settings.username,

                port:
                    settings.port

            }

        });

    } catch (error) {

        console.error(
            "MikroTik settings loading error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to load MikroTik settings."

        });

    }

});

// ======================================
// GET ACTIVE MIKROTIK HOTSPOT USERS
// ======================================

router.get("/mikrotik/active-users", async (req, res) => {

    let client;

    try {

        const settings =
            await MikrotikSettings
                .findOne()
                .select("+password");

        if (!settings) {

            return res.status(400).json({
                success: false,
                message: "MikroTik is not configured."
            });

        }

        client = new RouterOSClient({

            host: settings.host,
            user: settings.username,
            password: settings.password,
            port: settings.port || 8728,
            timeout: 8000

        });

        await client.connect();

        console.log(
            "✅ Connected to MikroTik for active users."
        );

        // Get all active hotspot sessions
        const users =
            await client
                .api()
                .menu("/ip/hotspot/active")
                .getAll();

        console.log(
            "MikroTik active users:",
            users
        );

        try {
            await client.close();
        } catch (_) {}

        client = null;

        return res.json({

            success: true,

            count: users.length,

            users: users

        });

    } catch (error) {

        console.error(
    "❌ Unable to get MikroTik active users:",
    error
);

console.error(
    "Error name:",
    error?.name
);

console.error(
    "Error message:",
    error?.message
);

console.error(
    "Error stack:",
    error?.stack
);

        if (client) {

            try {
                await client.close();
            } catch (_) {}
        }

        return res.status(500).json({

            success: false,

            message:
                "Unable to get active MikroTik users: " +
                error.message

        });

    }

});

// ======================================
// DISCONNECT MIKROTIK ACTIVE USER
// POST /api/admin/mikrotik/disconnect
// ======================================

router.post("/mikrotik/disconnect", async (req, res) => {

    let client;

    try {

        const { sessionId } = req.body;

        if (!sessionId) {

            return res.status(400).json({
                success: false,
                message: "Active MikroTik session ID is required."
            });

        }

        console.log(
            "Disconnect request for session:",
            sessionId
        );

        // ----------------------------------
        // Load saved MikroTik settings
        // ----------------------------------

        const settings =
            await MikrotikSettings
                .findOne()
                .select("+password");

        if (!settings) {

            return res.status(400).json({
                success: false,
                message: "MikroTik is not configured."
            });

        }

        // ----------------------------------
        // Connect to MikroTik
        // ----------------------------------

        client = new RouterOSClient({

            host: settings.host,
            user: settings.username,
            password: settings.password,
            port: settings.port || 8728,
            timeout: 8000

        });

        // ----------------------------------
        // Prevent unhandled RouterOS errors
        // ----------------------------------

        client.on("error", (error) => {

            console.error(
                "MikroTik client error:",
                error.message
            );

        });

        await client.connect();

        console.log(
            "✅ Connected to MikroTik for disconnect."
        );

        // ----------------------------------
        // Find active session
        // ----------------------------------

        const activeMenu =
            client
                .api()
                .menu("/ip/hotspot/active");

        const users =
            await activeMenu.get();

        console.log(
            "Active sessions:",
            users
        );

        const session =
            users.find(
                user => user.id === sessionId
            );

        if (!session) {

            try {
                await client.close();
            } catch (_) {}

            client = null;

            return res.status(404).json({

                success: false,

                message:
                    "MikroTik active session was not found. It may already be disconnected."

            });

        }

        console.log(
            "Disconnecting MikroTik session:",
            session
        );

        // ----------------------------------
        // Remove active session
        // ----------------------------------

        await activeMenu
            .where(".id", sessionId)
            .remove();

        console.log(
            "✅ MikroTik session disconnected:",
            sessionId
        );

        // ----------------------------------
        // Close connection
        // ----------------------------------

        try {
            await client.close();
        } catch (closeError) {

            console.log(
                "MikroTik close warning:",
                closeError.message
            );

        }

        client = null;

        return res.json({

            success: true,

            message:
                "User disconnected successfully.",

            sessionId

        });

    } catch (error) {

        console.error(
            "❌ MikroTik disconnect error:",
            error
        );

        if (client) {

            try {
                await client.close();
            } catch (_) {}

        }

        return res.status(500).json({

            success: false,

            message:
                "Unable to disconnect MikroTik user: " +
                error.message

        });

    }

});


// ======================================
// M-PESA PAYMENT CONFIGURATION
// ======================================

// GET /api/admin/payment-settings
router.get("/payment-settings", async (req, res) => {
    try {
        const settings = await PaymentSettings.findOne({
            scope: "primary"
        });

        if (!settings) {
            return res.json({
                success: true,
                configured: false
            });
        }

        return res.json({
            success: true,
            configured: true,
            payment: {
                paymentMethod: settings.paymentMethod,
                environment: settings.environment,
                businessShortCode: settings.businessShortCode,
                partyB: settings.partyB,
                accountReference: settings.accountReference,
                callbackURL: settings.callbackURL,
                consumerKeyConfigured: !!settings.consumerKeyEncrypted,
                consumerSecretConfigured: !!settings.consumerSecretEncrypted,
                passkeyConfigured: !!settings.passkeyEncrypted
            }
        });
    } catch (error) {
        console.error("Payment settings load error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to load payment settings."
        });
    }
});


// PUT /api/admin/payment-settings
router.put("/payment-settings", async (req, res) => {
    try {
        const {
            paymentMethod,
            environment,
            businessShortCode,
            tillNumber,
            accountReference,
            callbackURL,
            consumerKey,
            consumerSecret,
            passkey
        } = req.body;

        if (!["paybill", "till"].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Choose Paybill or Till."
            });
        }

        if (!["sandbox", "production"].includes(environment)) {
            return res.status(400).json({
                success: false,
                message: "Choose Sandbox or Production."
            });
        }

        if (!businessShortCode || !callbackURL) {
            return res.status(400).json({
                success: false,
                message: "Business shortcode and callback URL are required."
            });
        }

        // Paybill uses its shortcode as PartyB.
        // Buy Goods uses the actual Till number as PartyB.
        const partyB = paymentMethod === "paybill"
            ? String(businessShortCode).trim()
            : String(tillNumber || "").trim();

        if (!partyB) {
            return res.status(400).json({
                success: false,
                message: "Till number is required for Buy Goods."
            });
        }

        let parsedCallback;

        try {
            parsedCallback = new URL(callbackURL);
        } catch {
            return res.status(400).json({
                success: false,
                message: "Enter a valid callback URL."
            });
        }

        if (
            environment === "production" &&
            parsedCallback.protocol !== "https:"
        ) {
            return res.status(400).json({
                success: false,
                message: "Production callback URL must use HTTPS."
            });
        }

        let settings = await PaymentSettings.findOne({
            scope: "primary"
        }).select(
            "+consumerKeyEncrypted +consumerSecretEncrypted +passkeyEncrypted"
        );

        const encrypt = PaymentSettings.encryptSecret;

        const nextConsumerKey = consumerKey?.trim()
            ? encrypt(consumerKey.trim())
            : settings?.consumerKeyEncrypted;

        const nextConsumerSecret = consumerSecret?.trim()
            ? encrypt(consumerSecret.trim())
            : settings?.consumerSecretEncrypted;

        const nextPasskey = passkey?.trim()
            ? encrypt(passkey.trim())
            : settings?.passkeyEncrypted;

        if (
            !nextConsumerKey ||
            !nextConsumerSecret ||
            !nextPasskey
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter the Consumer Key, Consumer Secret and Passkey."
            });
        }

        if (!settings) {
            settings = new PaymentSettings({
                scope: "primary"
            });
        }

        settings.paymentMethod = paymentMethod;
        settings.environment = environment;
        settings.businessShortCode = String(businessShortCode).trim();
        settings.partyB = partyB;
        settings.accountReference =
            String(accountReference || "WiTime").trim();
        settings.callbackURL = parsedCallback.toString();

        settings.consumerKeyEncrypted = nextConsumerKey;
        settings.consumerSecretEncrypted = nextConsumerSecret;
        settings.passkeyEncrypted = nextPasskey;

        await settings.save();

        return res.json({
            success: true,
            message: "M-Pesa payment configuration saved successfully."
        });

    } catch (error) {
        console.error("Payment settings save error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to save payment configuration."
        });
    }
});


module.exports = router;