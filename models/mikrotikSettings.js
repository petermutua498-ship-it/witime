
const mongoose = require("mongoose");

const mikrotikSettingsSchema = new mongoose.Schema(
    {
        // ======================================
        // NETWORK OWNER
        // ======================================

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: true
            
        },

        // ======================================
        // MIKROTIK CONNECTION
        // ======================================

        host: {
            type: String,
            required: true,
            trim: true
        },

        username: {
            type: String,
            required: true,
            trim: true
        },

        password: {
            type: String,
            required: true,
            select: false
        },

        port: {
            type: Number,
            default: 8728,
            min: 1,
            max: 65535
        },

        // ======================================
        // WIRELESS CONFIGURATION
        // ======================================

        hotspotSSID: {
            type: String,
            required: true,
            default: "WiTime hotspot",
            trim: true,
            maxlength: 32
        },

        wirelessInterface: {
            type: String,
            default: "wlan1",
            trim: true
        },

        // ======================================
        // HOTSPOT CONFIGURATION
        // ======================================

        hotspotInterface: {
            type: String,
            default: "bridge",
            trim: true
        },

        hotspotAddress: {
            type: String,
            default: "192.168.88.1",
            trim: true
        },

        hotspotEnabled: {
            type: Boolean,
            default: true
        },

        // ======================================
        // CUSTOMER LIMITS
        // ======================================

        maxUsers: {
            type: Number,
            default: 10,
            min: 1,
            max: 100
        },

        freeMinutes: {
            type: Number,
            default: 0,
            min: 0,
            max: 1440
        }

    },
    {
        timestamps: true
    }
);

// ======================================
// ONE MIKROTIK CONFIGURATION PER OWNER
// ======================================

mikrotikSettingsSchema.index(
     { owner: 1 },
    { unique: true }
);

// ======================================
// MODEL
// ======================================

module.exports =
    mongoose.models.MikrotikSettings ||
    mongoose.model(
        "MikrotikSettings",
        mikrotikSettingsSchema
    );
