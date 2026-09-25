const express = require("express");
const router  = express.Router();

const {
  getAllStations, getStationById, createStation, updateStation, deleteStation,
} = require("../controllers/stationController");

const { protect }   = require("../middleware/auth");
const { authorize } = require("../middleware/roles");

router.get("/",       getAllStations);
router.get("/:id",    getStationById);

router.post("/",      protect, authorize("admin"), createStation);
router.put("/:id",    protect, authorize("admin"), updateStation);
router.delete("/:id", protect, authorize("admin"), deleteStation);

module.exports = router;
