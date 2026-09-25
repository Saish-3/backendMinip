const express = require("express");
const router  = express.Router();

const {
  getDashboardStats, getAllUsers, toggleUserStatus,
  getAllCancellations, processRefund,
  getRevenueAnalytics, broadcastNotification,
} = require("../controllers/adminController");

const { protect }   = require("../middleware/auth");
const { authorize } = require("../middleware/roles");

// All admin routes require auth AND at minimum the staff role
router.use(protect);
router.use(authorize("admin", "staff"));

// Admin + Staff
router.get("/dashboard",            getDashboardStats);
router.get("/users",                getAllUsers);
router.get("/cancellations",        getAllCancellations);
router.get("/analytics/revenue",    getRevenueAnalytics);

// Admin only
router.patch("/users/:id/toggle",                    authorize("admin"), toggleUserStatus);
router.patch("/cancellations/:id/process-refund",    authorize("admin"), processRefund);
router.post("/notifications/broadcast",              authorize("admin"), broadcastNotification);

module.exports = router;
