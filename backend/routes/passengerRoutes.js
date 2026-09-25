const express = require("express");
const router  = express.Router();

const {
  getMyPassengers, getPassengerById, createPassenger, updatePassenger, deletePassenger,
} = require("../controllers/passengerController");
const { protect } = require("../middleware/auth");

// All passenger routes require authentication
router.use(protect);

router.get("/",       getMyPassengers);
router.get("/:id",    getPassengerById);
router.post("/",      createPassenger);
router.put("/:id",    updatePassenger);
router.delete("/:id", deletePassenger);

module.exports = router;
