const mongoose = require("mongoose");

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const stopSchema = new mongoose.Schema(
  {
    stationCode: { type: String, required: true, uppercase: true },
    stationName: { type: String, required: true },
    arrivalTime:  { type: String, default: "--" },   // HH:MM (-- for source)
    departureTime:{ type: String, required: true },   // HH:MM
    day:          { type: Number, default: 1 },        // 1 = day 1 of journey
    distance:     { type: Number, default: 0 },        // km from source
    haltDuration: { type: Number, default: 2 },        // minutes
    platform:     { type: Number, default: 1 },
  },
  { _id: false }
);

const classConfigSchema = new mongoose.Schema(
  {
    className:  { type: String, enum: ["SL", "3A", "2A", "1A", "GN"], required: true },
    totalSeats: { type: Number, default: 0 },
    farePerSeat:{ type: Number, required: true },       // base fare in ₹
  },
  { _id: false }
);

// ─── Train Schema ─────────────────────────────────────────────────────────────

const trainSchema = new mongoose.Schema(
  {
    trainNumber: {
      type: String,
      required: [true, "Train number is required"],
      unique: true,
      uppercase: true,
      match: [/^\d{5}$/, "Train number must be exactly 5 digits"],
    },
    trainName: {
      type: String,
      required: [true, "Train name is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["Express", "Superfast", "Rajdhani", "Shatabdi", "Intercity", "Local"],
      default: "Express",
    },
    source: {
      code: { type: String, required: true, uppercase: true },
      name: { type: String, required: true },
    },
    destination: {
      code: { type: String, required: true, uppercase: true },
      name: { type: String, required: true },
    },
    departureTime: { type: String, required: true },   // HH:MM from source
    arrivalTime:   { type: String, required: true },   // HH:MM at destination
    duration:      { type: String },                    // e.g. "12h 30m"
    totalDistance: { type: Number, required: true },    // km
    runningDays: {
      type: [String],
      enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      default: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    stops:     [stopSchema],
    classes:   [classConfigSchema],
    amenities: [{ type: String }],                     // ["WiFi", "Pantry", "AC"]
    status: {
      type: String,
      enum: ["active", "cancelled", "maintenance"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Train", trainSchema);
