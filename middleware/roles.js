/**
 * authorize — role-based access control middleware factory
 * Usage: authorize("admin", "staff")
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not authorized for this resource. Required: [${roles.join(", ")}]`,
      });
    }

    next();
  };
};

module.exports = { authorize };
