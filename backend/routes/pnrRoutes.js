const express = require("express");
const router  = express.Router();
const { searchByPNR } = require("../controllers/pnrController");

// Public PNR search
router.get("/:pnr", searchByPNR);

module.exports = router;
