const mongoose = require("mongoose");

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const stopSchema = new mongoose.Schema(
  {
    stationCode: { type: String, uppercase: true },
    stationName: { type: String },
    arrivalTime:  { type: String, default: "--" },   // HH:MM (-- for source)
    departureTime:{ type: String, default: "--" },   // HH:MM
    day:          { type: Number, default: 1 },        // 1 = day 1 of journey
    distance:     { type: Number, default: 0 },        // km from source
    haltDuration: { type: Number, default: 2 },        // minutes
    platform:     { type: Number, default: 1 },
  },
  { _id: false }
);

const classConfigSchema = new mongoose.Schema(
  {
    className:  { type: String, enum: ["SL", "3A", "2A", "1A", "GN", "CC", "2S"], required: true },
    totalSeats: { type: Number, default: 0 },
    farePerSeat:{ type: Number, default: 500 },       // base fare in ₹
  },
  { _id: false }
);

// ─── Train Schema ─────────────────────────────────────────────────────────────

const trainSchema = new mongoose.Schema(
  {
    trainNumber: { type: String, uppercase: true },
    trainNo:     { type: mongoose.Schema.Types.Mixed },
    trainName:   { type: String, required: true, trim: true },
    type:        { type: String, default: "Express" },
    source:      { type: mongoose.Schema.Types.Mixed }, // string (e.g. "Delhi") or object { code, name }
    destination: { type: mongoose.Schema.Types.Mixed }, // string (e.g. "Mumbai") or object { code, name }
    departureTime: { type: String, default: "08:00" },
    arrivalTime:   { type: String, default: "20:00" },
    duration:      { type: String, default: "12h 00m" },
    totalDistance: { type: Number, default: 1000 },
    runningDays: {
      type: [String],
      default: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    stops:     [stopSchema],
    classes:   [classConfigSchema],
    totalSeats:     { type: Number },
    availableSeats: { type: Number },
    amenities: [{ type: String }],
    status: {
      type: String,
      enum: ["active", "cancelled", "maintenance"],
      default: "active",
    },
  },
  { timestamps: true, strict: false }
);

module.exports = mongoose.model("Train", trainSchema);
