const jwt = require("jsonwebtoken");
const { body } = require("express-validator");
const User = require("../models/User");

// ─── Token generator ──────────────────────────────────────────────────────────
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });

const userPayload = (user) => ({
  id:    user._id,
  name:  user.name,
  email: user.email,
  role:  user.role,
  phone: user.phone,
});

// ─── Validation rules (exported for use in routes) ───────────────────────────
const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required")
    .isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("role").optional().isIn(["passenger", "staff", "admin"]).withMessage("Invalid role"),
];

const loginRules = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @desc   Register a new user
 * @route  POST /api/auth/register
 * @access Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const user = await User.create({ name, email, password, phone, role: role || "passenger" });
    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: userPayload(user),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Login user
 * @route  POST /api/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Contact support.",
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    res.json({
      success: true,
      message: "Login successful",
      token,
      user: { ...userPayload(user), lastLogin: user.lastLogin },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get current user's profile
 * @route  GET /api/auth/me
 * @access Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Update user profile (name, phone)
 * @route  PUT /api/auth/profile
 * @access Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone },
      { new: true, runValidators: true }
    );
    res.json({ success: true, message: "Profile updated successfully", user });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, updateProfile, registerRules, loginRules };
