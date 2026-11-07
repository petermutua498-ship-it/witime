
const mongoose = require("mongoose");

const hotspotUserSchema = new mongoose.Schema(
  {
    // WiTime account that owns this customer
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },

    // MikroTik router assigned to this customer
    routerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MikrotikSettings",
      required: true,
      index: true,
    },

    // Wi-Fi customer details
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional package association
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      default: null,
    },

    packageName: {
      type: String,
      default: "",
    },

    // Customer account status
    status: {
      type: String,
      enum: ["active", "disabled", "expired"],
      default: "active",
      index: true,
    },

    // MikroTik synchronization status
    syncStatus: {
      type: String,
      enum: ["pending", "synced", "failed"],
      default: "pending",
    },

    // Active connection information
    connectionStatus: {
      type: String,
      enum: ["online", "offline", "unknown"],
      default: "unknown",
    },

    // Subscription dates
    loginTime: {
      type: Date,
      default: null,
    },

    expiryTime: {
      type: Date,
      default: null,
    },

    // MikroTik internal user ID, when available
    mikrotikUserId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// A username must be unique on a particular router
hotspotUserSchema.index(
  { owner: 1, routerId: 1, username: 1 },
  { unique: true }
);

// Useful for account-specific customer searches
hotspotUserSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model("HotspotUser", hotspotUserSchema);
