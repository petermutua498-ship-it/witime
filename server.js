require("dotenv").config();

const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const moment = require("moment");
const path = require("path");
const cors = require("cors");
const { buffer } = require("buffer");

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
    console.log("ROUTE HIT");
    try{
        let { phone } = req.body;

        if (!phone) {
            return res.json({ error: "Phone required" });
        }

        if(phonestartsWith("0")) {
            phone = "254" + phone.substring(1);
        }

        console.log("PHONE:", phone);
        
        const consumerKey = "luesphuW8Qdo6vNSEbvAnOuvJOlDDc5vDe8V6pywUiHaCBqu";
        const consumerSecret = "QfqAEvAtAUeEN8VwveaKkoZznWpiCWkfnuLeD5gOW94rOEm4GekcMmdBHpXYAHw8";

        const auth = Buffer.from(
            consumerKey + ":" + 
            consumerSecret
        ).toString("base64");
        
        const tokenRes = await axios.get(
            
            "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
            
            {
                headers: {
                    Authorization: 'Basic ${auth}'
                }
            }
        );

        const token = tokenRes.data.access_token;
        console.log("TOKEN:", token);

        const shortcode = "174379";
        const passkey = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

        const timestamp = new Date()
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, -3);

        const password = Buffer.from(
            shortcode + passkey + timestamp
        ).toString("base64");

        console.log("PASSWORD GENERATED");

        const stkres = await axios.post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            
            {
                BusinessShortCode: process.env.SHORTCODE,
                password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: "1",
                PartyA: phone,
                PartyB: process.env.SHORTCODE,
                PhoneNumber: phone,
                CallBackUrl: process.env.HOST_URL + "/callback",
                AccountReference: "Witime",
                TransactionDesc: "Internet Payment"
            },
            {
                headers: { Authorization: 'Bearer ${token}'}
            }
        );


        res.json({
            success:true,
            message: "STK sent",
            data: stk
        });

    } catch (err) {
        res.json({
            success: false,
            error: err.errorMessage || "STK failed"
        });
    }
});

app.get("/test-token", async (req, res) => {
    try{
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
