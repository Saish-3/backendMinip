/**
 * Generates a unique PNR number.
 * Format: "PNR" + 7 random uppercase alphanumeric characters = 10 chars total.
 * @returns {string} e.g. "PNRA3K9MZQ2"
 */
const generatePNR = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pnr = "PNR";
  for (let i = 0; i < 7; i++) {
    pnr += chars[Math.floor(Math.random() * chars.length)];
  }
  return pnr;
};

module.exports = { generatePNR };
