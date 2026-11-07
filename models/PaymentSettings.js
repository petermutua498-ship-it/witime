
const mongoose = require("mongoose");
const crypto = require("crypto");

const paymentSettingsSchema = new mongoose.Schema(
    {
        scope: {
            type: String,
            default: "primary",
            unique: true
        },

        paymentMethod: {
            type: String,
            enum: ["paybill", "till"],
            default: "till",
            required: true
        },

        environment: {
            type: String,
            enum: ["sandbox", "production"],
            default: "sandbox",
            required: true
        },

        // Daraja BusinessShortCode.
        businessShortCode: {
            type: String,
            required: true,
            trim: true
        },

        // Paybill number or Buy Goods Till number (PartyB).
        partyB: {
            type: String,
            required: true,
            trim: true
        },

        accountReference: {
            type: String,
            default: "WiTime",
            trim: true
        },

        callbackURL: {
            type: String,
            required: true,
            trim: true
        },

        consumerKeyEncrypted: {
            type: String,
            select: false
        },

        consumerSecretEncrypted: {
            type: String,
            select: false
        },

        passkeyEncrypted: {
            type: String,
            select: false
        }
    },
    { timestamps: true }
);

// PAYMENT SETTINGS ENCRYPTION
function getEncryptionKey() {
    const key = process.env.PAYMENT_SETTINGS_ENCRYPTION_KEY;

    if (!key) {
        throw new Error(
            "PAYMENT_SETTINGS_ENCRYPTION_KEY is missing."
        );
    }

    const decoded = Buffer.from(key, "base64");

    if (decoded.length !== 32) {
        throw new Error(
            "Payment encryption key must decode to exactly 32 bytes."
        );
    }

    return decoded;
}

paymentSettingsSchema.statics.encryptSecret = function (value) {
    if (!value) return "";

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        getEncryptionKey(),
        iv
    );

    const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    return [
        iv.toString("base64"),
        tag.toString("base64"),
        encrypted.toString("base64")
    ].join(".");
};

paymentSettingsSchema.statics.decryptSecret = function (value) {
    if (!value) return "";

    const [ivPart, tagPart, encryptedPart] = value.split(".");

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        getEncryptionKey(),
        Buffer.from(ivPart, "base64")
    );

    decipher.setAuthTag(Buffer.from(tagPart, "base64"));

    return Buffer.concat([
        decipher.update(Buffer.from(encryptedPart, "base64")),
        decipher.final()
    ]).toString("utf8");
};

module.exports = mongoose.model(
    "PaymentSettings",
    paymentSettingsSchema
);
