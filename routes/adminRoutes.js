
const express = require("express");
const router = express.Router();

const Account = require("../models/Account");
const MikrotikSettings = require("../models/mikrotikSettings");
const PaymentSettings = require("../models/PaymentSettings");

const RouterOSClient =
    require("routeros-client").RouterOSClient;

// ======================================
// ADMIN CREDENTIALS
// ======================================

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Do not print passwords or other credentials to logs.
console.log(
    "Admin username configured:",
    !!ADMIN_USERNAME
);

console.log(
    "Admin password configured:",
    !!ADMIN_PASSWORD
);

// ======================================
// HELPER: GET NETWORK OWNER
// ======================================

async function getNetworkOwner() {
    const email = ADMIN_USERNAME?.trim().toLowerCase();

    if (!email) {
        throw new Error(
            "Network owner email is not configured."
        );
    }

    const owner = await Account.findOne({
        email,
        status: "active"
    });

    if (!owner) {
        throw new Error(
            "WiTime network owner was not found."
        );
    }

    return owner;
}

// ======================================
// HELPER: CLOSE MIKROTIK CONNECTION
// ======================================

async function closeMikrotik(client) {
    if (!client) return;

    try {
        await client.close();
    } catch (error) {
        console.log(
            "MikroTik connection close warning:",
            error.message
        );
    }
}

// ======================================
// HELPER: VALIDATE MIKROTIK SETTINGS
// ======================================

function validateMikrotikInput({
    host,
    username,
    hotspotSSID,
    maxUsers,
    freeMinutes,
    port
}) {
    if (
        typeof host !== "string" ||
        !host.trim() ||
        typeof username !== "string" ||
        !username.trim() ||
        typeof hotspotSSID !== "string" ||
        !hotspotSSID.trim()
    ) {
        return "Router IP, username and hotspot name are required.";
    }

    if (hotspotSSID.trim().length > 32) {
        return "Hotspot name cannot exceed 32 characters.";
    }

    if (
        !Number.isInteger(maxUsers) ||
        maxUsers < 1 ||
        maxUsers > 100
    ) {
        return "Maximum users must be between 1 and 100.";
    }

    if (
        !Number.isInteger(freeMinutes) ||
        freeMinutes < 0 ||
        freeMinutes > 1440
    ) {
        return "Free minutes must be between 0 and 1440.";
    }

    if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {
        return "Enter a valid MikroTik API port.";
    }

    return null;
}

// ======================================
// HELPER: ESCAPE ROUTEROS STRING
// ======================================

function escapeRouterOSString(value) {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/[\r\n]/g, " ");
}

// ======================================
// LOGIN
// POST /api/admin/login
// ======================================

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
            return res.status(500).json({
                success: false,
                message: "Administrator credentials are not configured."
            });
        }

        if (
            typeof username !== "string" ||
            typeof password !== "string" ||
            !username.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required."
            });
        }

        const validUsername =
            username.trim() === ADMIN_USERNAME.trim();

        const validPassword =
            password === ADMIN_PASSWORD;

        if (!validUsername || !validPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        // Regenerate the session to reduce session fixation risk.
        req.session.regenerate((error) => {
            if (error) {
                console.error(
                    "Session regeneration error:",
                    error.message
                );

                return res.status(500).json({
                    success: false,
                    message: "Administrator session could not be created."
                });
            }

            req.session.admin = {
                username: ADMIN_USERNAME,
                loggedIn: true
            };

            req.session.save((saveError) => {
                if (saveError) {
                    console.error(
                        "Session save error:",
                        saveError.message
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Administrator session could not be saved."
                    });
                }

                return res.json({
                    success: true,
                    message: "Login successful.",
                    admin: {
                        username: ADMIN_USERNAME
                    }
                });
            });
        });

    } catch (error) {
        console.error(
            "Admin login error:",
            error.message
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
    return res.json({
        success: true,
        admin: req.session.admin
    });
});

// ======================================
// CHECK ADMIN SESSION
// GET /api/admin/check
// ======================================

router.get("/check", (req, res) => {
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
    req.session.destroy((error) => {
        if (error) {
            console.error(
                "Logout error:",
                error.message
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
// SAVE MIKROTIK SETTINGS
// POST /api/admin/mikrotik/save
// ======================================

router.post("/mikrotik/save", async (req, res) => {
    try {
        const {
            host,
            username,
            password,
            port,
            hotspotSSID,
            maxUsers,
            freeMinutes,
            hotspotEnabled
        } = req.body;

        const parsedMaxUsers =
            Number(maxUsers ?? 10);

        const parsedFreeMinutes =
            Number(freeMinutes ?? 0);

        const parsedPort =
            port === undefined || port === ""
                ? 8728
                : Number(port);

        const validationError = validateMikrotikInput({
            host,
            username,
            hotspotSSID,
            maxUsers: parsedMaxUsers,
            freeMinutes: parsedFreeMinutes,
            port: parsedPort
        });

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        if (
            hotspotEnabled !== undefined &&
            typeof hotspotEnabled !== "boolean"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid hotspot enabled setting."
            });
        }

        const owner = await getNetworkOwner();

        const existingSettings = await MikrotikSettings
            .findOne({ owner: owner._id })
            .select("+password");

        const finalPassword =
            typeof password === "string" && password.length > 0
                ? password
                : existingSettings?.password;

        if (!finalPassword) {
            return res.status(400).json({
                success: false,
                message: "MikroTik password is required."
            });
        }

        let settings = existingSettings;

        if (!settings) {
            settings = new MikrotikSettings({
                owner: owner._id
            });
        }

        settings.host = host.trim();
        settings.username = username.trim();
        settings.password = finalPassword;
        settings.port = parsedPort;

        settings.hotspotSSID = hotspotSSID.trim();
        settings.maxUsers = parsedMaxUsers;
        settings.freeMinutes = parsedFreeMinutes;

        settings.hotspotEnabled =
            hotspotEnabled ?? settings.hotspotEnabled ?? true;

        await settings.save();

        return res.json({
            success: true,
            message: "MikroTik settings saved successfully.",
            mikrotik: {
                host: settings.host,
                username: settings.username,
                port: settings.port,
                hotspotSSID: settings.hotspotSSID,
                maxUsers: settings.maxUsers,
                freeMinutes: settings.freeMinutes,
                hotspotEnabled: settings.hotspotEnabled
            }
        });

    } catch (error) {
        console.error(
            "MikroTik settings save error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "MikroTik settings could not be saved."
        });
    }
});

// ======================================
// GET MIKROTIK SETTINGS
// GET /api/admin/mikrotik/settings
// ======================================

router.get("/mikrotik/settings", async (req, res) => {
    try {
        const owner = await getNetworkOwner();

        const settings = await MikrotikSettings.findOne({
            owner: owner._id
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
            mikrotik: {
                host: settings.host,
                username: settings.username,
                port: settings.port,
                hotspotSSID: settings.hotspotSSID,
                maxUsers: settings.maxUsers,
                freeMinutes: settings.freeMinutes,
                hotspotEnabled: settings.hotspotEnabled
            }
        });

    } catch (error) {
        console.error(
            "MikroTik settings loading error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load MikroTik settings."
        });
    }
});

// ======================================
// DISCONNECT MIKROTIK ACTIVE USER
// POST /api/admin/mikrotik/disconnect
//
// TEMPORARY DIRECT CONNECTION.
// Later, route this operation through the agent.
// ======================================

router.post("/mikrotik/disconnect", async (req, res) => {
    let client;

    try {
        const { sessionId } = req.body;

        if (
            typeof sessionId !== "string" ||
            !sessionId.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Active MikroTik session ID is required."
            });
        }

        const owner = await getNetworkOwner();

        const settings = await MikrotikSettings
            .findOne({ owner: owner._id })
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

        const activeMenu = client
            .api()
            .menu("/ip/hotspot/active");

        const users = await activeMenu.get();

        const session = users.find(
            user => user.id === sessionId
        );

        if (!session) {
            await closeMikrotik(client);
            client = null;

            return res.status(404).json({
                success: false,
                message: "MikroTik active session was not found. It may already be disconnected."
            });
        }

        await activeMenu
            .where(".id", sessionId)
            .remove();

        await closeMikrotik(client);
        client = null;

        return res.json({
            success: true,
            message: "User disconnected successfully.",
            sessionId
        });

    } catch (error) {
        console.error(
            "MikroTik disconnect error:",
            error.message
        );

        await closeMikrotik(client);

        return res.status(500).json({
            success: false,
            message: "Unable to disconnect MikroTik user: " + error.message
        });
    }
});

// ======================================
// GET M-PESA PAYMENT CONFIGURATION
// GET /api/admin/payment-settings
// ======================================

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

                consumerKeyConfigured:
                    !!settings.consumerKeyEncrypted,

                consumerSecretConfigured:
                    !!settings.consumerSecretEncrypted,

                passkeyConfigured:
                    !!settings.passkeyEncrypted
            }
        });

    } catch (error) {
        console.error(
            "Payment settings load error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load payment settings."
        });
    }
});

// ======================================
// SAVE M-PESA PAYMENT CONFIGURATION
// PUT /api/admin/payment-settings
// ======================================

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

        const partyB =
            paymentMethod === "paybill"
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

        const settings = await PaymentSettings.findOne({
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

        const updatedSettings =
            settings || new PaymentSettings({
                scope: "primary"
            });

        updatedSettings.paymentMethod = paymentMethod;
        updatedSettings.environment = environment;

        updatedSettings.businessShortCode =
            String(businessShortCode).trim();

        updatedSettings.partyB = partyB;

        updatedSettings.accountReference =
            String(accountReference || "WiTime").trim();

        updatedSettings.callbackURL =
            parsedCallback.toString();

        updatedSettings.consumerKeyEncrypted =
            nextConsumerKey;

        updatedSettings.consumerSecretEncrypted =
            nextConsumerSecret;

        updatedSettings.passkeyEncrypted =
            nextPasskey;

        await updatedSettings.save();

        return res.json({
            success: true,
            message: "M-Pesa payment configuration saved successfully."
        });

    } catch (error) {
        console.error(
            "Payment settings save error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to save payment configuration."
        });
    }
});

// ======================================
// DOWNLOAD MIKROTIK HOTSPOT CONFIGURATION
// GET /api/admin/mikrotik/download-rsc
// ======================================

router.get("/mikrotik/download-rsc", async (req, res) => {
    try {
        const owner = await getNetworkOwner();

        const settings = await MikrotikSettings.findOne({
            owner: owner._id
        });

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: "Save your MikroTik settings first."
            });
        }

        // ----------------------------------
        // READ SAVED SETTINGS
        // ----------------------------------

        const hotspotSSID = String(
            settings.hotspotSSID || "WiTime hotspot"
        ).trim();

        const maxUsers = Number(settings.maxUsers ?? 10);
        const freeMinutes = Number(settings.freeMinutes ?? 0);

        if (settings.hotspotEnabled === false) {
            return res.status(400).json({
                success: false,
                message: "Hotspot is disabled in WiTime settings."
            });
        }

        if (
            !hotspotSSID ||
            hotspotSSID.length > 32
        ) {
            return res.status(400).json({
                success: false,
                message: "The saved hotspot name is invalid."
            });
        }

        if (
            !Number.isInteger(maxUsers) ||
            maxUsers < 1 ||
            maxUsers > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Saved maximum-user setting is invalid."
            });
        }

        if (
            !Number.isInteger(freeMinutes) ||
            freeMinutes < 0 ||
            freeMinutes > 1440
        ) {
            return res.status(400).json({
                success: false,
                message: "Saved free-minutes setting is invalid."
            });
        }

        const safeSSID =
            escapeRouterOSString(hotspotSSID);

        // ----------------------------------
        // GENERATE SAFE INITIAL CONFIGURATION
        // ----------------------------------

        const rsc = [
            "# ======================================",
            "# WiTime Hotspot Configuration",
            "# Generated by WiTime",
            "# Target: Current configured MikroTik",
            "# ======================================",

            "",

            "# IMPORTANT:",
            "# Review your router configuration before importing.",
            "# This file does not change your IP address, DHCP,",
            "# bridge membership, firewall or NAT configuration.",
            "# The hotspot server remains disabled initially.",

            "",

            "# --------------------------------------",
            "# 1. Set Wi-Fi network name",
            "# --------------------------------------",

            `/interface wireless set [find default-name=wlan1] ssid="${safeSSID}"`,

            "",

            "# --------------------------------------",
            "# 2. Create WiTime hotspot profile",
            "# --------------------------------------",

            ':if ([:len [/ip hotspot profile find where name="WiTime-Profile"]] = 0) do={',
            '    /ip hotspot profile add name="WiTime-Profile" hotspot-address=192.168.88.1 login-by=http-chap,cookie',
            '}',

            "",

            "# --------------------------------------",
            "# 3. Create WiTime hotspot server",
            "# --------------------------------------",

            "# The server is created disabled.",
            "# Do not enable until the portal and payment flow",
            "# have been tested.",

            ':if ([:len [/ip hotspot find where name="WiTime-Hotspot"]] = 0) do={',
            '    /ip hotspot add name="WiTime-Hotspot" interface=bridge profile="WiTime-Profile" address-pool=none disabled=yes',
            '}',

            "",

            "# --------------------------------------",
            "# 4. Allow access to the WiTime portal",
            "# --------------------------------------",

            ':if ([:len [/ip hotspot walled-garden find where dst-host="witime.vercel.app"]] = 0) do={',
            '    /ip hotspot walled-garden add dst-host="witime.vercel.app" action=allow comment="WiTime customer portal"',
            '}',

            "",

            "# --------------------------------------",
            "# 5. WiTime application settings",
            "# --------------------------------------",

            `# Maximum simultaneous customers: ${maxUsers}`,
            `# Free access duration in minutes: ${freeMinutes}`,

            "# These settings are stored by WiTime.",
            "# The laptop agent will enforce the user limit",
            "# and free-access rules after implementation.",

            "",

            "# ======================================",
            "# END OF WITIME CONFIGURATION",
            "# Hotspot server intentionally disabled",
            "# ======================================",

            ""
        ].join("\r\n");

        // ----------------------------------
        // SEND DOWNLOAD
        // ----------------------------------

        res.setHeader(
            "Content-Type",
            "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="witime-hotspot.rsc"'
        );

        res.setHeader(
            "Cache-Control",
            "no-store"
        );

        return res.send(rsc);

    } catch (error) {
        console.error(
            "RSC generation error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Could not generate MikroTik configuration."
        });
    }
});

// ======================================
// EXPORT ROUTER
// ======================================

module.exports = router;
