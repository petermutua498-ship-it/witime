const express = require("express");
const { v4: uuidv4 } = require("uuid");
const https = require("https");

const app = express();

app.use(express.json());
app.use(express.static("public"));

const MAX_MEMBERS = 6;
let members = [];

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getminutes(amount) {
    if(amount == 5) return 60;
    if(amount == 10) return 120;
    if(amount == 25) return 180;
    if(amount == 50) return 360;
    if(amount == 70) return 720;
}

app.get("/ping", (req, res) => {
    res.send("Server alive");
}) 

app.post("/verify", (req, res) => {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
        return res.status(400).json({ error: "Phone required" });
    }

    if (members.length >= MAX_MEMBERS) {
        return res.status(400).json({ error: "Member limit reached"});
    }

    const code = generateCode();

    members.push({ phone, amount, code });

    console.log("Payment:", phone, amount, "Code:", code);

    res.json({
        message: "Payment successful. Code sent."
    });
});

app.get("/session", (req, res) => {

    const userIP = req.ip;

    const member = members.find(u => u.ip === userIP);
    
    if(!member){
        return res.json({active:false});
    }

    if(Date.now() > member.expires){
        return res.json({active:false});
    }

    res.json({
        active:true,
        expires: member.expires
    });
});

app.post("/verify", (req, res) => {
    const { phone, code} = req.body;
    const member = members.find(m = m.phone === phone);

    if (!member) return res.json({ message: "User not found" });
    if(member.code !== code) return res.json({ message: "Invalid Code" });

    const userIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    if (member.ip && member.ip !== userIP) {
        return res.json({ message: "Code already used on aother device"});
    }

    member.verified = true;
    member.ip = userIP;
    member.session = uuidv4();
    member.expires = Date.now() + getMinutes(member.amount) * 60000;

    res.json({ message: "Access granted", session: member.session })
});

app.post("/pay",(req, res) => {
    const {phone, amount}=req.body;

    if(!phone || !amount){
        return res.json({message:"Missing payment details"});
    }

    const code=Math.floor(1000+Math.random()*9000);

    members.push({
        phone,
        amount,
        code
    });

    res.json({
        message:"Payment request sent. Code: "+code
    });
});

app.get("/admin/users", (req, res) => {
    res.json(members);
});

setInterval(() => {
    const now = Date.now();
    members = members.filter(user => now < user.expires || !user.expires);
}, 60000);

setInterval(() => {
    const url = "https://witime-o2tz.onrender.com/ping";
    https.get(url, () => {
        console.log("Internal ping to prevent sleep");
    }).on("error", (err) => {
        console.log("ping error:", err.message);
    });
}, 10 * 60 * 1000);

app.get("/reset", (req, res) => {
    members = [];
    res.send("Members reset");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running")
});
