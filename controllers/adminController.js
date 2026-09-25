const User         = require("../models/User");
const Train        = require("../models/Train");
const Station      = require("../models/Station");
const Booking      = require("../models/Booking");
const Cancellation = require("../models/Cancellation");
const Notification = require("../models/Notification");
const { getPaginationData, getSkip } = require("../utils/pagination");

// ─── Dashboard Statistics ─────────────────────────────────────────────────────
// @route  GET /api/admin/dashboard
// @access Private [Admin, Staff]
const getDashboardStats = async (req, res, next) => {
  try {
    const now          = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      usersByRole,
      totalTrains,
      activeTrains,
      totalStations,
      totalBookings,
      todayBookings,
      monthBookings,
      revenueData,
      bookingsByStatus,
      recentBookings,
      topTrains,
      totalCancellations,
    ] = await Promise.all([
      User.countDocuments(),

      // $group: users by role
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),

      Train.countDocuments(),
      Train.countDocuments({ status: "active" }),
      Station.countDocuments(),
      Booking.countDocuments(),
      Booking.countDocuments({ createdAt: { $gte: startOfToday } }),
      Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),

      // $group: revenue totals
      Booking.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$fare.totalFare" },
            todayRevenue: {
              $sum: { $cond: [{ $gte: ["$createdAt", startOfToday] }, "$fare.totalFare", 0] },
            },
            monthRevenue: {
              $sum: { $cond: [{ $gte: ["$createdAt", startOfMonth] }, "$fare.totalFare", 0] },
            },
          },
        },
      ]),

      // $group: bookings by status
      Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

      // Recent 5 bookings with $lookup on users
      Booking.aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "users", localField: "user", foreignField: "_id", as: "user",
            pipeline: [{ $project: { name: 1, email: 1 } }],
          },
        },
        { $unwind: "$user" },
        { $project: { pnr: 1, trainName: 1, trainNumber: 1, travelClass: 1, status: 1, "fare.totalFare": 1, journeyDate: 1, user: 1 } },
      ]),

      // Top 5 trains by booking count ($group + $sort)
      Booking.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        {
          $group: {
            _id:           "$train",
            trainName:     { $first: "$trainName" },
            trainNumber:   { $first: "$trainNumber" },
            totalBookings: { $sum: 1 },
            totalRevenue:  { $sum: "$fare.totalFare" },
            passengers:    { $sum: { $size: "$passengers" } },
          },
        },
        { $sort: { totalBookings: -1 } },
        { $limit: 5 },
      ]),

      Cancellation.countDocuments(),
    ]);

    const rev = revenueData[0] || { totalRevenue: 0, todayRevenue: 0, monthRevenue: 0 };

    res.json({
      success: true,
      stats: {
        users: {
          total:  totalUsers,
          byRole: usersByRole.reduce((a, r) => ({ ...a, [r._id]: r.count }), {}),
        },
        trains:    { total: totalTrains, active: activeTrains, inactive: totalTrains - activeTrains },
        stations:  { total: totalStations },
        bookings: {
          total:         totalBookings,
          today:         todayBookings,
          thisMonth:     monthBookings,
          cancellations: totalCancellations,
          byStatus:      bookingsByStatus.reduce((a, s) => ({ ...a, [s._id]: s.count }), {}),
        },
        revenue: {
          total:     rev.totalRevenue  || 0,
          today:     rev.todayRevenue  || 0,
          thisMonth: rev.monthRevenue  || 0,
        },
        recentBookings,
        topTrains,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── All users (paginated + filtered) ────────────────────────────────────────
// @route  GET /api/admin/users
// @access Private [Admin, Staff]
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, search, isActive } = req.query;

    const filter = {};
    if (role)                      filter.role     = role;
    if (isActive !== undefined)    filter.isActive = isActive === "true";
    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(getSkip(page, limit))
      .limit(parseInt(limit));

    res.json({ success: true, pagination: getPaginationData(page, limit, total), users });
  } catch (err) {
    next(err);
  }
};

// @route  PATCH /api/admin/users/:id/toggle  [Admin]
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    user.isActive = !user.isActive;
    await user.save();
    res.json({
      success: true,
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Cancellations (with $lookup on users and bookings) ──────────────────────
// @route  GET /api/admin/cancellations
// @access Private [Admin, Staff]
const getAllCancellations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, refundStatus } = req.query;

    const matchStage = {};
    if (refundStatus) matchStage.refundStatus = refundStatus;

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users", localField: "user", foreignField: "_id", as: "user",
          pipeline: [{ $project: { name: 1, email: 1 } }],
        },
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: "bookings", localField: "booking", foreignField: "_id", as: "booking",
          pipeline: [{ $project: { pnr: 1, trainName: 1, journeyDate: 1, travelClass: 1 } }],
        },
      },
      { $unwind: { path: "$booking", preserveNullAndEmpty: true } },
      { $sort: { createdAt: -1 } },
    ];

    const countResult    = await Cancellation.aggregate([...pipeline, { $count: "total" }]);
    const total          = countResult[0]?.total || 0;
    pipeline.push({ $skip: getSkip(page, limit) }, { $limit: parseInt(limit) });
    const cancellations  = await Cancellation.aggregate(pipeline);

    res.json({ success: true, pagination: getPaginationData(page, limit, total), cancellations });
  } catch (err) {
    next(err);
  }
};

// @route  PATCH /api/admin/cancellations/:id/process-refund  [Admin]
const processRefund = async (req, res, next) => {
  try {
    const c = await Cancellation.findById(req.params.id);
    if (!c)                          return res.status(404).json({ success: false, message: "Record not found" });
    if (c.refundStatus === "processed") return res.status(400).json({ success: false, message: "Refund already processed" });

    c.refundStatus = "processed";
    c.processedAt  = new Date();
    await c.save();

    await Notification.create({
      user:           c.user,
      type:           "refund_processed",
      title:          "Refund Processed ✅",
      message:        `Your refund of ₹${c.refundAmount} for PNR ${c.pnr} has been processed successfully.`,
      relatedBooking: c.booking,
    });

    res.json({ success: true, message: "Refund processed", cancellation: c });
  } catch (err) {
    next(err);
  }
};

// ─── Revenue Analytics ($group + $sort) ──────────────────────────────────────
// @route  GET /api/admin/analytics/revenue?period=daily|monthly|yearly
// @access Private [Admin]
const getRevenueAnalytics = async (req, res, next) => {
  try {
    const { period = "monthly" } = req.query;

    const groupId =
      period === "daily"
        ? { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } }
        : period === "yearly"
        ? { year: { $year: "$createdAt" } }
        : { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } };

    const [revenueByPeriod, revenueByClass, revenueByRoute] = await Promise.all([
      Booking.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        {
          $group: {
            _id:        groupId,
            revenue:    { $sum: "$fare.totalFare" },
            bookings:   { $sum: 1 },
            passengers: { $sum: { $size: "$passengers" } },
          },
        },
        { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
        { $limit: 12 },
      ]),

      // Revenue by travel class
      Booking.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        {
          $group: {
            _id:      "$travelClass",
            revenue:  { $sum: "$fare.totalFare" },
            bookings: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
      ]),

      // Revenue by source→destination route
      Booking.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        {
          $group: {
            _id:      { from: "$fromStation.code", to: "$toStation.code" },
            revenue:  { $sum: "$fare.totalFare" },
            bookings: { $sum: 1 },
          },
        },
        { $sort: { bookings: -1 } },
        { $limit: 10 },
      ]),
    ]);

    res.json({
      success: true,
      analytics: { period, revenueByPeriod, revenueByClass, revenueByRoute },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Broadcast notification to all users of specific roles ──────────────────
// @route  POST /api/admin/notifications/broadcast  [Admin]
const broadcastNotification = async (req, res, next) => {
  try {
    const { title, message, type = "general", roles = ["passenger"] } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: "title and message are required" });
    }

    const users         = await User.find({ role: { $in: roles }, isActive: true }, "_id");
    const notifications = users.map((u) => ({ user: u._id, type, title, message }));
    await Notification.insertMany(notifications);

    res.json({ success: true, message: `Notification sent to ${notifications.length} user(s)` });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  toggleUserStatus,
  getAllCancellations,
  processRefund,
  getRevenueAnalytics,
  broadcastNotification,
};
