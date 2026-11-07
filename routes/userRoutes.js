
const express = require("express");
const mongoose = require("mongoose");

const HotspotUser = require("../models/HotspotUser");
const Job = require("../models/Job");
const Package = require("../models/Package");
const MikrotikSettings = require("../models/mikrotikSettings");
const requireAccount = require("../middleware/requireAccount");

const router = express.Router();

router.use(requireAccount);

// Escape values before putting them inside RouterOS quoted strings.
function routerQuote(value) {
    return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// Verify that a router belongs to the logged-in account.
async function getOwnedRouter(routerId, ownerId) {
    if (!mongoose.isValidObjectId(routerId)) return null;

    return MikrotikSettings.findOne({
        _id: routerId,
        owner: ownerId,
    }).select("+password");
}

// Queue a command for the correct router.
async function queueRouterCommand(ownerId, routerId, command) {
    return Job.create({
        owner: ownerId,
        routerId,
        command,
        status: "pending",
    });
}

// GET ALL CUSTOMERS
router.get("/", async (req, res) => {
    try {
        const users = await HotspotUser.find({
            owner: req.account._id,
        })
            .sort({ createdAt: -1 })
            .populate("packageId", "name price duration durationUnit");

        res.json({
            success: true,
            users,
        });
    } catch (error) {
        console.error("Load hotspot users:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load customers.",
        });
    }
});

// GET ONE CUSTOMER
router.get("/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID.",
            });
        }

        const user = await HotspotUser.findOne({
            _id: req.params.id,
            owner: req.account._id,
        }).populate("packageId", "name price duration durationUnit");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Customer not found.",
            });
        }

        res.json({ success: true, user });
    } catch (error) {
        console.error("Get hotspot user:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load customer.",
        });
    }
});

// CREATE CUSTOMER
router.post("/", async (req, res) => {
    try {
        const {
            name,
            phone,
            username,
            password,
            routerId,
            packageId,
        } = req.body;

        if (
            typeof phone !== "string" ||
            typeof username !== "string" ||
            typeof password !== "string" ||
            !routerId
        ) {
            return res.status(400).json({
                success: false,
                message: "Phone, username, password and router are required.",
            });
        }

        const cleanPhone = phone.trim();
        const cleanUsername = username.trim();

        if (!cleanPhone || !cleanUsername || password.length < 4 || password.length > 64) {
            return res.status(400).json({
                success: false,
                message: "Check the phone, username and password.",
            });
        }

        const routerSettings = await getOwnedRouter(
            routerId,
            req.account._id
        );

        if (!routerSettings) {
            return res.status(404).json({
                success: false,
                message: "Router not found for this account.",
            });
        }

        let selectedPackage = null;

        if (packageId) {
            if (!mongoose.isValidObjectId(packageId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid package ID.",
                });
            }

            selectedPackage = await Package.findOne({
                _id: packageId,
                owner: req.account._id,
                status: "Active",
            });

            if (!selectedPackage) {
                return res.status(404).json({
                    success: false,
                    message: "Active package not found.",
                });
            }
        }

        const duplicate = await HotspotUser.findOne({
            owner: req.account._id,
            routerId,
            username: cleanUsername,
        });

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: "This username already exists on this router.",
            });
        }

        const user = await HotspotUser.create({
            owner: req.account._id,
            routerId,
            name: typeof name === "string" ? name.trim() : "",
            phone: cleanPhone,
            username: cleanUsername,
            packageId: selectedPackage?._id || null,
            packageName: selectedPackage?.name || "",
            status: "active",
            syncStatus: "pending",
        });

        const command =
            `/ip hotspot user add name=${routerQuote(cleanUsername)}` +
            ` password=${routerQuote(password)}` +
            ` comment=${routerQuote("WiTime customer " + user._id)}`;

        try {
            await queueRouterCommand(
                req.account._id,
                routerSettings._id,
                command
            );
        } catch (queueError) {
            await HotspotUser.deleteOne({
                _id: user._id,
                owner: req.account._id,
            });
            throw queueError;
        }

        res.status(201).json({
            success: true,
            message: "Customer created. Router synchronization is pending.",
            user,
        });
    } catch (error) {
        console.error("Create hotspot user:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to create customer.",
        });
    }
});

// UPDATE CUSTOMER DETAILS
router.put("/:id", async (req, res) => {
    try {
        const { name, phone, packageId } = req.body;

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID.",
            });
        }

        const user = await HotspotUser.findOne({
            _id: req.params.id,
            owner: req.account._id,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Customer not found.",
            });
        }

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim().length > 100) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid customer name.",
                });
            }
            user.name = name.trim();
        }

        if (phone !== undefined) {
            if (typeof phone !== "string" || !phone.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid phone number.",
                });
            }
            user.phone = phone.trim();
        }

        if (packageId !== undefined) {
            if (packageId === null || packageId === "") {
                user.packageId = null;
                user.packageName = "";
            } else {
                if (!mongoose.isValidObjectId(packageId)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid package ID.",
                    });
                }

                const selectedPackage = await Package.findOne({
                    _id: packageId,
                    owner: req.account._id,
                    status: "Active",
                });

                if (!selectedPackage) {
                    return res.status(404).json({
                        success: false,
                        message: "Active package not found.",
                    });
                }

                user.packageId = selectedPackage._id;
                user.packageName = selectedPackage.name;
            }
        }

        await user.save();

        res.json({
            success: true,
            message: "Customer updated successfully.",
            user,
        });
    } catch (error) {
        console.error("Update hotspot user:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to update customer.",
        });
    }
});

// ENABLE OR DISABLE CUSTOMER
router.patch("/:id/status", async (req, res) => {
    try {
        const { status } = req.body;

        if (!["active", "disabled"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be active or disabled.",
            });
        }

        const user = await HotspotUser.findOne({
            _id: req.params.id,
            owner: req.account._id,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Customer not found.",
            });
        }

        const routerSettings = await getOwnedRouter(
            user.routerId,
            req.account._id
        );

        if (!routerSettings) {
            return res.status(404).json({
                success: false,
                message: "Customer router not found.",
            });
        }

        const command = status === "disabled"
            ? `/ip hotspot user disable [find where name=${routerQuote(user.username)}]`
            : `/ip hotspot user enable [find where name=${routerQuote(user.username)}]`;

        await queueRouterCommand(
            req.account._id,
            user.routerId,
            command
        );

        user.status = status;
        user.syncStatus = "pending";
        await user.save();

        res.json({
            success: true,
            message: `Customer ${status}. Router synchronization is pending.`,
            user,
        });
    } catch (error) {
        console.error("Change hotspot user status:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to change customer status.",
        });
    }
});

// DELETE CUSTOMER
router.delete("/:id", async (req, res) => {
    try {
        const user = await HotspotUser.findOne({
            _id: req.params.id,
            owner: req.account._id,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Customer not found.",
            });
        }

        const routerSettings = await getOwnedRouter(
            user.routerId,
            req.account._id
        );

        if (!routerSettings) {
            return res.status(404).json({
                success: false,
                message: "Customer router not found.",
            });
        }

        const command =
            `/ip hotspot user remove [find where name=${routerQuote(user.username)}]`;

        await queueRouterCommand(
            req.account._id,
            user.routerId,
            command
        );

        await HotspotUser.deleteOne({
            _id: user._id,
            owner: req.account._id,
        });

        res.json({
            success: true,
            message: "Customer deletion queued for router synchronization.",
        });
    } catch (error) {
        console.error("Delete hotspot user:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to delete customer.",
        });
    }
});

// DISCONNECT ACTIVE CUSTOMER
router.post("/:id/disconnect", async (req, res) => {
    try {
        const user = await HotspotUser.findOne({
            _id: req.params.id,
            owner: req.account._id,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Customer not found.",
            });
        }

        const routerSettings = await getOwnedRouter(
            user.routerId,
            req.account._id
        );

        if (!routerSettings) {
            return res.status(404).json({
                success: false,
                message: "Customer router not found.",
            });
        }

        const command =
            `/ip hotspot active remove [find where user=${routerQuote(user.username)}]`;

        await queueRouterCommand(
            req.account._id,
            user.routerId,
            command
        );

        res.json({
            success: true,
            message: "Customer disconnection queued.",
        });
    } catch (error) {
        console.error("Disconnect hotspot user:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to disconnect customer.",
        });
    }
});

module.exports = router;
