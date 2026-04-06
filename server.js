require("dotenv").config();

const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const moment = require("moment");
const path = require("path");
const cors = require("cors");

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

async function getAccessToken() {
    const auth = Buffer.from(
        process.env.CONSUMER_KEY + ":" + 
        process.env.CONSUMER_SECRET
    ).toString("base64"); 
    const res = await axios.get (
        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        {
            headers: {
                Authorization: 'Basic ${auth}'
            }
        }
    );

    return res.data.access_token;
}

app.post("/stk", async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.json({ error: "Phone required" });
        }
        
        const token = await getAccessToken();

        const timestamp = new Date ()
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, -3);

        const password = Buffer.from(
            SHORTCODE +
            PASSKEY + 
            timestamp
        ).toString("base64");

        const phonenumber = "254708374149";
        
        const res = await axios.post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            
            {
                BusinessShortCode: shortcode,
                password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: "1",
                PartyA: phone,
                PartyB: shortcode,
                PhoneNumber: phone,
                CallBackUrl: process.env.CALLBACK_URL,
                AccountReference: "Witime",
                TransactionDesc: "Internet Payment"
            },
            
            {
                headers: { Authorization: 'Bearer ${token}'}
            }
        );

        console.log("STK RESPONSE:", stk.data);

        console.log("KEY:", process.env.CONSUMER_KEY);
        console.log("SECRET:", process.env.CONSUMER_SECRET);
        
        res.json({
            message: stk.data.responseDescription || "Request sent"
        });

    } catch (err) {
        console.log("STK ERROR:", err.response?.data || err.message);

        res.json({
            error: err.response?.data?.errorMessage || "STK failed"
        });
    }
});

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

app.post("/pay", async (req, res) => {
    try{
        let { phone } = req.body;

        if (!phone) return res.json({ error: "Phone required" });

        phone = phone.replace(/^0/, "254");

        console.log("PHONE:", phone);

        const stk = await sendSTK(phone, 1);

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

app.post("/callback", async (req, res) => {
    try{
        console.log("CALLBACK:", JSON.stringify(req.body, null, 2));

      const data = req.body.Body.stkCallback;

      if (data.ResultCode === 0) {
        const items = data.CallbackMetadata.Item;

        const phone = items.find(i => i.Name === "PhoneNumber").Value;

        const allowed = await checkUserLimit();

        if (!allowed) {
            console.log("NETWORK FULL");
            return res.json({ status: "full" });
        }

        const code = generateCode();

        const expiry = new Date(Date.now() + 60 * 60 * 1000);

        await Session.create({
            phone,
            code,
            active: true,
            expiresAt: expiry,
        });
            
        console.log("SUCCESS:", phone, "CODE:", code);
    }

    res.json({ ok:true });
} catch (err) {
    console.log("CALLBACK ERROR:", err.message);
    res.json({ ok: false });
}
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
