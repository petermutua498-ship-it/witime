require("dotenv").config();

const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const moment = require("moment");
const path = require("path");
const cors = require("cors");
global.Buffer = require("buffer").Buffer;


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.port || 3000;

mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

const Session = mongoose.model("Session", {
    phone: String,
    code: String,
    active: Boolean,
    expiresAt: Date,
});

function generateCode() {
    return math.floor(100000 + Math.random() * 900000).toString();
}

app.post("/pay", async (req, res) => {
    try{
        console.log("ROUTE HIT");

        let { phone } = req.body;

        if (!phone) {
            return res.json({ error: "Phone required" });
        }

        phone = String(phone).trim();
        if(phone.startsWith("0")) {
            phone = "254" + phone.substring(1);
        }

        console.log("PHONE:", phone);
        
        const consumerKey = "luesphuW8Qdo6vNSEbvAnOuvJOlDDc5vDe8V6pywUiHaCBqu";
        const consumerSecret = "QfqAEvAtAUeEN8VwveaKkoZznWpiCWkfnuLeD5gOW94rOEm4GekcMmdBHpXYAHw8";
        const shortcode = "174379";
        const passkey = "bfb279f9aa9bdbcf1582a8c4d7d6b8f2c3d8b4d3a0f6c4d2b1c6e0f2a5a7bb9c";

        const auth = Buffer.from(
            consumerKey + ":" + consumerSecret
        ).toString("base64");
        
        const tokenRes = await require("axios").get(
            
            "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
            {
                headers: {
                    Authorization: 'Basic ${auth}'
                }
            }
        );

        const token = tokenRes.data.access_token;
        console.log("TOKEN OK");

        const date = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
        );
        
        const timestamp = 
        date.getFullYear().toString() +
        String(date.getMonth() + 1).padStart(2, "0") +
        String(date.getDate()).padStart(2, "0") +
        String(date.getHours()).padStart(2, "0") +
        String(date.getMinutes()).padStart(2, "0") +
        String(date.getSeconds()).padStart(2, "0");

        const password = Buffer.from(
            shortcode + passkey + timestamp
        ).toString("base64");

        console.log("PASSWORD OK");

        const stkRes = await require("axios").post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            {
                BusinessShortCode: shortcode,
                password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: 1,
                PartyA: phone,
                PartyB: shortcode,
                PhoneNumber: phone,
                CallBackUrl: "https://witime-o2tz.onrender.com/callback",
                AccountReference: "Witime",
                TransactionDesc: "Internet Payment"
            },
            {
                headers: { Authorization: 'Bearer ${token}'}
            }
        );

        console.log("STK RESPONSE:", stkRes.data);

        res.json(stkRes.data);

    } catch (err) {
        console.log("FULL ERROR:", err.response?.data || err.message);

        res.json({
            error: err.errorresponse?.data?.errorMessage || "STK failed"
        });
    }
});

app.get("/stk", async (req, res) => {
    try{
        const { Buffer } = require("buffer");

        const auth = buffer.from(
            "luesphuW8Qdo6vNSEbvAnOuvJOlDDc5vDe8V6pywUiHaCBqu:QfqAEvAtAUeEN8VwveaKkoZznWpiCWkfnuLeD5gOW94rOEm4GekcMmdBHpXYAHw8"
        ).toString("base64");

        const response = await axios.get(
            "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        {
            headers: {
                authorization: 'Basic ${auth}'
            }
        }
        );

        console.log("TOKEN RESPONSE:", response.data);

        res.json(response.data);
    } catch (err) {
        console.log("TOKEN ERROR:", err.response?.data || err.message);
        res.json(err.response?.data || err.message);
    }
})

app.post("/stk", async (req, res) => {

    const { phone, amount } = req.body;

    console.log("PHONE:", phone);

    if (!phone) {
        return res.json({ message: "Phone missing" });
    }
    
    setInterval(() => {
        console.log("ping...");
    }, 300000);
});

app.post("/callback", async (req, res) => {
        console.log("CALLBACK:", JSON.stringify(req.body, null, 2));
        res.sendStatus(200);
});

app.post("/verify", async(req, res) => {
    try {
        const {phone, code} = req.body;
        
        const session = await Session.findOne({ 
            phone, 
            code,
            active: true 
        });
        
        if (!session) {
            return re.json({status: "Invalid" });
        }

        if (session.expiresAt < new Date()) {
            return res.json({ status: "expired"});
        }

        res.json({ status: "ok" });

    } catch (err) {
        res.json({ status: "error"});
    }
});

app.get("/ping", (req, res) => {
    res.send("alive");
})

async function checkUserLimit() {
    const count = await Session.countDocuments({ active: true });
    return count < 7;
}

let activeCodes = [];


app.listen(PORT, () => {
    console.log("Server running", PORT);
});
