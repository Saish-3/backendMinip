const Train        = require("../models/Train");
const Booking      = require("../models/Booking");
const Notification = require("../models/Notification");
const User         = require("../models/User");
const { getPaginationData, getSkip } = require("../utils/pagination");
const { simulateTrainStatus }        = require("../utils/trainStatusSimulator");

// Helper to normalize train object for frontend
const normalizeTrain = (t) => {
  const trainNumber = t.trainNumber || (t.trainNo ? String(t.trainNo) : "12001");
  const trainName = t.trainName || "Express Train";
  
  let sourceObj = { code: "SRC", name: "Origin" };
  if (typeof t.source === "string") {
    sourceObj = { code: t.source.substring(0, 4).toUpperCase(), name: t.source };
  } else if (typeof t.source === "object" && t.source) {
    sourceObj = {
      code: t.source.code || (t.source.name ? t.source.name.substring(0, 4).toUpperCase() : "SRC"),
      name: t.source.name || t.source.code || "Origin",
    };
  }

  let destObj = { code: "DST", name: "Destination" };
  if (typeof t.destination === "string") {
    destObj = { code: t.destination.substring(0, 4).toUpperCase(), name: t.destination };
  } else if (typeof t.destination === "object" && t.destination) {
    destObj = {
      code: t.destination.code || (t.destination.name ? t.destination.name.substring(0, 4).toUpperCase() : "DST"),
      name: t.destination.name || t.destination.code || "Destination",
    };
  }

  const classes = (t.classes && t.classes.length > 0) ? t.classes : [
    { className: "1A", totalSeats: Math.max(10, Math.round((t.totalSeats || 500) * 0.1)), farePerSeat: 3200 },
    { className: "2A", totalSeats: Math.max(20, Math.round((t.totalSeats || 500) * 0.2)), farePerSeat: 2100 },
    { className: "3A", totalSeats: t.availableSeats || Math.max(50, Math.round((t.totalSeats || 500) * 0.4)), farePerSeat: 1450 },
    { className: "SL", totalSeats: Math.max(80, Math.round((t.totalSeats || 500) * 0.3)), farePerSeat: 550 },
  ];

  const stops = (t.stops && t.stops.length > 0) ? t.stops : [
    { stationCode: sourceObj.code, stationName: sourceObj.name, arrivalTime: "--", departureTime: t.departureTime || "08:00", day: 1, platform: 1 },
    { stationCode: destObj.code, stationName: destObj.name, arrivalTime: t.arrivalTime || "20:00", departureTime: "--", day: 1, platform: 2 },
  ];

  return {
    ...t,
    trainNumber,
    trainName,
    type: t.type || "Express",
    source: sourceObj,
    destination: destObj,
    departureTime: t.departureTime || "08:00",
    arrivalTime: t.arrivalTime || "20:00",
    duration: t.duration || "12h 00m",
    totalDistance: t.totalDistance || 950,
    runningDays: t.runningDays || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    classes,
    stops,
    status: t.status || "active",
  };
};

// ─── GET all trains (search / filter / paginate) ──────────────────────────────
// @route  GET /api/trains
// @access Public
const getAllTrains = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, from, to, type, status, sort = "-createdAt" } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (type)   filter.type   = type;

    if (from) {
      filter.$or = filter.$or || [];
      const fromRegex = new RegExp(from, "i");
      filter.$or.push(
        { "source.code": { $regex: fromRegex } },
        { "source.name": { $regex: fromRegex } },
        { source: { $regex: fromRegex } }
      );
    }

    if (to) {
      const toRegex = new RegExp(to, "i");
      const toOr = [
        { "destination.code": { $regex: toRegex } },
        { "destination.name": { $regex: toRegex } },
        { destination: { $regex: toRegex } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: toOr }];
        delete filter.$or;
      } else {
        filter.$or = toOr;
      }
    }

    const total     = await Train.countDocuments(filter);
    const rawTrains = await Train.find(filter)
      .skip(getSkip(page, limit))
      .limit(parseInt(limit))
      .lean();

    const trains = rawTrains.map(normalizeTrain);

    res.json({ success: true, pagination: getPaginationData(page, limit, total), trains });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/trains/:id
// @access Public
const getTrainById = async (req, res, next) => {
  try {
    const rawTrain = await Train.findById(req.params.id).lean();
    if (!rawTrain) return res.status(404).json({ success: false, message: "Train not found" });
    res.json({ success: true, train: normalizeTrain(rawTrain) });
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
