/**
 * trainStatusSimulator.js
 *
 * Simulates a real-time train position by comparing current wall-clock time
 * against a train's scheduled stops. Adds a random (weighted-light) delay
 * to make it feel live.
 *
 * NOTE: This is a simulation only — for demo/assignment purposes.
 */

// Convert "HH:MM" string to total minutes since midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr || timeStr === "--") return null;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

// Convert minutes since midnight back to "HH:MM"
const minutesToTime = (minutes) => {
  if (minutes == null) return "--";
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Simulate current live status of a train.
 * @param {Object} train - Mongoose Train document
 * @returns {Object} status report
 */
const simulateTrainStatus = (train) => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // 30% chance of delay, otherwise on-time
  const delayMinutes = Math.random() < 0.3
    ? Math.floor(Math.random() * 45) + 5   // 5–50 min delay
    : 0;

  const stops = train.stops || [];
  let lastPassedStop = null;
  let nextStop       = null;
  let currentSegment = null;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const depMinutes = timeToMinutes(stop.departureTime);
    if (depMinutes == null) continue;

    const estimatedDep = depMinutes + delayMinutes;

    if (currentMinutes < estimatedDep) {
      // Train hasn't departed this stop yet
      nextStop = {
        stationCode:        stop.stationCode,
        stationName:        stop.stationName,
        platform:           stop.platform || 1,
        scheduledArrival:   stop.arrivalTime,
        estimatedArrival:   minutesToTime(timeToMinutes(stop.arrivalTime) + delayMinutes),
        scheduledDeparture: stop.departureTime,
        estimatedDeparture: minutesToTime(estimatedDep),
        distance:           stop.distance,
      };
      if (i > 0) {
        const prev = stops[i - 1];
        currentSegment = {
          from:     prev.stationName,
          to:       stop.stationName,
          distance: `${stop.distance - (prev.distance || 0)} km`,
        };
      }
      break;
    } else {
      lastPassedStop = stop;
    }
  }

  // Determine textual overall status
  const overallStatus =
    delayMinutes === 0
      ? "On Time"
      : delayMinutes < 15
      ? `Slightly Delayed (${delayMinutes} min)`
      : `Delayed by ${delayMinutes} min`;

  return {
    trainNumber:   train.trainNumber,
    trainName:     train.trainName,
    overallStatus,
    delayMinutes,
    currentSegment: currentSegment
      || (lastPassedStop
        ? `Arrived at ${lastPassedStop.stationName} (${lastPassedStop.stationCode})`
        : "Departed from source"),
    nextStop: nextStop || { message: "Train has reached its destination" },
    lastPassedStop: lastPassedStop
      ? {
          stationCode:        lastPassedStop.stationCode,
          stationName:        lastPassedStop.stationName,
          scheduledDeparture: lastPassedStop.departureTime,
          actualDeparture:    minutesToTime(
            (timeToMinutes(lastPassedStop.departureTime) || 0) + delayMinutes
          ),
        }
      : null,
    simulatedAt: now.toISOString(),
    disclaimer:  "⚠️  This is a simulated status for demonstration purposes only.",
  };
};

module.exports = { simulateTrainStatus };
