require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes         = require("./routes/authRoutes");
const trainRoutes        = require("./routes/trainRoutes");
const stationRoutes      = require("./routes/stationRoutes");
const passengerRoutes    = require("./routes/passengerRoutes");
const bookingRoutes      = require("./routes/bookingRoutes");
const pnrRoutes          = require("./routes/pnrRoutes");
const adminRoutes        = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

// Connect to MongoDB
connectDB();

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",          authRoutes);
app.use("/api/trains",        trainRoutes);
app.use("/api/stations",      stationRoutes);
app.use("/api/passengers",    passengerRoutes);
app.use("/api/bookings",      bookingRoutes);
app.use("/api/pnr",           pnrRoutes);
app.use("/api/admin",         adminRoutes);
app.use("/api/notifications", notificationRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "🚂 Smart Railway Operations API is running",
    version: "1.0.0",
    endpoints: {
      auth:          "POST /api/auth/register | POST /api/auth/login | GET /api/auth/me",
      trains:        "GET/POST /api/trains | GET /api/trains/:id/availability | GET /api/trains/:id/status",
      stations:      "GET/POST /api/stations",
      passengers:    "GET/POST/PUT/DELETE /api/passengers",
      bookings:      "POST /api/bookings | GET /api/bookings/my | GET /api/bookings/history",
      pnr:           "GET /api/pnr/:pnr",
      admin:         "GET /api/admin/dashboard | GET /api/admin/analytics/revenue",
      notifications: "GET /api/notifications | PATCH /api/notifications/read-all",
    },
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route '${req.originalUrl}' not found`,
  });
});

// ─── Central Error Handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚂  Smart Railway API  →  http://localhost:${PORT}`);
  console.log("─────────────────────────────────────────────────");
  console.log("  Auth          POST  /api/auth/register|login");
  console.log("  Trains        GET   /api/trains?from=NDLS&to=CSTM");
  console.log("  Availability  GET   /api/trains/:id/availability?date=");
  console.log("  Live Status   GET   /api/trains/:id/status");
  console.log("  PNR Search    GET   /api/pnr/:pnr");
  console.log("  Bookings      POST  /api/bookings");
  console.log("  Admin Dash    GET   /api/admin/dashboard");
  console.log("─────────────────────────────────────────────────\n");
});

module.exports = app;
