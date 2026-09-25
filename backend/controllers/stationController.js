const Station = require("../models/Station");
const { getPaginationData, getSkip } = require("../utils/pagination");

// @route  GET /api/stations?search=&state=&zone=&page=&limit=
// @access Public
const getAllStations = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, state, zone } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
      ];
    }
    if (state) filter.state = { $regex: state, $options: "i" };
    if (zone)  filter.zone  = zone;

    const total    = await Station.countDocuments(filter);
    const rawStations = await Station.find(filter)
      .skip(getSkip(page, limit))
      .limit(parseInt(limit))
      .lean();

    const stations = rawStations.map((stn) => {
      const name = stn.name || stn.stationName || stn.city || "Unknown Station";
      const code = stn.code || stn.stationCode || (stn.city ? stn.city.substring(0, 4).toUpperCase() : "STN");
      return {
        ...stn,
        name,
        code,
        city: stn.city || name,
        state: stn.state || "",
        zone: stn.zone || "Indian Railways",
        platforms: stn.platforms || 1,
      };
    });

    res.json({ success: true, pagination: getPaginationData(page, limit, total), stations });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/stations/:id
// @access Public
const getStationById = async (req, res, next) => {
  try {
    const station = await Station.findById(req.params.id);
    if (!station) return res.status(404).json({ success: false, message: "Station not found" });
    res.json({ success: true, station });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/stations  [Admin]
const createStation = async (req, res, next) => {
  try {
    const station = await Station.create(req.body);
    res.status(201).json({ success: true, message: "Station created successfully", station });
  } catch (err) {
    next(err);
  }
};

// @route  PUT /api/stations/:id  [Admin]
const updateStation = async (req, res, next) => {
  try {
    const station = await Station.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!station) return res.status(404).json({ success: false, message: "Station not found" });
    res.json({ success: true, message: "Station updated", station });
  } catch (err) {
    next(err);
  }
};

// @route  DELETE /api/stations/:id  [Admin]
const deleteStation = async (req, res, next) => {
  try {
    const station = await Station.findByIdAndDelete(req.params.id);
    if (!station) return res.status(404).json({ success: false, message: "Station not found" });
    res.json({ success: true, message: "Station deleted successfully" });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllStations, getStationById, createStation, updateStation, deleteStation };
