
const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },

    router: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MikrotikSettings",
      required: true,
      index: true,
    },

    paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payment",
    unique: true,
    sparse: true,
},

    command: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "sent", "completed", "failed"],
      default: "pending",
      index: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model("Job", jobSchema);
