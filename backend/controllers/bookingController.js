const Booking      = require("../models/Booking");
const Cancellation = require("../models/Cancellation");
const Train        = require("../models/Train");
const Notification = require("../models/Notification");
const { getPaginationData, getSkip } = require("../utils/pagination");
const { generatePNR } = require("../utils/pnrGenerator");

// ─── Create booking ────────────────────────────────────────────────────────────
// @route  POST /api/bookings
// @access Private
const createBooking = async (req, res, next) => {
  try {
    const { trainId, journeyDate, fromStation, toStation, travelClass, passengers } = req.body;

    if (!trainId || !journeyDate || !travelClass || !passengers?.length) {
      return res.status(400).json({
        success: false,
        message: "trainId, journeyDate, travelClass and at least one passenger are required",
      });
    }

    const train = await Train.findById(trainId);
    if (!train) return res.status(404).json({ success: false, message: "Train not found" });
    if (train.status !== "active") {
      return res.status(400).json({ success: false, message: `Train is currently ${train.status}` });
    }

    // Find class config
    const classInfo = train.classes.find((c) => c.className === travelClass);
    if (!classInfo || classInfo.totalSeats === 0) {
      return res.status(400).json({
        success: false,
        message: `Class '${travelClass}' is not available on this train`,
      });
    }

    // Count booked seats on this date using $group
    const jDate      = new Date(journeyDate);
    const startOfDay = new Date(jDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(jDate); endOfDay.setHours(23, 59, 59, 999);

    const bookedAgg = await Booking.aggregate([
      {
        $match: {
          train: train._id,
          travelClass,
          journeyDate: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ["confirmed", "waiting"] },
        },
      },
      { $group: { _id: null, count: { $sum: { $size: "$passengers" } } } },
    ]);

    const booked    = bookedAgg.length > 0 ? bookedAgg[0].count : 0;
    const available = classInfo.totalSeats - booked;

    if (available < passengers.length) {
      return res.status(400).json({
        success: false,
        message: `Only ${available} seat(s) available in ${travelClass}. Requested: ${passengers.length}`,
      });
    }

    // Fare calculation
    const baseFare   = classInfo.farePerSeat * passengers.length;
    const taxes      = Math.round(baseFare * 0.05);           // 5% GST
    const serviceFee = 30 * passengers.length;                // ₹30/passenger
    const totalFare  = baseFare + taxes + serviceFee;

    // Assign seat numbers
    const passengersWithSeats = passengers.map((p, i) => ({
      ...p,
      seatNumber: `${travelClass}-${booked + i + 1}`,
      status: "confirmed",
    }));

    const booking = await Booking.create({
      pnr:         generatePNR(),
      user:        req.user.id,
      train:       train._id,
      trainNumber: train.trainNumber,
      trainName:   train.trainName,
      passengers:  passengersWithSeats,
      journeyDate: jDate,
      fromStation: {
        code: (fromStation?.code || train.source.code).toUpperCase(),
        name:  fromStation?.name || train.source.name,
      },
      toStation: {
        code: (toStation?.code || train.destination.code).toUpperCase(),
        name:  toStation?.name || train.destination.name,
      },
      travelClass,
      fare: { baseFare, taxes, serviceFee, totalFare },
      status:        "confirmed",
      paymentStatus: "paid",
    });

    // Notify user
    await Notification.create({
      user:           req.user.id,
      type:           "booking_confirmed",
      title:          "🎫 Booking Confirmed!",
      message:        `PNR ${booking.pnr} | ${train.trainName} | ${jDate.toDateString()} | ${travelClass} | ₹${totalFare}`,
      relatedBooking: booking._id,
    });

    res.status(201).json({ success: true, message: "Booking confirmed successfully", booking });
  } catch (err) {
    next(err);
  }
};

// ─── My bookings (paginated) ──────────────────────────────────────────────────
// @route  GET /api/bookings/my?status=&page=&limit=
// @access Private
const getMyBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = { user: req.user.id };
    if (status) filter.status = status;

    const total    = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .populate("train", "trainNumber trainName source destination departureTime arrivalTime type")
      .sort({ createdAt: -1 })
      .skip(getSkip(page, limit))
      .limit(parseInt(limit));

    res.json({ success: true, pagination: getPaginationData(page, limit, total), bookings });
  } catch (err) {
    next(err);
  }
};

// ─── Journey history (past journeys) ─────────────────────────────────────────
// @route  GET /api/bookings/history
// @access Private
const getJourneyHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const filter = { user: req.user.id, journeyDate: { $lt: new Date() } };

    const total    = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .populate("train", "trainNumber trainName type")
      .sort({ journeyDate: -1 })
      .skip(getSkip(page, limit))
      .limit(parseInt(limit));

    res.json({ success: true, pagination: getPaginationData(page, limit, total), bookings });
  } catch (err) {
    next(err);
  }
};

// ─── Single booking ───────────────────────────────────────────────────────────
// @route  GET /api/bookings/:id
// @access Private
const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate(
      "train",
      "trainNumber trainName source destination stops departureTime arrivalTime type amenities"
    );
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    // Passengers can only see their own; admin/staff can see all
    if (
      booking.user.toString() !== req.user.id &&
      !["admin", "staff"].includes(req.user.role)
    ) {
      return res.status(403).json({ success: false, message: "Not authorized to view this booking" });
    }

    res.json({ success: true, booking });
  } catch (err) {
    next(err);
  }
};

// ─── Cancel booking ───────────────────────────────────────────────────────────
// @route  POST /api/bookings/:id/cancel
// @access Private
const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (
      booking.user.toString() !== req.user.id &&
      !["admin", "staff"].includes(req.user.role)
    ) {
      return res.status(403).json({ success: false, message: "Not authorized to cancel this booking" });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Booking is already cancelled" });
    }

    // Cancellation charge based on hours before journey
    const hoursLeft = (new Date(booking.journeyDate) - new Date()) / 36e5;
    let refundPct   = 0.9;   // default >48 hrs: 10% charge
    if      (hoursLeft < 4)  refundPct = 0;     // no refund
    else if (hoursLeft < 12) refundPct = 0.5;
    else if (hoursLeft < 48) refundPct = 0.75;

    const refundAmount       = Math.round(booking.fare.totalFare * refundPct);
    const cancellationCharge = booking.fare.totalFare - refundAmount;

    booking.status             = "cancelled";
    booking.paymentStatus      = "refunded";
    booking.cancellationCharge = cancellationCharge;
    booking.refundAmount       = refundAmount;
    await booking.save();

    const cancellation = await Cancellation.create({
      booking:            booking._id,
      pnr:                booking.pnr,
      user:               req.user.id,
      reason:             req.body.reason || "Cancelled by user",
      cancellationCharge,
      refundAmount,
      refundStatus:       "pending",
    });

    await Notification.create({
      user:           req.user.id,
      type:           "booking_cancelled",
      title:          "Booking Cancelled",
      message:        `PNR ${booking.pnr} cancelled. Refund of ₹${refundAmount} will be credited in 5-7 business days.`,
      relatedBooking: booking._id,
    });

    res.json({
      success: true,
      message:      "Booking cancelled successfully",
      cancellation: {
        pnr:                booking.pnr,
        cancellationCharge,
        refundAmount,
        refundStatus:       "pending",
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── All bookings [Admin / Staff] with $lookup ────────────────────────────────
// @route  GET /api/bookings?status=&trainNumber=&date=&page=&limit=
// @access Private [Admin, Staff]
const getAllBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, trainNumber, date } = req.query;

    const matchStage = {};
    if (status)      matchStage.status      = status;
    if (trainNumber) matchStage.trainNumber = trainNumber.toUpperCase();
    if (date) {
      const d   = new Date(date);
      const s   = new Date(d); s.setHours(0, 0, 0, 0);
      const e   = new Date(d); e.setHours(23, 59, 59, 999);
      matchStage.journeyDate = { $gte: s, $lte: e };
    }

    const pipeline = [
      { $match: matchStage },
      // $lookup: join users collection
      {
        $lookup: {
          from:     "users",
          localField:   "user",
          foreignField: "_id",
          as:       "user",
          pipeline: [{ $project: { name: 1, email: 1, phone: 1 } }],
        },
      },
      { $unwind: "$user" },
      // $lookup: join trains collection
      {
        $lookup: {
          from:     "trains",
          localField:   "train",
          foreignField: "_id",
          as:       "train",
          pipeline: [{ $project: { trainNumber: 1, trainName: 1, type: 1 } }],
        },
      },
      { $unwind: { path: "$train", preserveNullAndEmpty: true } },
      { $sort: { createdAt: -1 } },
    ];

    const countResult = await Booking.aggregate([...pipeline, { $count: "total" }]);
    const total       = countResult[0]?.total || 0;

    pipeline.push({ $skip: getSkip(page, limit) }, { $limit: parseInt(limit) });
    const bookings = await Booking.aggregate(pipeline);

    res.json({ success: true, pagination: getPaginationData(page, limit, total), bookings });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getJourneyHistory,
  getBookingById,
  cancelBooking,
  getAllBookings,
};
