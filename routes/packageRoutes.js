
const express = require("express");
const router = express.Router();

const Package = require("../models/Package");
const requireAccount = require("../middleware/requireAccount");

// ======================================
// HELPERS
// ======================================

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const allowedUnits = [
    "Minutes",
    "Hours",
    "Days",
    "Weeks",
    "Months"
];

const allowedStatuses = ["Active", "Inactive"];

const Account = require("../models/Account");

// PUBLIC PACKAGES FOR CUSTOMER PORTAL
router.get("/public", async (req, res) => {
    try {
        const email = process.env.ADMIN_USERNAME
            ?.trim()
            .toLowerCase();

        if (!email) {
            return res.status(500).json({
                success: false,
                message: "Network owner is not configured."
            });
        }

        const owner = await Account.findOne({
            email,
            status: "active"
        }).select("_id");

        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "WiTime network is unavailable."
            });
        }

        const packages = await Package.find({
            ownerId: owner._id,
            status: "Active"
        })
        .select("_id name price duration durationUnit")
        .sort({ price: 1 });

        return res.json(packages);

    } catch (error) {
        console.error("Public packages error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load packages."
        });
    }
});

// ======================================
// PROTECT ALL PACKAGE ROUTES
// ======================================

router.use(requireAccount);

// ======================================
// GET ALL PACKAGES FOR LOGGED-IN ACCOUNT
// Returns an ARRAY
// ======================================

router.get("/", async (req, res) => {
    try {
        const packages = await Package.find({
            ownerId: req.account._id
        }).sort({ price: 1 });

        // Important: return the array directly.
        res.json(packages);

    } catch (err) {
        console.error("Get packages error:", err);

        res.status(500).json({
            success: false,
            message: "Unable to load packages."
        });
    }
});

// ======================================
// GET ONE PACKAGE
// ======================================

router.get("/:id", async (req, res) => {
    try {
        const pkg = await Package.findOne({
            _id: req.params.id,
            ownerId: req.account._id
        });

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: "Package not found."
            });
        }

        res.json({
            success: true,
            package: pkg
        });

    } catch (err) {
        if (err.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid package ID."
            });
        }

        console.error("Get package error:", err);

        res.status(500).json({
            success: false,
            message: "Unable to load package."
        });
    }
});

// ======================================
// CREATE PACKAGE
// ======================================

router.post("/", async (req, res) => {
    try {
        const {
            name,
            price,
            duration,
            durationUnit,
            status
        } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.trim().length > 100 ||
            price === "" ||
            price === undefined ||
            price === null ||
            !Number.isFinite(Number(price)) ||
            Number(price) < 0 ||
            duration === "" ||
            duration === undefined ||
            duration === null ||
            !Number.isFinite(Number(duration)) ||
            Number(duration) < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid name, price and duration."
            });
        }

        const cleanName = name.trim();
        const unit = durationUnit || "Hours";
        const packageStatus = status || "Active";

        if (!allowedUnits.includes(unit)) {
            return res.status(400).json({
                success: false,
                message: "Invalid duration unit."
            });
        }

        if (!allowedStatuses.includes(packageStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid package status."
            });
        }

        // Check duplicate package name for this account.
        const exists = await Package.findOne({
            ownerId: req.account._id,
            name: {
                $regex: `^${escapeRegex(cleanName)}$`,
                $options: "i"
            }
        });

        if (exists) {
            return res.status(409).json({
                success: false,
                message: "You already have a package with that name."
            });
        }

        const pkg = await Package.create({
            ownerId: req.account._id,
            name: cleanName,
            price: Number(price),
            duration: Number(duration),
            durationUnit: unit,
            status: packageStatus
        });

        res.status(201).json({
            success: true,
            message: "Package created successfully.",
            package: pkg
        });

    } catch (err) {
        console.error("Create package error:", err);

        res.status(500).json({
            success: false,
            message: "Unable to create package."
        });
    }
});

// ======================================
// UPDATE PACKAGE
// ======================================

router.put("/:id", async (req, res) => {
    try {
        const {
            name,
            price,
            duration,
            durationUnit,
            status
        } = req.body;

        const updates = {};

        if (name !== undefined) {
            if (
                typeof name !== "string" ||
                !name.trim() ||
                name.trim().length > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid package name."
                });
            }

            const cleanName = name.trim();

            const duplicate = await Package.findOne({
                ownerId: req.account._id,
                _id: { $ne: req.params.id },
                name: {
                    $regex: `^${escapeRegex(cleanName)}$`,
                    $options: "i"
                }
            });

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: "Another package already uses that name."
                });
            }

            updates.name = cleanName;
        }

        if (price !== undefined) {
            if (
                price === "" ||
                !Number.isFinite(Number(price)) ||
                Number(price) < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid price."
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
                    message: "Enter a valid duration."
                });
            }

            updates.duration = Number(duration);
        }

        if (durationUnit !== undefined) {
            if (!allowedUnits.includes(durationUnit)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid duration unit."
                });
            }

            updates.durationUnit = durationUnit;
        }

        if (status !== undefined) {
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid package status."
                });
            }

            updates.status = status;
        }

        const pkg = await Package.findOneAndUpdate(
            {
                _id: req.params.id,
                ownerId: req.account._id
            },
            { $set: updates },
            {
                new: true,
                runValidators: true
            }
        );

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: "Package not found."
            });
        }

        res.json({
            success: true,
            message: "Package updated successfully.",
            package: pkg
        });

    } catch (err) {
        if (err.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid package ID."
            });
        }

        console.error("Update package error:", err);

        res.status(500).json({
            success: false,
            message: "Unable to update package."
        });
    }
});

// ======================================
// DELETE PACKAGE
// ======================================

router.delete("/:id", async (req, res) => {
    try {
        const pkg = await Package.findOneAndDelete({
            _id: req.params.id,
            ownerId: req.account._id
        });

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: "Package not found."
            });
        }

        res.json({
            success: true,
            message: "Package deleted successfully."
        });

    } catch (err) {
        if (err.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid package ID."
            });
        }

        console.error("Delete package error:", err);

        res.status(500).json({
            success: false,
            message: "Unable to delete package."
        });
    }
});

// ======================================
// TOGGLE PACKAGE STATUS
// ======================================

router.patch("/:id/status", async (req, res) => {
    try {
        const pkg = await Package.findOne({
            _id: req.params.id,
            ownerId: req.account._id
        });

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: "Package not found."
            });
        }

        pkg.status = pkg.status === "Active"
            ? "Inactive"
            : "Active";

        await pkg.save();

        res.json({
            success: true,
            message: "Package status updated.",
            status: pkg.status,
            package: pkg
        });

    } catch (err) {
        if (err.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid package ID."
            });
        }

        console.error("Toggle package status error:", err);

        res.status(500).json({
            success: false,
            message: "Unable to change package status."
        });
    }
});

module.exports = router;
