const axios = require("axios");
const Payment = require("../models/Payment");
const mpesa = require("../services/mpesa");

exports.pay = async (req, res) => {
    try {
        const {
            phone,
            packageName,
            packagePrice,
            packageDuration
        } = req.body;

        const token = await mpesa.getAccessToken();
        console.log("Access Token:", token);

        const timestamp = new Date()
            .toISOString()
            .replace(/[-:.TZ]/g, "")
            .slice(0, 14);

        const password = Buffer.from(
            process.env.MPESA_SHORTCODE +
            process.env.MPESA_PASSKEY +
            timestamp
        ).toString("base64");

        const amount = Number(packagePrice.replace(/\D/g, ""));

        const stk = await axios.post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            {
                BusinessShortCode: process.env.MPESA_SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: 1, // Set to 'amount' when going live
                PartyA: phone,
                PartyB: process.env.MPESA_SHORTCODE,
                PhoneNumber: phone,
                CallBackURL: "https://witime-o2tz.onrender.com/callback",
                AccountReference: packageName,
                TransactionDesc: packageDuration
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        await Payment.create({
            phone,
            amount,
            packageName,
            packageDuration,
            checkoutRequestID: stk.data.CheckoutRequestID,
            merchantRequestID: stk.data.MerchantRequestID,
            status: "pending"
        });

        res.json({
            success: true
        });

    } catch (err) {
        console.error(err.response?.data || err);
        res.status(500).json({
            success: false,
            message: "Payment request failed."
        });
    }
};

exports.callback = async (req, res) => {
    try {
        const callback = req.body?.Body?.stkCallback;

        if (!callback) {
            console.log("[M-Pesa] Invalid callback format received.");
            return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        const { ResultCode, ResultDesc, CheckoutRequestID } = callback;

        console.log("[M-Pesa Callback Received]", {
            ResultCode,
            ResultDesc,
            CheckoutRequestID
        });

        const payment = await Payment.findOne({ checkoutRequestID: CheckoutRequestID });

        if (!payment) {
            console.log("[M-Pesa] Payment record not found:", CheckoutRequestID);
            return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        // 1. Evaluate Safaricom Payment Success (ResultCode === 0)
        if (ResultCode === 0) {
            // Parse duration string (e.g., "1 Hour", "24 Hours", "7 Days") into milliseconds
            let durationInMs = 3600 * 1000; // Default 1 Hour
            const durationStr = (payment.packageDuration || "").toLowerCase();

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

            // 2. Update DB Payment Status
            payment.status = "Paid";
            payment.loginTime = new Date();
            payment.expiryTime = new Date(Date.now() + durationInMs);
            await payment.save();

            // 3. Queue MikroTik Hotspot User Creation Command
            console.log(`🔵 Queuing MikroTik user creation for local router polling: ${payment.phone}`);

            if (!global.pendingJobs) {
                global.pendingJobs = [];
            }

            // Build RouterOS CLI command (Uses default profile if specific profile not defined)
            const routerCommand = `/ip hotspot user add name="${payment.phone}" password="${payment.phone}" comment="Paid_MPesa_${payment.packageName}"`;

            global.pendingJobs.push(routerCommand);

            console.log(`📡 Queued command for MikroTik: ${routerCommand}`);
        } else {
            // Payment cancelled or failed on user phone
            payment.status = "Failed";
            await payment.save();
            console.log(`🔴 Payment failed or cancelled for ${payment.phone}: ${ResultDesc}`);
        }

        // Always return 200 OK to Safaricom
        return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    } catch (error) {
        console.error("[M-Pesa Callback Error]:", error);
        return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
};