
const axios = require("axios");

const BASE_URL =
    process.env.MPESA_ENV === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

const http = axios.create({
    timeout: 20000,
    headers: {
        "Content-Type": "application/json"
    }
});


async function getAccessToken() {
    const key = process.env.MPESA_CONSUMER_KEY?.trim();
    const secret = process.env.MPESA_CONSUMER_SECRET?.trim();

    if (!key || !secret) {
        throw new Error(
            `Missing Daraja credentials. ` +
            `Consumer key present: ${Boolean(key)}; ` +
            `Consumer secret present: ${Boolean(secret)}`
        );
    }

    const auth = Buffer.from(`${key}:${secret}`).toString("base64");

    try {
        const response = await axios.get(
            "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    Accept: "application/json"
                },
                timeout: 15000
            }
        );

        return response.data.access_token;
    } catch (error) {
        console.error("[WiTime OAuth Error]", {
            status: error.response?.status,
            data: error.response?.data ?? error.message,
            consumerKeyPresent: Boolean(key),
            consumerSecretPresent: Boolean(secret)
        });

        throw new Error(
            `M-Pesa OAuth failed with HTTP ${
                error.response?.status ?? "network error"
            }.`
        );
    }
}


function getTimestamp() {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Nairobi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date());

    const values = {};

    for (const part of parts) {
        if (part.type !== "literal") {
            values[part.type] = part.value;
        }
    }

    return (
        values.year +
        values.month +
        values.day +
        values.hour +
        values.minute +
        values.second
    );
}

async function querySTK(checkoutRequestID) {
    if (!checkoutRequestID) {
        throw new Error("CheckoutRequestID is required.");
    }

    const shortcode = process.env.MPESA_SHORTCODE?.trim();
    const passkey = process.env.MPESA_PASSKEY?.trim();

    if (!shortcode || !passkey) {
        throw new Error(
            "Missing MPESA_SHORTCODE or MPESA_PASSKEY."
        );
    }

    const token = await getAccessToken();
    const timestamp = getTimestamp();

    const password = Buffer.from(
        `${shortcode}${passkey}${timestamp}`
    ).toString("base64");

    const url = `${BASE_URL}/mpesa/stkpushquery/v1/query`;

    try {
        const response = await http.post(
            url,
            {
                BusinessShortCode: shortcode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestID
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error("[WiTime STK Query Error]", {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data || null
        });

        throw new Error(
            `M-Pesa STK query failed (${error.response?.status || "network error"}).`
        );
    }
}

module.exports = {
    getAccessToken,
    querySTK
};
