const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const { duration } = require("moment");
const path = require("path");
const cors = require("cors");
const { error } = require("console");
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const Session = mongoose.model("Session", {
    phone: String,
    deviceId: String,
    ip: String,
    active: Boolean,
    expiresAt: Date,
    speedlimit: Number
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

mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.log("DB ERROR:", err));

app.post("/stk", async (req, res) => {
    try {
        const { phone, amount } = req.body;

        console.log("PHONE:", phone);

        const result = await sendSTK(phone, amount);

        console.log("STK HIT");

        res.json(result);
    } catch (err) {
        cosole.log("STK ERROR:", err.message);
        res.status(500).json({ error: "STK failed" });
    }

});

app.post("/callback", async (req, res) => {
    const data = req.body.Body.stkCallback;

    if (data.ResultCode === 0) {
        const items = data.CallbackMetadata.Item;

        const phone = items.find(i => i.Name === "PhoneNumber").Value;

        const allowed = await checkUserLimit();

        if (!allowed) {
            console.log("NETWORK FULL");
            return res.json({ status: "full" });
        }

        await Session.findOneAndUpdate(
            {phone},
            {
                phone,
                active: true,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
                speedlimit: 1000
            },
            { upsert: true }
        );

        console.log("SUCCESS:", phone);
    }

    res.json({ ok:true });
});

function generateCode(){
    return Math.random().toString(36).substring(2,8).toUpperCase();
}

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

async function stkPush(phone, amount) {
    const auth = await axios.get(process.env.DARAJA_TOKEN_URL, {
        auth: {
            username: process.env.CONSUMER_KEY,
            password: process.env.CONSUMER_SECRET
        }
    });

    const token = auth.data.access_token;

    const response = await axios.post(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        {
            BusinessShortCode: 17439,
            password: process.env.PASSKEY,
            Timestamp: new Date().toISOString(),
            TransactionType: "CustomerPayBillOnline",
            Amount: 1,
            PartyA: "2547xxxxxxxx",
            PartyB: process.env.SHORTCODE,
            PhoneNumber: 254708374149,
            CallBackUrl: "https://witime-o2tz.onrender.com/callack",
            AccountReference: "Witime",
            TransactionDesc: "Internet"
        },
        {
            headers: { Authorization: 'Bearer ${token}'}
        }
    );

    return response.data;
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

app.post("/verify", async(req, res) => {
    try {
        const {phone, code} = req.body;
        
        const session = await Session.findOne({ phone, code });
        
        if (!session) {
            return re.json({status: "Invalid" });
        }

        session.active = true;
        await session.save();

        res.json({ status: "active" });
    } catch {
        res.status(500).json({error: error.message});
    }
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
