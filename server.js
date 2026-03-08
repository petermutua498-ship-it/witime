require('dotenv').config();
const express  = require ('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./database.db');

db.prepare(`CREATE TABLE IF NOT EXISTS users (
    phone TEXT PRIMARY KEY,
    expiry INTEGER
)
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    amount INTEGER,
    hours INTEGER,
    date INTEGER
)
`).run();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MAX_USERS = 6;

const packages = {
    1: {amount: 5, hours: 1},
    2: {amount: 10, hours: 2},
    3: {amount: 25, hours: 3},
    4: {amount: 50, hours: 6},
    5: {amount: 70, hours: 12}
};

const HOST_URL = process.env.HOST_URL || `https://witime-o2tz.onrender.com`;
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;

const shortcode = "174379";
const passkey = "bfb279f9aa9bdbcf1582a8c4d7d6b8f2c3d8b4d3a0f6c4d2b1c6e0f2a5a7bb9c";

async function getAccessToken() {
    const response = await axios.get(
        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        {
            auth: { username: CONSUMER_KEY, password: CONSUMER_SECRET}
        }
    );

    return resp.data.access.token;
}

app.post('/pay', async (req, res) => {
    const {packageId, phone } = req.body;

    if (!packages[packageId])
        return res.json({ error: "Invalid package"});
    const activeCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE expiry > ?'
    ).get(Date.now());

    if (activeCount.count >= MAX_USERS)
        return res.json({ error: "Max 6 users reached"});

    try {
        const token = await getAccessToken();

        function getTimestamp() {
        const now = new Date();
        return now.getFullYear().toString() +
        stringify(now.getMonth() + 1).padStart(2, "0") +
        stringify(now.getDate()).padStart(2, "0") +
        stringify(now.getHours()).padStart(2, "0") +
        stringify(now.getMinutes()).padStart(2, "0") +
        stringify(now.getSeconds()).padStart(2, "0");
        }

        const timestamp = getTimestamp();

        const password = Buffer.from(shortcode + passkey + timestamp)
        .toString("base64");

        await axios.post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            {
                BusinessShortCode: shortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: packages[packageId].amount,
                PartyA: phone,
                PartyB: shortcode,
                Phonenumber: phone,
                CallBackUrl: HOST_URL + "/callback",
                AccountReference: "Test",
                transactionDesc: "Test Payment"
            },
            {
                headers: {
                    Authorization: "Bearer " + token 
                }
            }
        );

        res.send({ message: "STK Push Sent" });

    } catch (err) {
        console.error("STK Push error:", err.response?.data || err.message);
        res.status(500).send("STK push failed, Check server logs for details.");
    }
});

app.post('/callback', (req, res) => {
    console.log("STK Callback received:", req.bpdy);

    try{
        const items = req.body.Body.stkcallback.CallbackMetadata.Item;
        const phoneItem = items.find(
            i => i.Name === "PhoneNumber");

        const amountItem = items.find(
            i => i.Name === "Amount");

       if (phoneItem && amountItem) {
        const phone = phoneItem.Value;
        const amount = amountItem.Value;
        const hours = Object.values(packages).find(p => p.amount === amount)?.hours || 1;
       }

        const expiry = Date.now() + hours * 3600000;

        db.prepare(`INSERT OR REPLACE INTO users (phone, expiry)
            VALUES (?, ?)
            `).run(phone, expiry);

        db.prepare(`
            INSERT INTO payments (phone, amount, hours, date)
            VALUES (?, ?, ?, ?)
            `).run(phone, amount, hours, Date.now()
        );

            console.log("User Activated:, ${phone} for $ {hours} hours");
    } catch (err) {
        console.error(`Callback parsing error:`, err.message);
    }

    res.status(200).send("ok")
});

app.get('/check-access', (req, res) => {

    const { phone } = req.query;

    const user = db.prepare(
        'SELECT * FROM users WHERE phone = ?'
    ).get(phone);

    if(!user || Date.now() > user.expiry)
        return res.json({ access: false });

    res.json({
        access: true,
        timeLeft: Math.floor((user.expiry - Date.now()) / 60000) 
    });
});

app.get('/admin/stats', (req, res) => {

    const users = db.prepare(
        'SELECT * FROM users'
    ).all();

    const payments = db.prepare(`
        SELECT * FROM payments`
    ).all();

    res.json({users, payments});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log("Server running")
});