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
    deviceId: String,
    code: String,
    ip: String,
    active: Boolean,
    expiresAt: Date,
    speedlimit: Number
});

async function getAccessToken() {
    const auth = Buffer.from(
        process.env.CONSUMER_KEY + ":" + process.env.CONSUMER_SECRET
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

function getPassword() {
    const timestamp = moment().format("YYYYMMDDHHmmss");

    const password = Buffer.from(
        process.env.SHORTCODE + 
        process.env.PASSKEY + 
        timestamp
    ).toString("base64");

    return { password, timestamp };
}

async function sendSTK(phone, amount) {
    const token = await getAccessToken();
    const { password, timestamp } = getPassword();

    const response = await axios.post(

        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        {
            BusinessShortCode: process.env.SHORTCODE,
            password: process.env.PASSKEY,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: phone,
            PartyB: process.env.SHORTCODE,
            PhoneNumber: phone,
            CallBackUrl: process.env.CALLBACK_URL,
            AccountReference: "Witime",
            TransactionDesc: "Internet Payment"
        },
        {
            headers: { Authorization: 'Bearer ${token}'}
        }
    );

    console.log("STK RESPONSE:", response.data);

    return response.data;
}

app.post("/stk", async (req, res) => {
    try {
        const { phone, amount } = req.body;

        const result = await sendSTK(phone, amount);

        res.json(result);

    } catch (err) {
        console.log("STK ERROR:", err.response?.data || err.message);
        res.status(500).json({ error: "STK failed" });
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

        const code = Math.floor(100000 + Math.random() * 900000);

        const expiry = new Date(Date.now() + 60 * 60 * 1000);

        await Session.create({
            phone,
            code,
            active: true,
            expiresAt: expiry,
            speedlimit: 1000
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

const admin = mongoose.model("admin", {
    username: String,
    password: String
});

async function checkUserLimit() {
    const count = await Session.countDocuments({ active: true });
    return count < 7;
}

let activeCodes = [];


app.post("/auth", async (req, res) => {
    const {ip, deviceid} = req.body;

    const session = await Session.findOne({ ip, deviceId });

    if (!session) return res.json({ access: false });

    if (!session.active) return res.json({ access: false });

    if (Date.now() > session.expiresAt) {
        session.active = false;
        await session.save();
        return res.json({ access: false });
    }

    return res.json({ access: true, speedLimit: session.speedLimit });
});

function bandwidthMiddleware(req, res, next) {
    res.setHeader("X-Bandwidth-Limit", "1000kbps");
    next();
}

const packages = {
    "1 hour": {price: 5, duratin: 60},
    "2 hours": {price: 15, duration: 120},
    "3 hours": {price: 25, duration: 180},
    "6 hours": {price: 50, duration: 360},
    "12 hours": {price: 80, duration: 720},
};

async function checkAccess() {
    const ip = await fetch ("https://api.ipify.org?format=json")
    .then(r => r.json())
    .then(d => d.ip);

    const deviceId = navigator.userAgent + screen.width;

    const res = await fetch("/auth", {
        method: "POST",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify({ip, deviceId})
    });

    const data = await res.json();

    if (data.access) {
        window.location.href = "/index.html";
    } else {
        window.location.href = "/pay.html"
    }
}

app.get("/packages", (req,res) => {
    res.json(packages);
});

app.post("/pay", async(req, res) => {
    const { phone, package } = req.body;

    if(!phone || !package) {
        return res.json({ message: "Missing details"});
    }

    const code = generateCode();

    activeCodes.push({
        code: code,
        package: package,
        expires: Date.now() + (60 * 60 * 1000)
    });

    console.log("PAY:", phone, package, code);

    res.json({ code });

});      

app.get("/admin/stats", async (req,res) => {
    const users = await Session.find({ active: true });

    res.json({activeUsers: users.length,
        maxUsers: 7,
        users
    });
});

app.post("/admin/login", async (req, res) => {
    const { username, password } = req.body;

    const admin = mongoose.model("admin", { username, password });

    if (!admin) return res.json({ status: "failed" });

    res.json({ status: "ok"});
});




app.get("/status/:phone", async (req, res) => {
    const session = await Session.findOne({ phone: req.params.phone });

    if(!session) return res.json({ active: false });

    if (Date.now() > session.expiresAt) {
        session.active = false;
        await session.save();
    }
});

mongoose.connection.once("open", () => {
    console.log("DB READY");
    
    setInterval(async () => {
        try {
            await Session.updateMany(
                { expiresAt: {$lt: new Date() } },
                { active: false }
            );
        } catch (err) {
            console.log("Expiry error:", err.message);
        }
    }, 6000);
});

app.listen(PORT, () => {
    console.log("Server running")
});
