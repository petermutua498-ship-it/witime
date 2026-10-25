const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
    command: { type: String, required: true },
    status: { type: String, default: "pending" }, // pending, sent
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Job", jobSchema);