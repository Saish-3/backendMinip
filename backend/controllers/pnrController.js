const Booking = require("../models/Booking");

/**
 * @desc   Search booking by PNR number
 * @route  GET /api/pnr/:pnr
 * @access Public
 */
const searchByPNR = async (req, res, next) => {
  try {
    const pnr = req.params.pnr.toUpperCase();

    const booking = await Booking.findOne({ pnr }).populate(
      "train",
      "trainNumber trainName source destination departureTime arrivalTime stops type amenities"
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: `No booking found with PNR: ${pnr}`,
      });
    }

    res.json({
      success: true,
      booking: {
        pnr:         booking.pnr,
        status:      booking.status,
        trainNumber: booking.trainNumber,
        trainName:   booking.trainName,
        journeyDate: booking.journeyDate,
        fromStation: booking.fromStation,
        toStation:   booking.toStation,
        travelClass: booking.travelClass,
        passengers:  booking.passengers,
        fare:        booking.fare,
        bookingDate: booking.bookingDate,
        paymentStatus: booking.paymentStatus,
        train:       booking.train,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { searchByPNR };
