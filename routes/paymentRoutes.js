
const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/paymentController");
const requireAccount = require("../middleware/requireAccount");

router.post("/pay", requireAccount, paymentController.pay);

// Safaricom must be able to reach this endpoint without logging in.
router.post("/apicallback", paymentController.callback);

module.exports = router;
