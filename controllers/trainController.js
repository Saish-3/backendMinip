const Train        = require("../models/Train");
const Booking      = require("../models/Booking");
const Notification = require("../models/Notification");
const User         = require("../models/User");
const { getPaginationData, getSkip } = require("../utils/pagination");
const { simulateTrainStatus }        = require("../utils/trainStatusSimulator");

// ─── GET all trains (search / filter / paginate) ──────────────────────────────
// @route  GET /api/trains
// @access Public
const getAllTrains = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, from, to, type, status = "active", sort = "-createdAt" } = req.query;

    const filter = {};
    if (from)   filter["source.code"]      = from.toUpperCase();
    if (to)     filter["destination.code"] = to.toUpperCase();
    if (type)   filter.type   = type;
    if (status) filter.status = status;

    const total  = await Train.countDocuments(filter);
    const trains = await Train.find(filter)
      .sort(sort)
      .skip(getSkip(page, limit))
      .limit(parseInt(limit));

    res.json({ success: true, pagination: getPaginationData(page, limit, total), trains });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/trains/:id
// @access Public
const getTrainById = async (req, res, next) => {
  try {
    const train = await Train.findById(req.params.id);
    if (!train) return res.status(404).json({ success: false, message: "Train not found" });
    res.json({ success: true, train });
  } catch (err) {
    next(err);
  }
};

// ─── Seat availability for a specific journey date ────────────────────────────
// @route  GET /api/trains/:id/availability?date=YYYY-MM-DD
// @access Public
const getTrainAvailability = async (req, res, next) => {
  try {
    const train = await Train.findById(req.params.id);
    if (!train) return res.status(404).json({ success: false, message: "Train not found" });

    const d = new Date(req.query.date || Date.now());
    const startOfDay = new Date(d); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(d); endOfDay.setHours(23, 59, 59, 999);

    // Count booked passengers per class using $group
    const bookedByClass = await Booking.aggregate([
      {
        $match: {
          train: train._id,
          journeyDate: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ["confirmed", "waiting"] },
        },
      },
      {
        $group: {
          _id: "$travelClass",
          bookedSeats: { $sum: { $size: "$passengers" } },
        },
      },
    ]);

    const availability = {};
    train.classes.forEach((cls) => {
      const found  = bookedByClass.find((b) => b._id === cls.className);
      const booked = found ? found.bookedSeats : 0;
      const avail  = Math.max(0, cls.totalSeats - booked);
      availability[cls.className] = {
        total:      cls.totalSeats,
        booked,
        available:  avail,
        farePerSeat: cls.farePerSeat,
        status:
          avail > 10  ? "AVAILABLE" :
          avail > 0   ? "FILLING FAST" : "FULL",
      };
    });

    res.json({
      success: true,
      journeyDate: d.toISOString().split("T")[0],
      train: {
        trainNumber:   train.trainNumber,
        trainName:     train.trainName,
        source:        train.source,
        destination:   train.destination,
        departureTime: train.departureTime,
        arrivalTime:   train.arrivalTime,
      },
      availability,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Live train status simulation ─────────────────────────────────────────────
// @route  GET /api/trains/:id/status
// @access Public
const getTrainStatus = async (req, res, next) => {
  try {
    const train = await Train.findById(req.params.id);
    if (!train) return res.status(404).json({ success: false, message: "Train not found" });

    const status = simulateTrainStatus(train);
    res.json({ success: true, status });
  } catch (err) {
    next(err);
  }
};

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

// @route  POST /api/trains  [Admin]
const createTrain = async (req, res, next) => {
  try {
    const train = await Train.create(req.body);
    res.status(201).json({ success: true, message: "Train created successfully", train });
  } catch (err) {
    next(err);
  }
};

// @route  PUT /api/trains/:id  [Admin]
const updateTrain = async (req, res, next) => {
  try {
    const train = await Train.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!train) return res.status(404).json({ success: false, message: "Train not found" });

    // If train is being cancelled, notify affected passengers
    if (req.body.status === "cancelled") {
      const affected = await Booking.find({
        train: train._id,
        journeyDate: { $gte: new Date() },
        status: "confirmed",
      }).select("user pnr _id");

      if (affected.length > 0) {
        const notifications = affected.map((b) => ({
          user:           b.user,
          type:           "train_cancelled",
          title:          "Train Cancelled",
          message:        `Train ${train.trainNumber} – ${train.trainName} has been cancelled. Your booking PNR ${b.pnr} is eligible for a full refund.`,
          relatedBooking: b._id,
        }));
        await Notification.insertMany(notifications);
      }
    }

    res.json({ success: true, message: "Train updated successfully", train });
  } catch (err) {
    next(err);
  }
};

// @route  DELETE /api/trains/:id  [Admin]
const deleteTrain = async (req, res, next) => {
  try {
    const train = await Train.findByIdAndDelete(req.params.id);
    if (!train) return res.status(404).json({ success: false, message: "Train not found" });
    res.json({ success: true, message: "Train deleted successfully" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllTrains,
  getTrainById,
  getTrainAvailability,
  getTrainStatus,
  createTrain,
  updateTrain,
  deleteTrain,
};
