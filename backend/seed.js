require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Station = require("./models/Station");
const Train = require("./models/Train");
const Passenger = require("./models/Passenger");
const Booking = require("./models/Booking");
const Notification = require("./models/Notification");

const seedDatabase = async () => {
  try {
    console.log("🌱 Connecting to database...");
    await connectDB();

    console.log("🧹 Clearing old collections...");
    await Promise.all([
      User.deleteMany({}),
      Station.deleteMany({}),
      Train.deleteMany({}),
      Passenger.deleteMany({}),
      Booking.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    console.log("👤 Creating seed users...");
    const [adminUser, staffUser, passengerUser] = await Promise.all([
      User.create({
        name: "Admin Officer",
        email: "admin@railway.gov.in",
        password: "Admin@123",
        role: "admin",
        phone: "9876543210",
      }),
      User.create({
        name: "Station Master Sharma",
        email: "staff@railway.gov.in",
        password: "Staff@123",
        role: "staff",
        phone: "9876543211",
      }),
      User.create({
        name: "Rahul Verma",
        email: "rahul@gmail.com",
        password: "Passenger@123",
        role: "passenger",
        phone: "9876543212",
      }),
    ]);

    console.log("🚉 Creating stations...");
    const stations = await Station.insertMany([
      { name: "New Delhi", code: "NDLS", city: "New Delhi", state: "Delhi", zone: "Northern Railway", platforms: 16, coordinates: { lat: 28.6143, lng: 77.2185 } },
      { name: "Chhatrapati Shivaji Maharaj Terminus", code: "CSTM", city: "Mumbai", state: "Maharashtra", zone: "Central Railway", platforms: 18, coordinates: { lat: 18.9401, lng: 72.8347 } },
      { name: "Howrah Junction", code: "HWH", city: "Kolkata", state: "West Bengal", zone: "Eastern Railway", platforms: 23, coordinates: { lat: 22.5847, lng: 88.3426 } },
      { name: "KSR Bengaluru City Junction", code: "SBC", city: "Bengaluru", state: "Karnataka", zone: "South Western Railway", platforms: 10, coordinates: { lat: 12.9774, lng: 77.5713 } },
      { name: "MGR Chennai Central", code: "MAS", city: "Chennai", state: "Tamil Nadu", zone: "Southern Railway", platforms: 15, coordinates: { lat: 13.0827, lng: 80.2707 } },
      { name: "Ahmedabad Junction", code: "ADI", city: "Ahmedabad", state: "Gujarat", zone: "Western Railway", platforms: 12, coordinates: { lat: 23.0225, lng: 72.5714 } },
      { name: "Patna Junction", code: "PNBE", city: "Patna", state: "Bihar", zone: "East Central Railway", platforms: 10, coordinates: { lat: 25.6022, lng: 85.1376 } },
      { name: "Kanpur Central", code: "CNB", city: "Kanpur", state: "Uttar Pradesh", zone: "North Central Railway", platforms: 10, coordinates: { lat: 26.4547, lng: 80.3507 } },
    ]);

    console.log("🚆 Creating trains...");
    const trains = await Train.insertMany([
      {
        trainNumber: "12952",
        trainName: "Mumbai Rajdhani Express",
        type: "Rajdhani",
        source: { code: "NDLS", name: "New Delhi" },
        destination: { code: "CSTM", name: "Chhatrapati Shivaji Maharaj Terminus" },
        departureTime: "16:55",
        arrivalTime: "08:35",
        duration: "15h 40m",
        totalDistance: 1384,
        runningDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        amenities: ["WiFi", "Pantry", "AC", "Bedroll", "Charging Points"],
        status: "active",
        classes: [
          { className: "1A", totalSeats: 24, farePerSeat: 4200 },
          { className: "2A", totalSeats: 96, farePerSeat: 2650 },
          { className: "3A", totalSeats: 240, farePerSeat: 1850 },
        ],
        stops: [
          { stationCode: "NDLS", stationName: "New Delhi", arrivalTime: "--", departureTime: "16:55", day: 1, distance: 0, haltDuration: 0, platform: 3 },
          { stationCode: "CNB", stationName: "Kanpur Central", arrivalTime: "21:30", departureTime: "21:35", day: 1, distance: 440, haltDuration: 5, platform: 2 },
          { stationCode: "ADI", stationName: "Ahmedabad Junction", arrivalTime: "04:10", departureTime: "04:20", day: 2, distance: 980, haltDuration: 10, platform: 4 },
          { stationCode: "CSTM", stationName: "Chhatrapati Shivaji Maharaj Terminus", arrivalTime: "08:35", departureTime: "--", day: 2, distance: 1384, haltDuration: 0, platform: 1 },
        ],
      },
      {
        trainNumber: "22436",
        trainName: "Vande Bharat Express",
        type: "Superfast",
        source: { code: "NDLS", name: "New Delhi" },
        destination: { code: "PNBE", name: "Patna Junction" },
        departureTime: "06:00",
        arrivalTime: "14:00",
        duration: "8h 00m",
        totalDistance: 998,
        runningDays: ["Mon", "Tue", "Wed", "Fri", "Sat", "Sun"],
        amenities: ["WiFi", "Pantry", "AC", "Automatic Doors", "GPS Display", "CCTV"],
        status: "active",
        classes: [
          { className: "1A", totalSeats: 52, farePerSeat: 3100 },
          { className: "3A", totalSeats: 480, farePerSeat: 1650 },
        ],
        stops: [
          { stationCode: "NDLS", stationName: "New Delhi", arrivalTime: "--", departureTime: "06:00", day: 1, distance: 0, haltDuration: 0, platform: 1 },
          { stationCode: "CNB", stationName: "Kanpur Central", arrivalTime: "10:10", departureTime: "10:15", day: 1, distance: 440, haltDuration: 5, platform: 1 },
          { stationCode: "PNBE", stationName: "Patna Junction", arrivalTime: "14:00", departureTime: "--", day: 1, distance: 998, haltDuration: 0, platform: 3 },
        ],
      },
      {
        trainNumber: "12002",
        trainName: "Bhopal Shatabdi Express",
        type: "Shatabdi",
        source: { code: "NDLS", name: "New Delhi" },
        destination: { code: "CNB", name: "Kanpur Central" },
        departureTime: "06:15",
        arrivalTime: "11:50",
        duration: "5h 35m",
        totalDistance: 440,
        runningDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        amenities: ["WiFi", "Pantry", "AC", "Meals Included"],
        status: "active",
        classes: [
          { className: "1A", totalSeats: 46, farePerSeat: 1950 },
          { className: "3A", totalSeats: 360, farePerSeat: 920 },
        ],
        stops: [
          { stationCode: "NDLS", stationName: "New Delhi", arrivalTime: "--", departureTime: "06:15", day: 1, distance: 0, haltDuration: 0, platform: 2 },
          { stationCode: "CNB", stationName: "Kanpur Central", arrivalTime: "11:50", departureTime: "--", day: 1, distance: 440, haltDuration: 0, platform: 5 },
        ],
      },
      {
        trainNumber: "12246",
        trainName: "Yesvantpur Duronto Express",
        type: "Superfast",
        source: { code: "HWH", name: "Howrah Junction" },
        destination: { code: "SBC", name: "KSR Bengaluru City Junction" },
        departureTime: "10:50",
        arrivalTime: "16:00",
        duration: "29h 10m",
        totalDistance: 1945,
        runningDays: ["Tue", "Thu", "Fri", "Sun"],
        amenities: ["Pantry", "AC", "Bedroll"],
        status: "active",
        classes: [
          { className: "1A", totalSeats: 24, farePerSeat: 4850 },
          { className: "2A", totalSeats: 96, farePerSeat: 3200 },
          { className: "3A", totalSeats: 320, farePerSeat: 2150 },
          { className: "SL", totalSeats: 450, farePerSeat: 820 },
        ],
        stops: [
          { stationCode: "HWH", stationName: "Howrah Junction", arrivalTime: "--", departureTime: "10:50", day: 1, distance: 0, haltDuration: 0, platform: 9 },
          { stationCode: "MAS", stationName: "MGR Chennai Central", arrivalTime: "07:15", departureTime: "07:35", day: 2, distance: 1650, haltDuration: 20, platform: 2 },
          { stationCode: "SBC", stationName: "KSR Bengaluru City Junction", arrivalTime: "16:00", departureTime: "--", day: 2, distance: 1945, haltDuration: 0, platform: 4 },
        ],
      },
      {
        trainNumber: "12622",
        trainName: "Tamil Nadu Superfast Express",
        type: "Superfast",
        source: { code: "NDLS", name: "New Delhi" },
        destination: { code: "MAS", name: "MGR Chennai Central" },
        departureTime: "21:05",
        arrivalTime: "06:15",
        duration: "33h 10m",
        totalDistance: 2182,
        runningDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        amenities: ["Pantry", "AC", "Charging Points"],
        status: "active",
        classes: [
          { className: "1A", totalSeats: 20, farePerSeat: 5100 },
          { className: "2A", totalSeats: 80, farePerSeat: 3450 },
          { className: "3A", totalSeats: 300, farePerSeat: 2350 },
          { className: "SL", totalSeats: 500, farePerSeat: 890 },
          { className: "GN", totalSeats: 200, farePerSeat: 350 },
        ],
        stops: [
          { stationCode: "NDLS", stationName: "New Delhi", arrivalTime: "--", departureTime: "21:05", day: 1, distance: 0, haltDuration: 0, platform: 4 },
          { stationCode: "CNB", stationName: "Kanpur Central", arrivalTime: "02:10", departureTime: "02:18", day: 2, distance: 440, haltDuration: 8, platform: 2 },
          { stationCode: "MAS", stationName: "MGR Chennai Central", arrivalTime: "06:15", departureTime: "--", day: 3, distance: 2182, haltDuration: 0, platform: 1 },
        ],
      },
    ]);

    console.log("👥 Creating sample passengers...");
    const savedPassenger = await Passenger.create({
      user: passengerUser._id,
      name: "Rahul Verma",
      age: 28,
      gender: "Male",
      idType: "Aadhaar",
      idNumber: "XXXXXXXX4321",
    });

    console.log("🎫 Creating sample bookings...");
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 3);

    const booking = await Booking.create({
      user: passengerUser._id,
      train: trains[0]._id,
      pnr: "PNR" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      trainNumber: trains[0].trainNumber,
      trainName: trains[0].trainName,
      fromStation: { code: "NDLS", name: "New Delhi" },
      toStation: { code: "CSTM", name: "Chhatrapati Shivaji Maharaj Terminus" },
      journeyDate: bookingDate,
      travelClass: "3A",
      fare: {
        baseFare: 1850,
        taxes: 92.5,
        serviceFee: 30,
        totalFare: 1972.5,
      },
      status: "confirmed",
      passengers: [
        {
          name: "Rahul Verma",
          age: 28,
          gender: "Male",
          seatNumber: "B3-24",
          berthPreference: "Lower",
          status: "confirmed",
        },
      ],
      paymentStatus: "paid",
      paymentMethod: "UPI",
      transactionId: "TXN_" + Date.now(),
    });

    console.log("🔔 Creating sample notifications...");
    await Notification.create({
      user: passengerUser._id,
      type: "booking_confirmed",
      title: "Booking Confirmed!",
      message: `Your booking for ${trains[0].trainName} (${trains[0].trainNumber}) with PNR ${booking.pnr} is confirmed.`,
      relatedBooking: booking._id,
    });

    console.log("\n✅ Database seeded successfully!");
    console.log("──────────────────────────────────────────────────");
    console.log("Admin Login:     admin@railway.gov.in / Admin@123");
    console.log("Staff Login:     staff@railway.gov.in / Staff@123");
    console.log("Passenger Login: rahul@gmail.com      / Passenger@123");
    console.log("Sample PNR:     ", booking.pnr);
    console.log("──────────────────────────────────────────────────\n");

    return { success: true, message: "Database seeded successfully" };
  } catch (err) {
    console.error("❌ Seeding error:", err);
    throw err;
  }
};

// Run directly if called from CLI
if (require.main === module) {
  seedDatabase().then(() => {
    mongoose.connection.close();
    process.exit(0);
  }).catch(() => {
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = seedDatabase;
