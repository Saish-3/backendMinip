const mongoose = require("mongoose");

const cancellationSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    pnr: { type: String, required: true, uppercase: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason:             { type: String, default: "Cancelled by user" },
    cancellationCharge: { type: Number, default: 0 },
    refundAmount:       { type: Number, default: 0 },
    refundStatus: {
      type: String,
      enum: ["pending", "processed", "failed"],
      default: "pending",
    },
    cancelledAt:  { type: Date, default: Date.now },
    processedAt:  { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cancellation", cancellationSchema);
