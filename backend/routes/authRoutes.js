const express = require("express");
const router  = express.Router();

const { register, login, getMe, updateProfile, registerRules, loginRules } = require("../controllers/authController");
const { protect }          = require("../middleware/auth");
const { handleValidation } = require("../middleware/validate");

router.post("/register", registerRules, handleValidation, register);
router.post("/login",    loginRules,    handleValidation, login);
router.get("/me",        protect, getMe);
router.put("/profile",   protect, updateProfile);

module.exports = router;
