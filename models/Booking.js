const mongoose = require("mongoose");

// Passenger on a booking (snapshot at time of booking)
const bookingPassengerSchema = new mongoose.Schema(
  {
    name:   { type: String, required: true },
    age:    { type: Number, required: true },
    gender: { type: String, required: true },
    seatNumber: { type: String },
    berthPreference: {
      type: String,
      enum: ["Lower", "Middle", "Upper", "Side Lower", "Side Upper", "No Preference"],
      default: "No Preference",
    },
    status: {
      type: String,
      enum: ["confirmed", "waiting", "cancelled"],
      default: "confirmed",
    },
  },
  { _id: false }
);

const fareSchema = new mongoose.Schema(
  {
    baseFare:   { type: Number, default: 0 },
    taxes:      { type: Number, default: 0 },   // 5% GST
    serviceFee: { type: Number, default: 0 },   // ₹30 per passenger
    totalFare:  { type: Number, default: 0 },
  },
  { _id: false }
);

// ─── Booking Schema ───────────────────────────────────────────────────────────

const bookingSchema = new mongoose.Schema(
  {
    pnr: {
      type: String,
      unique: true,
      uppercase: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    train: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Train",
      required: true,
    },
    // Denormalized for quick access (avoids $lookup on every PNR fetch)
    trainNumber: { type: String },
    trainName:   { type: String },

    passengers: [bookingPassengerSchema],

    journeyDate: { type: Date, required: true },
    fromStation: {
      code: { type: String, required: true },
      name: { type: String },
    },
    toStation: {
      code: { type: String, required: true },
      name: { type: String },
    },
    travelClass: {
      type: String,
      enum: ["SL", "3A", "2A", "1A", "GN"],
      required: true,
    },
    fare: fareSchema,
    status: {
      type: String,
      enum: ["confirmed", "waiting", "cancelled"],
      default: "confirmed",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "paid",
    },
    bookingDate: { type: Date, default: Date.now },

    // Cancellation info (populated if cancelled)
    cancellationCharge: { type: Number, default: 0 },
    refundAmount:       { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-generate PNR: "PNR" + 7 random alphanumerics
bookingSchema.pre("save", function (next) {
  if (!this.pnr) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pnr = "PNR";
    for (let i = 0; i < 7; i++) {
      pnr += chars[Math.floor(Math.random() * chars.length)];
    }
    this.pnr = pnr;
  }
  next();
});

module.exports = mongoose.model("Booking", bookingSchema);
