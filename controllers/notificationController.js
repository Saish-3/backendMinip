const Notification = require("../models/Notification");
const { getPaginationData, getSkip } = require("../utils/pagination");

// @route  GET /api/notifications?unreadOnly=true&page=&limit=
// @access Private
const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const filter = { user: req.user.id };
    if (unreadOnly === "true") filter.isRead = false;

    const [total, unreadCount, notifications] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user.id, isRead: false }),
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(getSkip(page, limit))
        .limit(parseInt(limit)),
    ]);

    res.json({
      success: true,
      unreadCount,
      pagination: getPaginationData(page, limit, total),
      notifications,
    });
  } catch (err) {
    next(err);
  }
};

// @route  PATCH /api/notifications/:id/read
// @access Private
const markAsRead = async (req, res, next) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!n) return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true, notification: n });
  } catch (err) {
    next(err);
  }
};

// @route  PATCH /api/notifications/read-all
// @access Private
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ success: true, message: `${result.modifiedCount} notification(s) marked as read` });
  } catch (err) {
    next(err);
  }
};

// @route  DELETE /api/notifications/:id
// @access Private
const deleteNotification = async (req, res, next) => {
  try {
    const n = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!n) return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    next(err);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification };
