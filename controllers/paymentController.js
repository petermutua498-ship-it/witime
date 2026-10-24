
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

        // Validate required fields
        if (!phone || !packageName || !packagePrice || !packageDuration) {
            return res.status(400).json({
                success: false,
                message: "Phone and package details are required."
            });
        }

        // Normalize Kenyan phone numbers
        let normalizedPhone = String(phone).replace(/\D/g, "");

        if (normalizedPhone.startsWith("0")) {
            normalizedPhone = "254" + normalizedPhone.slice(1);
        } else if (normalizedPhone.startsWith("7") ||
                   normalizedPhone.startsWith("1")) {
            normalizedPhone = "254" + normalizedPhone;
        }

        if (!/^254[17]\d{8}$/.test(normalizedPhone)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid Kenyan mobile number."
            });
        }

        const amount = Number(
            String(packagePrice).replace(/[^\d.]/g, "")
        );

        if (!Number.isFinite(amount) || amount < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid package price."
            });
        }

        const shortcode = process.env.MPESA_SHORTCODE;
        const passkey = process.env.MPESA_PASSKEY;

        if (!shortcode || !passkey) {
            throw new Error("M-Pesa shortcode or passkey is missing.");
        }

        const token = await mpesa.getAccessToken();

        // Safaricom STK timestamp uses East Africa local time
        const timestamp = mpesa.getTimestamp
            ? mpesa.getTimestamp()
            : new Intl.DateTimeFormat("en-GB", {
                timeZone: "Africa/Nairobi",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hourCycle: "h23"
            }).formatToParts(new Date())
              .reduce((result, part) => {
                  if (part.type !== "literal") {
                      result[part.type] = part.value;
                  }
                  return result;
              }, {});

        const formattedTimestamp =
            typeof timestamp === "string"
                ? timestamp
                : timestamp.year +
                  timestamp.month +
                  timestamp.day +
                  timestamp.hour +
                  timestamp.minute +
                  timestamp.second;

        const password = Buffer.from(
            shortcode + passkey + formattedTimestamp
        ).toString("base64");

        // Sandbox test amount: KSh 1.
        // Change to amount only when the Daraja configuration
        // and package-price validation are ready for live payments.
        const stkAmount = process.env.MPESA_ENV === "production"
            ? Math.round(amount)
            : 1;

        const baseUrl = process.env.MPESA_ENV === "production"
            ? "https://api.safaricom.co.ke"
            : "https://sandbox.safaricom.co.ke";

        const callbackUrl = process.env.MPESA_CALLBACK_URL;

        if (!callbackUrl || !callbackUrl.startsWith("https://")) {
            throw new Error(
                "Set MPESA_CALLBACK_URL to your public HTTPS callback endpoint."
            );
        }

        const stk = await axios.post(
            `${baseUrl}/mpesa/stkpush/v1/processrequest`,
            {
                BusinessShortCode: shortcode,
                Password: password,
                Timestamp: formattedTimestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: stkAmount,
                PartyA: normalizedPhone,
                PartyB: shortcode,
                PhoneNumber: normalizedPhone,
                CallBackURL: callbackUrl,
                AccountReference: "WiTime Internet",
                TransactionDesc: packageName || "WiTime Hotspot"
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                timeout: 20000
            }
        );

        if (stk.data?.ResponseCode !== "0") {
            console.error("[WiTime STK rejected]", {
                responseCode: stk.data?.ResponseCode,
                responseDescription: stk.data?.ResponseDescription
            });

            return res.status(502).json({
                success: false,
                message: stk.data?.ResponseDescription ||
                    "Safaricom did not accept the STK request."
            });
        }

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
            message: "STK request sent. Check your phone.",
            checkoutRequestID: stk.data.CheckoutRequestID
        });

    } catch (error) {
        console.error("[WiTime payment request error]", {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });

        return res.status(500).json({
            success: false,
            message: error.response?.data?.errorMessage ||
                error.response?.data?.ResponseDescription ||
                error.message ||
                "Payment request failed."
        });
    }
};

exports.callback = async (req, res) => {
    try {
        const callback = req.body?.Body?.stkCallback;

        if (!callback) {
            console.error("[WiTime] Invalid M-Pesa callback.");
            return res.status(400).json({
                ResultCode: 1,
                ResultDesc: "Invalid callback."
            });
        }

        const {
            ResultCode,
            ResultDesc,
            CheckoutRequestID,
            CallbackMetadata
        } = callback;

        const payment = await Payment.findOne({
            checkoutRequestID: CheckoutRequestID
        });

        if (!payment) {
            console.error(
                "[WiTime] Payment record not found:",
                CheckoutRequestID
            );

            return res.status(200).json({
                ResultCode: 0,
                ResultDesc: "Accepted"
            });
        }

        // Prevent duplicate callback processing
        if (payment.status === "Paid") {
            return res.status(200).json({
                ResultCode: 0,
                ResultDesc: "Already processed"
            });
        }

        if (ResultCode === 0) {
            const metadata = CallbackMetadata?.Item || [];

            const getMetadataValue = (name) =>
                metadata.find((item) => item.Name === name)?.Value;

            const receiptNumber = getMetadataValue("MpesaReceiptNumber");
            const paidAmount = Number(getMetadataValue("Amount"));
            const paidPhone = String(getMetadataValue("PhoneNumber") || "");

            // Do not activate access without essential payment details
            if (!receiptNumber || !Number.isFinite(paidAmount) ||
                paidAmount <= 0 || paidPhone !== payment.phone.replace(/\D/g, "")) {
                console.error(
                    "[WiTime] Callback metadata validation failed:",
                    CheckoutRequestID
                );

                return res.status(200).json({
                    ResultCode: 0,
                    ResultDesc: "Accepted for review"
                });
            }

            // In sandbox, the STK request intentionally charges KSh 1.
            // Store the actual amount reported by Safaricom.
            payment.status = "Paid";
            payment.amount = paidAmount;
            payment.mpesaReceiptNumber = receiptNumber;
            payment.loginTime = new Date();
            payment.expiryTime = null;

            await payment.save();

            console.log(
                "[WiTime] Payment confirmed:",
                receiptNumber,
                payment.phone
            );

            // Router activation is deliberately not queued here yet.
            // First ensure the M-Pesa callback is verified and idempotent.
        } else {
            payment.status = "Failed";
            await payment.save();

            console.log(
                "[WiTime] Payment failed:",
                ResultDesc,
                CheckoutRequestID
            );
        }

        return res.status(200).json({
            ResultCode: 0,
            ResultDesc: "Accepted"
        });

    } catch (error) {
        console.error("[WiTime callback processing error]", error);

        return res.status(200).json({
            ResultCode: 0,
            ResultDesc: "Accepted"
        });
    }
};
