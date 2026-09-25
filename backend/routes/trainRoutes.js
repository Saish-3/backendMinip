const express = require("express");
const router  = express.Router();

const {
  getAllTrains, getTrainById, getTrainAvailability,
  getTrainStatus, createTrain, updateTrain, deleteTrain,
} = require("../controllers/trainController");

const { protect }   = require("../middleware/auth");
const { authorize } = require("../middleware/roles");

// Public
router.get("/",                  getAllTrains);
router.get("/:id",               getTrainById);
router.get("/:id/availability",  getTrainAvailability);
router.get("/:id/status",        getTrainStatus);

// Admin only
router.post("/",      protect, authorize("admin"), createTrain);
router.put("/:id",    protect, authorize("admin"), updateTrain);
router.delete("/:id", protect, authorize("admin"), deleteTrain);

module.exports = router;
