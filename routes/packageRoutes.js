
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Package = require("../models/Package");
const requireAccount = require("../middleware/requireAccount");

// GET ALL PACKAGES BELONGING TO THE LOGGED-IN USER
router.get("/", requireAccount, async (req, res) => {
  try {
    const packages = await Package.find({
      ownerId: req.user.id,
    }).sort({ price: 1 });

    res.json(packages);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Unable to load packages.",
    });
  }
});

// GET ONE PACKAGE BELONGING TO THE LOGGED-IN USER
router.get("/:id", requireAccount, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID.",
      });
    }

    const pkg = await Package.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    });

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found.",
      });
    }

    res.json({ success: true, package: pkg });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Unable to load package.",
    });
  }
});

// CREATE PACKAGE
router.post("/", requireAccount, async (req, res) => {
  try {
    const { name, price, duration, durationUnit, status } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      price === undefined ||
      price === "" ||
      !Number.isFinite(Number(price)) ||
      duration === undefined ||
      duration === "" ||
      !Number.isFinite(Number(duration))
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a package name, valid price, and duration.",
      });
    }

    
const cleanName = name.trim();

const exists = await Package.findOne({
  ownerId: req.user.id,
  name: cleanName,
}).collation({ locale: "en", strength: 2 });

if (exists) {
  return res.status(409).json({
    success: false,
    message: "A package with this name already exists in your account.",
  });
}


    const pkg = await Package.create({
      ownerId: req.user.id,
      name: name.trim(),
      price: Number(price),
      duration: Number(duration),
      ...(durationUnit !== undefined && { durationUnit }),
      ...(status !== undefined && { status }),
    });

    res.status(201).json({
      success: true,
      message: "Package added successfully.",
      package: pkg,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Unable to create package. Check the values provided.",
    });
  }
});

// UPDATE ONLY YOUR OWN PACKAGE
router.put("/:id", requireAccount, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID.",
      });
    }

    const allowedFields = [
      "name",
      "price",
      "duration",
      "durationUnit",
      "status",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.name !== undefined) {
      if (typeof updates.name !== "string" || !updates.name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Package name is required.",
        });
      }

      updates.name = updates.name.trim();
    }

    

    if (updates.price !== undefined) {
      if (
        updates.price === "" ||
        !Number.isFinite(Number(updates.price)) ||
        Number(updates.price) < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid price.",
        });
      }

      updates.price = Number(updates.price);
    }

    if (updates.duration !== undefined) {
      if (
        updates.duration === "" ||
        !Number.isFinite(Number(updates.duration)) ||
        Number(updates.duration) < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Duration must be at least 1.",
        });
      }

      updates.duration = Number(updates.duration);
    }

    
if (updates.name !== undefined) {
  const exists = await Package.findOne({
    ownerId: req.user.id,
    name: updates.name,
    _id: { $ne: req.params.id },
  }).collation({ locale: "en", strength: 2 });

  if (exists) {
    return res.status(409).json({
      success: false,
      message: "Another package with this name already exists in your account.",
    });
  }
}


    const pkg = await Package.findOneAndUpdate(
      {
        _id: req.params.id,
        ownerId: req.user.id,
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
    res.status(400).json({
      success: false,
      message: "Unable to update package. Check the values provided.",
    });
  }
});

// DELETE ONLY YOUR OWN PACKAGE
router.delete("/:id", requireAccount, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID.",
      });
    }

    const pkg = await Package.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user.id,
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
    res.status(500).json({
      success: false,
      message: "Unable to delete package.",
    });
  }
});

// TOGGLE STATUS OF YOUR OWN PACKAGE
router.patch("/:id/status", requireAccount, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID.",
      });
    }

    const pkg = await Package.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
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
    res.status(500).json({
      success: false,
      message: "Unable to change package status.",
    });
  }
});

module.exports = router;
