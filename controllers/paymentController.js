
const axios = require("axios");

const Account = require("../models/Account");
const Package = require("../models/Package");
const Payment = require("../models/Payment");
const Job = require("../models/Job");
const MikrotikSettings = require("../models/mikrotikSettings");
const PaymentSettings = require("../models/PaymentSettings");
const mpesa = require("../services/mpesa");

// ======================================
// FIND THE WI TIME NETWORK OWNER
// ======================================

async function getNetworkOwner() {
    const email = process.env.ADMIN_USERNAME
        ?.trim()
        .toLowerCase();

    if (!email) {
        throw new Error("Network owner is not configured.");
    }

    const owner = await Account.findOne({
        email,
        status: "active"
    });

    if (!owner) {
        throw new Error("WiTime network owner was not found.");
    }

    return owner;
}

// ======================================
// LOAD M-PESA SETTINGS
// ======================================

async function getPaymentConfig() {
    const settings = await PaymentSettings.findOne({
        scope: "primary"
    }).select(
        "+consumerKeyEncrypted +consumerSecretEncrypted +passkeyEncrypted"
    );

    if (!settings) {
        throw new Error(
            "M-Pesa payment settings have not been configured."
        );
    }

    return {
        paymentMethod: settings.paymentMethod,
        environment: settings.environment,
        businessShortCode: settings.businessShortCode,
        partyB: settings.partyB,
        accountReference: settings.accountReference,
        callbackURL: settings.callbackURL,

        consumerKey: PaymentSettings.decryptSecret(
            settings.consumerKeyEncrypted
        ),

        consumerSecret: PaymentSettings.decryptSecret(
            settings.consumerSecretEncrypted
        ),

        passkey: PaymentSettings.decryptSecret(
            settings.passkeyEncrypted
        )
    };
}

// ======================================
// CONVERT PACKAGE DURATION TO MILLISECONDS
// ======================================

function getDurationInMs(duration, unit) {
    const value = Number(duration);

    if (!Number.isFinite(value) || value < 1) {
        throw new Error("Invalid package duration.");
    }

    const units = {
        Minutes: 60 * 1000,
        Hours: 60 * 60 * 1000,
        Days: 24 * 60 * 60 * 1000,
        Weeks: 7 * 24 * 60 * 60 * 1000,
        Months: 30 * 24 * 60 * 60 * 1000
    };

    if (!units[unit]) {
        throw new Error("Unsupported package duration unit.");
    }

    return value * units[unit];
}

// ======================================
// INITIATE CUSTOMER PAYMENT
// ======================================

exports.pay = async (req, res) => {
    try {
        const { phone, packageId } = req.body;

        if (!phone || !packageId) {
            return res.status(400).json({
                success: false,
                message: "Phone number and package are required."
            });
        }

        if (!/^[a-f\d]{24}$/i.test(String(packageId))) {
            return res.status(400).json({
                success: false,
                message: "Invalid package selected."
            });
        }

        const normalizedPhone = String(phone)
            .replace(/\s+/g, "")
            .replace(/^\+/, "");

        if (!/^254[17]\d{8}$/.test(normalizedPhone)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid Kenyan phone number."
            });
        }

        // Identify this WiTime network.
        const owner = await getNetworkOwner();

        // Verify that the package belongs to this network.
        const pkg = await Package.findOne({
            _id: packageId,
            ownerId: owner._id,
            status: "Active"
        });

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: "This package is unavailable."
            });
        }

        // Make sure this network has a configured MikroTik router.
        const router = await MikrotikSettings.findOne({
            owner: owner._id
        }).select("_id");

        if (!router) {
            return res.status(409).json({
                success: false,
                message: "Your WiTime router has not been configured."
            });
        }

        // Load saved Daraja settings.
        const config = await getPaymentConfig();

        const token = await mpesa.getAccessToken(config);
        const timestamp = mpesa.getTimestamp();

        const password = Buffer.from(
            config.businessShortCode +
            config.passkey +
            timestamp
        ).toString("base64");

        // Keep KSh 1 for Sandbox testing.
        const amount = 1;

        const transactionType =
            config.paymentMethod === "till"
                ? "CustomerBuyGoodsOnline"
                : "CustomerPayBillOnline";

        const baseURL =
            config.environment === "production"
                ? "https://api.safaricom.co.ke"
                : "https://sandbox.safaricom.co.ke";

        const stk = await axios.post(
            `${baseURL}/mpesa/stkpush/v1/processrequest`,
            {
                BusinessShortCode: config.businessShortCode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: transactionType,
                Amount: amount,
                PartyA: normalizedPhone,
                PartyB: config.partyB,
                PhoneNumber: normalizedPhone,
                CallBackURL: config.callbackURL,

                AccountReference: (
                    config.accountReference || pkg.name
                ).substring(0, 12),

                TransactionDesc: (
                    `${pkg.duration} ${pkg.durationUnit}`
                ).substring(0, 13)
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                timeout: 20000
            }
        );

        if (!stk.data?.CheckoutRequestID) {
            throw new Error(
                "M-Pesa did not return a checkout request ID."
            );
        }

        // Save the actual database package and network owner.
        await Payment.create({
            ownerId: owner._id,
            packageId: pkg._id,

            phone: normalizedPhone,
            amount,

            packageName: pkg.name,
            packageDuration: `${pkg.duration} ${pkg.durationUnit}`,

            checkoutRequestID: stk.data.CheckoutRequestID,
            merchantRequestID: stk.data.MerchantRequestID || "",

            status: "pending"
        });

        return res.json({
            success: true,
            message: "M-Pesa payment request sent to your phone.",
            checkoutRequestID: stk.data.CheckoutRequestID
        });

    } catch (error) {
        console.error(
            "[WiTime Payment Error]:",
            error.response?.data || error.message
        );

        return res.status(500).json({
            success: false,
            message: error.response?.data?.errorMessage ||
                error.message ||
                "Payment request failed."
        });
    }
};

// ======================================
// CHECK A SPECIFIC PAYMENT
// ======================================

exports.checkStatus = async (req, res) => {
    try {
        const payment = await Payment.findOne({
            checkoutRequestID: req.params.checkoutRequestID
        }).select(
            "status packageName amount loginTime expiryTime"
        );

        if (!payment) {
            return res.json({
                status: "NotFound"
            });
        }

        return res.json({
            status: payment.status,
            packageName: payment.packageName,
            amount: payment.amount,
            loginTime: payment.loginTime,
            expiryTime: payment.expiryTime
        });

    } catch (error) {
        console.error(
            "[WiTime Check Payment Error]:",
            error.message
        );

        return res.status(500).json({
            status: "Error",
            message: "Unable to check payment."
        });
    }
};

// ======================================
// M-PESA CALLBACK
// ======================================

exports.callback = async (req, res) => {
    try {
        const callback = req.body?.Body?.stkCallback;

        if (!callback) {
            return res.status(400).json({
                ResultCode: 1,
                ResultDesc: "Invalid callback format."
            });
        }

        const {
            ResultCode,
            ResultDesc,
            CheckoutRequestID
        } = callback;

        console.log("[M-Pesa Callback Received]", {
            ResultCode,
            ResultDesc,
            CheckoutRequestID
        });

        const payment = await Payment.findOne({
            checkoutRequestID: CheckoutRequestID
        });

        if (!payment) {
            console.error(
                "[M-Pesa] Payment not found:",
                CheckoutRequestID
            );

            return res.status(200).json({
                ResultCode: 0,
                ResultDesc: "Accepted"
            });
        }

        // Do not process an already completed payment again.
        if (payment.status === "Paid") {
            return res.status(200).json({
                ResultCode: 0,
                ResultDesc: "Already processed"
            });
        }

        // Safaricom reports an unsuccessful transaction.
        if (Number(ResultCode) !== 0) {
            payment.status = "Failed";
            await payment.save();

            return res.status(200).json({
                ResultCode: 0,
                ResultDesc: "Payment failure recorded."
            });
        }

        const items = callback.CallbackMetadata?.Item || [];

        const paidAmount = items.find(
            item => item.Name === "Amount"
        )?.Value;

        const receiptNumber = items.find(
            item => item.Name === "MpesaReceiptNumber"
        )?.Value;

        // Require the callback amount to match the requested amount.
        if (
            paidAmount === undefined ||
            Number(paidAmount) !== Number(payment.amount)
        ) {
            console.error("[M-Pesa] Amount mismatch:", {
                expected: payment.amount,
                received: paidAmount,
                checkoutRequestID: CheckoutRequestID
            });

            return res.status(200).json({
                ResultCode: 0,
                ResultDesc: "Payment amount could not be verified."
            });
        }

        // Find the exact router belonging to this payment's owner.
        const router = await MikrotikSettings.findOne({
            owner: payment.ownerId
        }).select("_id");

        if (!router) {
            throw new Error(
                "No MikroTik router found for this payment owner."
            );
        }

        // Calculate the package expiry time.
        const durationParts = String(
            payment.packageDuration
        ).trim().split(/\s+/);

        const duration = Number(durationParts[0]);
        const unit = durationParts[1];

        const durationInMs = getDurationInMs(
            duration,
            unit
        );

        const loginTime = new Date();

        const expiryTime = new Date(
            loginTime.getTime() + durationInMs
        );

        // Build a command using the validated phone number.
        const safePhone = payment.phone;

        const safePackageName = String(
            payment.packageName
        ).replace(/[^a-zA-Z0-9_-]/g, "_");

        const routerCommand =
            `/ip hotspot user add name="${safePhone}" ` +
            `password="${safePhone}" ` +
            `comment="Paid_MPesa_${safePackageName}"`;

        // Upsert prevents duplicate jobs for the same payment.
        await Job.findOneAndUpdate(
            {
                paymentId: payment._id
            },
            {
                $setOnInsert: {
                    paymentId: payment._id,
                    owner: payment.ownerId,
                    router: router._id,
                    command: routerCommand,
                    status: "pending"
                }
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        payment.status = "Paid";
        payment.loginTime = loginTime;
        payment.expiryTime = expiryTime;
        payment.transactionId = receiptNumber || "";

        await payment.save();

        console.log(
            "[WiTime] Payment verified and router job queued:",
            payment.phone
        );

        return res.status(200).json({
            ResultCode: 0,
            ResultDesc: "Payment processed successfully."
        });

    } catch (error) {
        console.error(
            "[M-Pesa Callback Error]:",
            error
        );

        // Report internal processing errors rather than
        // falsely acknowledging successful processing.
        return res.status(500).json({
            ResultCode: 1,
            ResultDesc: "Payment processing failed. Please retry."
        });
    }
};
