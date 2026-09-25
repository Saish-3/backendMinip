const express = require("express");
const router  = express.Router();

const {
  createBooking, getMyBookings, getJourneyHistory,
  getBookingById, cancelBooking, getAllBookings,
} = require("../controllers/bookingController");

const { protect }   = require("../middleware/auth");
const { authorize } = require("../middleware/roles");

// All booking routes require auth
router.use(protect);

// Specific named paths must come BEFORE /:id to avoid conflicts
router.get("/my",      getMyBookings);
router.get("/history", getJourneyHistory);

// Admin/Staff — view all bookings with $lookup pipeline
router.get("/", authorize("admin", "staff"), getAllBookings);

router.post("/",             createBooking);
router.get("/:id",           getBookingById);
router.post("/:id/cancel",   cancelBooking);

module.exports = router;
