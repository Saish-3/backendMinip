const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "booking_confirmed",
        "booking_cancelled",
        "train_delayed",
        "train_cancelled",
        "refund_processed",
        "general",
      ],
      default: "general",
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    relatedBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
