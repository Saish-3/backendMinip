const express = require("express");
const router  = express.Router();

const {
  getNotifications, markAsRead, markAllAsRead, deleteNotification,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/auth");

router.use(protect);

// Named routes before /:id
router.get("/",           getNotifications);
router.patch("/read-all", markAllAsRead);

router.patch("/:id/read", markAsRead);
router.delete("/:id",     deleteNotification);

module.exports = router;
