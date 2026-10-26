
const jwt = require("jsonwebtoken");
const Account = require("../models/Account");

module.exports = async function requireAccount(req, res, next) {
  try {
    const token = req.cookies?.witimeToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Please log in to continue.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const account = await Account.findById(decoded.accountId).select(
      "_id name email status"
    );

    if (!account || account.status !== "active") {
      return res.status(401).json({
        success: false,
        message: "Your account is unavailable. Please log in again.",
      });
    }

    req.account = account;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Your login session is invalid or has expired.",
    });
  }
};
