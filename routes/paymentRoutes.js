const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/paymentController");

router.post("/pay", paymentController.pay);
router.post("/apicallback", paymentController.callback);

module.exports = router;