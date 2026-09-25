/**
 * errorHandler — central Express error-handling middleware.
 * Must be registered LAST via app.use(errorHandler).
 * Normalises Mongoose, JWT and general errors into a consistent JSON shape.
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);

  let statusCode = err.statusCode || 500;
  let message    = err.message    || "Internal Server Error";

  // Mongoose: document validation failed
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join("; ");
  }

  // Mongoose: duplicate key (e.g. unique email / trainNumber)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `'${field}' already exists`;
  }

  // Mongoose: invalid ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ID format: '${err.value}'`;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token has expired — please log in again";
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Include stack trace only in development
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
