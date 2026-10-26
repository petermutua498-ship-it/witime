
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },

    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    packageName: {
      type: String,
      required: true,
    },

    packageDuration: {
      type: String,
      default: "",
    },

    checkoutRequestID: {
      type: String,
      required: true,
      unique: true,
    },

    merchantRequestID: {
      type: String,
      default: "",
    },

    transactionId: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["pending", "Paid", "Failed"],
      default: "pending",
      index: true,
    },

    paymentDate: {
      type: Date,
      default: Date.now,
    },

    loginTime: {
      type: Date,
      default: null,
    },

    expiryTime: {
      type: Date,
      default: null,
    },

    ipAddress: {
      type: String,
      default: "",
    },

    macAddress: {
      type: String,
      default: "",
    },

    mikrotikSessionId: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

paymentSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
