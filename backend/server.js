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

const path = require("path");

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../frontend")));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",          authRoutes);
app.use("/api/trains",        trainRoutes);
app.use("/api/stations",      stationRoutes);
app.use("/api/passengers",    passengerRoutes);
app.use("/api/bookings",      bookingRoutes);
app.use("/api/pnr",           pnrRoutes);
app.use("/api/admin",         adminRoutes);
app.use("/api/notifications", notificationRoutes);

// ─── Quick Database Seed API ──────────────────────────────────────────────────
const seedDatabase = require("./seed");
app.post("/api/seed", async (req, res) => {
  try {
    const result = await seedDatabase();
    res.json({ success: true, message: "Database seeded successfully with demo data!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Health Check & API Docs ───────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
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

// Fallback for API 404
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route '${req.originalUrl}' not found`,
  });
});

// SPA fallback for HTML requests
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
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
