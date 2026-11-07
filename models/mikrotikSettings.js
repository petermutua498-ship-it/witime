
const mongoose = require("mongoose");

const mikrotikSettingsSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },

    host: {
      type: String,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      required: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    port: {
      type: Number,
      default: 8728,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "MikrotikSettings",
  mikrotikSettingsSchema
);
