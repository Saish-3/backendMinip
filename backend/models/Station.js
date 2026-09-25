const mongoose = require("mongoose");

const stationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    stationName: { type: String, trim: true },
    code: { type: String, uppercase: true, trim: true },
    stationCode: { type: String, uppercase: true, trim: true },
    city: { type: String },
    state: { type: String },
    zone: { type: String, default: "Indian Railways" },
    platforms: { type: Number, default: 1 },
    isJunction: { type: Boolean, default: false },
    facilities: [{ type: String }],
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { timestamps: true, strict: false }
);

module.exports = mongoose.model("Station", stationSchema);
