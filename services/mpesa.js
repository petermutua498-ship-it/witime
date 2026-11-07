
const axios = require("axios");

const http = axios.create({
    timeout: 20000,
    headers: {
        "Content-Type": "application/json"
    }
});

function getBaseUrl(environment) {
    return environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";
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

async function getAccessToken(config) {
    if (!config?.consumerKey || !config?.consumerSecret) {
        throw new Error("M-Pesa Consumer Key or Consumer Secret is missing.");
    }

    const baseURL = getBaseUrl(config.environment);

    const auth = Buffer.from(
        `${config.consumerKey.trim()}:${config.consumerSecret.trim()}`
    ).toString("base64");

    try {
        const response = await http.get(
            `${baseURL}/oauth/v1/generate?grant_type=client_credentials`,
            {
                headers: {
                    Authorization: `Basic ${auth}`
                }
            }
        );

        return response.data.access_token;
    } catch (error) {
        console.error("[WiTime OAuth Error]:", {
            status: error.response?.status,
            data: error.response?.data || error.message
        });

        throw new Error("Unable to authenticate with M-Pesa.");
    }
}

async function querySTK(checkoutRequestID, config) {
    if (!checkoutRequestID) {
        throw new Error("CheckoutRequestID is required.");
    }

    if (!config?.businessShortCode || !config?.passkey) {
        throw new Error("M-Pesa shortcode or passkey is missing.");
    }

    const token = await getAccessToken(config);
    const timestamp = getTimestamp();

    const password = Buffer.from(
        `${config.businessShortCode}${config.passkey}${timestamp}`
    ).toString("base64");

    const baseURL = getBaseUrl(config.environment);

    try {
        const response = await http.post(
            `${baseURL}/mpesa/stkpushquery/v1/query`,
            {
                BusinessShortCode: config.businessShortCode,
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
        console.error("[WiTime STK Query Error]:", {
            status: error.response?.status,
            data: error.response?.data || error.message
        });

        throw new Error("M-Pesa STK query failed.");
    }
}

module.exports = {
    getAccessToken,
    querySTK,
    getTimestamp
};
