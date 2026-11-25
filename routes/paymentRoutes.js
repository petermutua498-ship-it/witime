
const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/paymentController");

// Customer requests an M-Pesa STK Push.
// This is public because hotspot customers do not need WiTime admin accounts.
router.post("/pay", paymentController.pay);

// Customer checks the status using the CheckoutRequestID.
router.get(
    "/check-payment/:checkoutRequestID",
    paymentController.checkStatus
);

// Safaricom must reach this endpoint without logging in.
router.post("/apicallback", paymentController.callback);

module.exports = router;
