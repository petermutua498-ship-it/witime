
const axios = require("axios");

const BASE_URL =
    process.env.MPESA_ENV === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

async function getAccessToken() {
    const key = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;

    if (!key || !secret) {
        throw new Error(
            "Missing M-Pesa consumer key or secret."
        );
    }

    const auth = Buffer.from(
        `${key}:${secret}`
    ).toString("base64");

    const response = await axios.get(
        `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
        {
            headers: {
                Authorization: `Basic ${auth}`
            },
            timeout: 15000
        }
    );

    if (!response.data?.access_token) {
        throw new Error(
            "Safaricom did not return an access token."
        );
    }

    return response.data.access_token;
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

    const token = await getAccessToken();
    const timestamp = getTimestamp();

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;

    if (!shortcode || !passkey) {
        throw new Error(
            "Missing M-Pesa shortcode or passkey."
        );
    }

    const password = Buffer.from(
        `${shortcode}${passkey}${timestamp}`
    ).toString("base64");

    const response = await axios.post(
        `${BASE_URL}/mpesa/stkpushquery/v1/query`,
        {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestID
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            timeout: 20000
        }
    );

    return response.data;
}

module.exports = {
    getAccessToken,
    querySTK
};
