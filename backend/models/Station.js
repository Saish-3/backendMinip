const mongoose = require("mongoose");

const stationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Station name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Station code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    city:  { type: String, required: [true, "City is required"] },
    state: { type: String, required: [true, "State is required"] },
    zone:  { type: String },                          // e.g. "Central", "Northern"
    platforms:  { type: Number, default: 1 },
    isJunction: { type: Boolean, default: false },
    facilities: [{ type: String }],                   // ["Parking", "WiFi", "Food"]
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Station", stationSchema);
