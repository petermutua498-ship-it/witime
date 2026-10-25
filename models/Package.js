
const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    // The account that owns this package
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    durationUnit: {
      type: String,
      enum: ["Minutes", "Hours", "Days", "Weeks", "Months"],
      default: "Hours",
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);


packageSchema.index(
  { ownerId: 1, name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    name: "unique_package_name_per_owner",
  }
);


module.exports = mongoose.model("Package", packageSchema);
