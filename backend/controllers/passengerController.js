const Passenger = require("../models/Passenger");

// @route  GET /api/passengers   [Private — own passengers only]
const getMyPassengers = async (req, res, next) => {
  try {
    const passengers = await Passenger.find({ user: req.user.id }).sort({ isDefault: -1, name: 1 });
    res.json({ success: true, count: passengers.length, passengers });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/passengers/:id
const getPassengerById = async (req, res, next) => {
  try {
    const passenger = await Passenger.findOne({ _id: req.params.id, user: req.user.id });
    if (!passenger) return res.status(404).json({ success: false, message: "Passenger not found" });
    res.json({ success: true, passenger });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/passengers
const createPassenger = async (req, res, next) => {
  try {
    const passenger = await Passenger.create({ ...req.body, user: req.user.id });
    res.status(201).json({ success: true, message: "Passenger profile created", passenger });
  } catch (err) {
    next(err);
  }
};

// @route  PUT /api/passengers/:id
const updatePassenger = async (req, res, next) => {
  try {
    const passenger = await Passenger.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!passenger) return res.status(404).json({ success: false, message: "Passenger not found" });
    res.json({ success: true, message: "Passenger updated", passenger });
  } catch (err) {
    next(err);
  }
};

// @route  DELETE /api/passengers/:id
const deletePassenger = async (req, res, next) => {
  try {
    const passenger = await Passenger.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!passenger) return res.status(404).json({ success: false, message: "Passenger not found" });
    res.json({ success: true, message: "Passenger deleted" });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMyPassengers, getPassengerById, createPassenger, updatePassenger, deletePassenger };
