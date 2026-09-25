const { validationResult } = require("express-validator");

/**
 * handleValidation — reads express-validator result and responds with errors if any.
 * Place this after an array of check() rules in a route definition.
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

module.exports = { handleValidation };
