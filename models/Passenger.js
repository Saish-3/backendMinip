const mongoose = require("mongoose");

const passengerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Passenger name is required"],
      trim: true,
    },
    age: {
      type: Number,
      required: [true, "Age is required"],
      min: [1, "Age must be at least 1"],
      max: [120, "Age cannot exceed 120"],
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: [true, "Gender is required"],
    },
    idType: {
      type: String,
      enum: ["Aadhaar", "PAN", "Passport", "Voter ID", "Driving License"],
      required: [true, "ID type is required"],
    },
    idNumber: {
      type: String,
      required: [true, "ID number is required"],
    },
    phone:     { type: String },
    isDefault: { type: Boolean, default: false },    // mark as default traveller
  },
  { timestamps: true }
);

module.exports = mongoose.model("Passenger", passengerSchema);
