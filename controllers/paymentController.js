
const axios = require("axios");
const Payment = require("../models/Payment");
const Job = require("../models/Job");
const PaymentSettings = require("../models/PaymentSettings");
const mpesa = require("../services/mpesa");

// Load saved settings and decrypt credentials on the server
async function getPaymentConfig() {
    const settings = await PaymentSettings.findOne({
        scope: "primary"
    }).select(
        "+consumerKeyEncrypted +consumerSecretEncrypted +passkeyEncrypted"
    );

    if (!settings) {
        throw new Error("M-Pesa payment settings have not been configured.");
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
// INITIATE STK PUSH
// ======================================

exports.pay = async (req, res) => {
    try {
        const {
            phone,
            packageName,
            packagePrice,
            packageDuration
        } = req.body;

        if (!phone || !packageName || !packagePrice || !packageDuration) {
            return res.status(400).json({
                success: false,
                message: "Missing payment details."
            });
        }

        const config = await getPaymentConfig();

        const normalizedPhone = String(phone).replace(/\s+/g, "");

        if (!/^254\d{9}$/.test(normalizedPhone)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid phone number in 254XXXXXXXXX format."
            });
        }

        const token = await mpesa.getAccessToken(config);
        const timestamp = mpesa.getTimestamp();

        const password = Buffer.from(
            config.businessShortCode +
            config.passkey +
            timestamp
        ).toString("base64");

        // KEEPING KSH 1 FOR SANDBOX TESTING
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
                Amount: 1,
                PartyA: normalizedPhone,
                PartyB: config.partyB,
                PhoneNumber: normalizedPhone,
                CallBackURL: config.callbackURL,
                AccountReference: (
                    config.accountReference || packageName
                ).substring(0, 12),
                TransactionDesc: String(packageDuration).substring(0, 13)
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                timeout: 20000
            }
        );

        await Payment.create({
            phone: normalizedPhone,
            amount,
            packageName,
            packageDuration,
            checkoutRequestID: stk.data.CheckoutRequestID,
            merchantRequestID: stk.data.MerchantRequestID,
            status: "pending"
        });

        return res.json({
            success: true,
            message: "M-Pesa payment request sent to your phone."
        });

    } catch (error) {
        console.error(
            "[WiTime Payment Error]:",
            error.response?.data || error.message
        );

        return res.status(500).json({
            success: false,
            message: error.message || "Payment request failed."
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
            console.log("[M-Pesa] Invalid callback format.");
            return res.status(200).json({
                ResultCode: 0,
                ResultDesc: "Accepted"
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
            console.log("[M-Pesa] Payment record not found:", CheckoutRequestID);

            return res.status(200).json({
                ResultCode: 0,
                ResultDesc: "Accepted"
            });
        }

        // Prevent duplicate callbacks from creating duplicate router jobs
        if (payment.status === "Paid") {
            return res.status(200).json({
                ResultCode: 0,
                ResultDesc: "Already processed"
            });
        }

        if (ResultCode === 0) {
            // Check the amount reported by Safaricom when available
            const metadataItems = callback.CallbackMetadata?.Item || [];

            const paidAmount = metadataItems.find(
                item => item.Name === "Amount"
            )?.Value;

            if (
                paidAmount !== undefined &&
                Number(paidAmount) !== Number(payment.amount)
            ) {
                console.error("[M-Pesa] Callback amount mismatch:", {
                    expected: payment.amount,
                    received: paidAmount,
                    checkoutRequestID: CheckoutRequestID
                });

                return res.status(200).json({
                    ResultCode: 0,
                    ResultDesc: "Accepted"
                });
            }

            let durationInMs = 3600 * 1000;
            const durationStr = String(
                payment.packageDuration || ""
            ).toLowerCase();

            if (durationStr.includes("min")) {
                const mins = parseInt(durationStr) || 30;
                durationInMs = mins * 60 * 1000;
            } else if (durationStr.includes("hour")) {
                const hours = parseInt(durationStr) || 1;
                durationInMs = hours * 3600 * 1000;
            } else if (durationStr.includes("day")) {
                const days = parseInt(durationStr) || 1;
                durationInMs = days * 24 * 3600 * 1000;
            }

            payment.status = "Paid";
            payment.loginTime = new Date();
            payment.expiryTime = new Date(Date.now() + durationInMs);

            await payment.save();

            console.log(
                "[WiTime] Queuing MikroTik user:",
                payment.phone
            );

            const routerCommand =
                `/ip hotspot user add name="${payment.phone}" ` +
                `password="${payment.phone}" ` +
                `comment="Paid_MPesa_${payment.packageName}"`;

            await Job.create({
                command: routerCommand,
                status: "pending"
            });

            console.log("[WiTime] MikroTik job queued.");

        } else {
            payment.status = "Failed";
            await payment.save();

            console.log(
                "[M-Pesa] Payment failed or cancelled:",
                ResultDesc
            );
        }

        return res.status(200).json({
            ResultCode: 0,
            ResultDesc: "Accepted"
        });

    } catch (error) {
        console.error("[M-Pesa Callback Error]:", error);

        return res.status(200).json({
            ResultCode: 0,
            ResultDesc: "Accepted"
        });
    }
};
