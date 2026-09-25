/**
 * ==========================================================================
 * RAILPULSE PRO — FRONTEND SINGLE PAGE APPLICATION LOGIC
 * ==========================================================================
 */

const API_BASE = (window.location.port === "4000" || window.location.pathname.startsWith("/api"))
  ? "/api"
  : "http://localhost:4000/api";

// ─── Global State ─────────────────────────────────────────────────────────
const state = {
  token: localStorage.getItem("railpulse_token") || null,
  user: JSON.parse(localStorage.getItem("railpulse_user") || "null"),
  stations: [],
  trains: [],
  currentTab: "booking-tab",
  selectedTrainForBooking: null,
  selectedClassForBooking: null,
  bookingSubTab: "upcoming",
  samplePNR: "PNRVQSTSXX",
};

// ─── Initialization ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Set default journey date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateInput = document.getElementById("journey-date");
  if (dateInput) {
    dateInput.value = tomorrow.toISOString().split("T")[0];
    dateInput.min = new Date().toISOString().split("T")[0];
  }

  // Restore user session UI
  updateAuthUI();

  // Load baseline master data
  await loadStations();
  await loadAllTrains();
  await fetchSamplePNR();

  if (state.token) {
    loadNotifications();
  }

  // Close dropdowns on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) {
      document.querySelectorAll(".dropdown-menu").forEach((el) => el.classList.remove("show"));
    }
  });
});

// ─── API Helper Function ──────────────────────────────────────────────────
async function apiRequest(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

// ─── Toast Notifications ──────────────────────────────────────────────────
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || "ℹ️"}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── Navigation Tabs ──────────────────────────────────────────────────────
function switchTab(tabId) {
  state.currentTab = tabId;

  // Update Nav buttons
  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  // Update Tab content panels
  document.querySelectorAll(".tab-content").forEach((section) => {
    section.classList.toggle("active", section.id === tabId);
  });

  // Lazy-load data depending on tab
  if (tabId === "my-bookings-tab") {
    loadMyBookings();
  } else if (tabId === "passengers-tab") {
    loadPassengers();
  } else if (tabId === "admin-tab") {
    loadAdminDashboard();
  } else if (tabId === "tracking-tab") {
    const radarSelect = document.getElementById("radar-train-select");
    if (radarSelect && radarSelect.value) {
      loadTrainLiveStatus(radarSelect.value);
    }
  }
}

function toggleDropdown(dropdownId) {
  const el = document.getElementById(dropdownId);
  if (!el) return;
  const isShown = el.classList.contains("show");
  document.querySelectorAll(".dropdown-menu").forEach((d) => d.classList.remove("show"));
  if (!isShown) el.classList.add("show");
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.style.display = "none";
}

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.style.display = "flex";
}

// ─── Stations Management ──────────────────────────────────────────────────
async function loadStations() {
  try {
    const data = await apiRequest("/stations?limit=100");
    state.stations = data.stations || data.data || [];

    const fromSelect = document.getElementById("from-station");
    const toSelect = document.getElementById("to-station");

    if (!fromSelect || !toSelect) return;

    let optionsHtml = `<option value="">Select station...</option>`;
    state.stations.forEach((stn) => {
      optionsHtml += `<option value="${stn.code}">${stn.name} (${stn.code}) - ${stn.city}</option>`;
    });

    fromSelect.innerHTML = optionsHtml;
    toSelect.innerHTML = optionsHtml;
  } catch (err) {
    console.warn("Stations could not be loaded:", err.message);
  }
}

function swapStations() {
  const fromSelect = document.getElementById("from-station");
  const toSelect = document.getElementById("to-station");
  if (!fromSelect || !toSelect) return;
  const temp = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = temp;
}

function setQuickRoute(from, to) {
  const fromSelect = document.getElementById("from-station");
  const toSelect = document.getElementById("to-station");
  if (fromSelect) fromSelect.value = from;
  if (toSelect) toSelect.value = to;
  handleTrainSearch(new Event("submit"));
}

// ─── Trains Search & Availability ─────────────────────────────────────────
async function loadAllTrains() {
  try {
    const data = await apiRequest("/trains?limit=50");
    state.trains = data.trains || data.data || [];
    renderTrainsList();
    populateRadarSelect();
  } catch (err) {
    showToast(err.message || "Failed to load trains", "error");
  }
}

async function handleTrainSearch(e) {
  if (e && e.preventDefault) e.preventDefault();

  const from = document.getElementById("from-station")?.value;
  const to = document.getElementById("to-station")?.value;
  const date = document.getElementById("journey-date")?.value;
  const travelClass = document.getElementById("class-filter")?.value;

  let query = `/trains?`;
  if (from) query += `from=${encodeURIComponent(from)}&`;
  if (to) query += `to=${encodeURIComponent(to)}&`;
  if (date) query += `date=${encodeURIComponent(date)}&`;
  if (travelClass) query += `travelClass=${encodeURIComponent(travelClass)}&`;

  try {
    const listEl = document.getElementById("trains-list");
    if (listEl) {
      listEl.innerHTML = `<div class="skeleton-card"></div><div class="skeleton-card"></div>`;
    }

    const data = await apiRequest(query);
    state.trains = data.trains || data.data || [];

    const subTitle = document.getElementById("results-subtitle");
    if (subTitle) {
      subTitle.innerText = `Found ${state.trains.length} trains matching your route criteria`;
    }

    renderTrainsList();
    showToast(`Found ${state.trains.length} trains`, "success");
  } catch (err) {
    showToast(err.message || "Search failed", "error");
  }
}

function renderTrainsList() {
  const container = document.getElementById("trains-list");
  if (!container) return;

  if (!state.trains || state.trains.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🚆</div>
        <h3>No trains found for this route</h3>
        <p>Try searching between major hubs like NDLS (Delhi) and CSTM (Mumbai) or reset filters.</p>
        <button class="btn btn-glass btn-sm" onclick="loadAllTrains()">Show All Trains</button>
      </div>
    `;
    return;
  }

  const sortBy = document.getElementById("sort-trains")?.value || "departure";
  const sortedTrains = [...state.trains].sort((a, b) => {
    if (sortBy === "departure") return a.departureTime.localeCompare(b.departureTime);
    if (sortBy === "name") return a.trainName.localeCompare(b.trainName);
    return 0;
  });

  const selectedDate = document.getElementById("journey-date")?.value || new Date().toISOString().split("T")[0];

  container.innerHTML = sortedTrains.map((train) => {
    const daysArr = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const daysHtml = daysArr
      .map((d) => `<span class="${train.runningDays?.includes(d) ? 'runs' : ''}">${d}</span>`)
      .join(" ");

    const classesHtml = (train.classes || []).map((cls) => {
      return `
        <div class="class-card" onclick="openBookingModal('${train._id}', '${cls.className}')">
          <div class="class-top">
            <span class="class-name">${cls.className}</span>
            <span class="class-fare">₹${cls.farePerSeat}</span>
          </div>
          <div class="class-status available">
            <span>●</span> ${cls.totalSeats > 0 ? `AVL ${cls.totalSeats}` : 'REGRET'}
          </div>
        </div>
      `;
    }).join("");

    const amenitiesHtml = (train.amenities || [])
      .map((a) => `<span class="amenity-tag">${a}</span>`)
      .join("");

    return `
      <div class="train-card">
        <div class="train-header-row">
          <div class="train-identity">
            <div class="train-number-badge">${train.trainNumber}</div>
            <div class="train-title-wrap">
              <h3>${train.trainName} <span class="train-type-pill">${train.type || 'Express'}</span></h3>
              <div class="train-days">Runs on: ${daysHtml}</div>
            </div>
          </div>
          <div>
            <button class="btn btn-glass btn-sm" onclick="trackTrainDirect('${train._id}')">
              📡 Track Live
            </button>
          </div>
        </div>

        <div class="train-timeline">
          <div class="station-point">
            <span class="station-time">${train.departureTime}</span>
            <span class="station-code">${train.source?.code}</span>
            <span class="station-name">${train.source?.name}</span>
          </div>
          <div class="route-progress-wrap">
            <span class="route-duration">${train.duration || '--'}</span>
            <div class="route-line">
              <span class="route-train-icon">🚆</span>
            </div>
            <span class="route-distance">${train.totalDistance} km</span>
          </div>
          <div class="station-point dest">
            <span class="station-time">${train.arrivalTime}</span>
            <span class="station-code">${train.destination?.code}</span>
            <span class="station-name">${train.destination?.name}</span>
          </div>
        </div>

        <div class="class-matrix">
          ${classesHtml}
        </div>

        <div class="train-card-footer">
          <div class="amenities-list">
            ${amenitiesHtml || '<span>Standard Amenities</span>'}
          </div>
          <div>
            <span>Status: <strong style="color:#34d399; text-transform:uppercase;">${train.status}</strong></span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ─── Booking Modal & Flow ─────────────────────────────────────────────────
function openBookingModal(trainId, className) {
  if (!state.token) {
    showToast("Please login first to book train tickets", "info");
    openAuthModal("login");
    return;
  }

  const train = state.trains.find((t) => t._id === trainId);
  if (!train) return;

  state.selectedTrainForBooking = train;
  state.selectedClassForBooking = className;

  const classConfig = train.classes.find((c) => c.className === className);
  const journeyDate = document.getElementById("journey-date")?.value || new Date().toISOString().split("T")[0];

  // Populate train summary card in modal
  const summaryEl = document.getElementById("booking-train-summary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <div>
          <strong style="font-size:1.05rem; color:white;">${train.trainName} (${train.trainNumber})</strong>
          <div style="font-size:0.8rem; color:#94a3b8;">
            ${train.source?.code} (${train.departureTime}) → ${train.destination?.code} (${train.arrivalTime}) • ${train.duration}
          </div>
        </div>
        <div style="text-align:right;">
          <span class="role-pill passenger" style="font-size:0.8rem; font-weight:700;">Class: ${className}</span>
          <div style="font-size:0.85rem; color:#34d399; font-weight:700; margin-top:0.2rem;">₹${classConfig?.farePerSeat || 0} / seat</div>
        </div>
      </div>
    `;
  }

  // Reset passengers list with 1 default passenger (autofill if user profile exists)
  const container = document.getElementById("booking-passengers-container");
  if (container) {
    container.innerHTML = "";
    addPassengerRow(state.user?.name || "Rahul Verma", 28, "Male", "Lower");
  }

  updateFareCalculation();
  openModal("booking-modal");
}

function addPassengerRow(name = "", age = 25, gender = "Male", berth = "No Preference") {
  const container = document.getElementById("booking-passengers-container");
  if (!container) return;

  const rowCount = container.querySelectorAll(".booking-passenger-row").length;
  if (rowCount >= 6) {
    showToast("Maximum 6 passengers allowed per booking", "error");
    return;
  }

  const row = document.createElement("div");
  row.className = "booking-passenger-row";
  row.innerHTML = `
    <input type="text" class="form-input pass-name-input" placeholder="Passenger Full Name" value="${name}" required />
    <input type="number" class="form-input pass-age-input" min="1" max="120" placeholder="Age" value="${age}" required />
    <select class="form-input custom-select pass-gender-input">
      <option value="Male" ${gender === 'Male' ? 'selected' : ''}>Male</option>
      <option value="Female" ${gender === 'Female' ? 'selected' : ''}>Female</option>
      <option value="Other" ${gender === 'Other' ? 'selected' : ''}>Other</option>
    </select>
    <select class="form-input custom-select pass-berth-input">
      <option value="No Preference">No Pref</option>
      <option value="Lower" ${berth === 'Lower' ? 'selected' : ''}>Lower</option>
      <option value="Middle" ${berth === 'Middle' ? 'selected' : ''}>Middle</option>
      <option value="Upper" ${berth === 'Upper' ? 'selected' : ''}>Upper</option>
      <option value="Side Lower" ${berth === 'Side Lower' ? 'selected' : ''}>Side Lower</option>
      <option value="Side Upper" ${berth === 'Side Upper' ? 'selected' : ''}>Side Upper</option>
    </select>
    <button type="button" class="btn btn-danger btn-xs" onclick="removePassengerRow(this)" title="Remove Passenger">✕</button>
  `;

  container.appendChild(row);
  updateFareCalculation();
}

function removePassengerRow(btn) {
  const container = document.getElementById("booking-passengers-container");
  if (container.querySelectorAll(".booking-passenger-row").length <= 1) {
    showToast("At least 1 passenger is required", "error");
    return;
  }
  btn.closest(".booking-passenger-row").remove();
  updateFareCalculation();
}

function updateFareCalculation() {
  const train = state.selectedTrainForBooking;
  const className = state.selectedClassForBooking;
  if (!train || !className) return;

  const classConfig = train.classes.find((c) => c.className === className);
  const farePerSeat = classConfig ? classConfig.farePerSeat : 0;
  const passengerCount = document.querySelectorAll(".booking-passenger-row").length || 1;

  const baseFare = farePerSeat * passengerCount;
  const taxes = Math.round(baseFare * 0.05); // 5% GST
  const serviceFee = 30 * passengerCount;
  const total = baseFare + taxes + serviceFee;

  document.getElementById("fare-calc-seats").innerText = passengerCount;
  document.getElementById("fare-calc-rate").innerText = farePerSeat;
  document.getElementById("fare-calc-base").innerText = `₹${baseFare}`;
  document.getElementById("fare-calc-tax").innerText = `₹${taxes}`;
  document.getElementById("fare-calc-fee").innerText = `₹${serviceFee}`;
  document.getElementById("fare-calc-total").innerText = `₹${total}`;
}

async function handleCreateBooking(e) {
  e.preventDefault();

  const train = state.selectedTrainForBooking;
  const travelClass = state.selectedClassForBooking;
  const journeyDate = document.getElementById("journey-date")?.value || new Date().toISOString().split("T")[0];

  const rows = document.querySelectorAll(".booking-passenger-row");
  const passengers = [];

  rows.forEach((r) => {
    const name = r.querySelector(".pass-name-input")?.value?.trim();
    const age = parseInt(r.querySelector(".pass-age-input")?.value, 10);
    const gender = r.querySelector(".pass-gender-input")?.value;
    const berthPreference = r.querySelector(".pass-berth-input")?.value;

    if (name && age) {
      passengers.push({ name, age, gender, berthPreference });
    }
  });

  if (passengers.length === 0) {
    showToast("Please provide details for at least 1 passenger", "error");
    return;
  }

  const payload = {
    trainId: train._id,
    journeyDate,
    fromStation: train.source?.code,
    toStation: train.destination?.code,
    travelClass,
    passengers,
  };

  const submitBtn = document.getElementById("confirm-booking-btn");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await apiRequest("/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const booking = res.booking || res.data;
    closeModal("booking-modal");
    showToast(`🎉 Ticket Confirmed! PNR: ${booking?.pnr}`, "success");
    
    // Switch to PNR Status tab and view the generated ticket
    state.samplePNR = booking?.pnr;
    switchTab("pnr-tab");
    renderPNRTicket(booking);
    
    // Refresh notifications
    loadNotifications();
  } catch (err) {
    showToast(err.message || "Booking failed", "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ─── PNR Enquiry & Ticket Rendering ───────────────────────────────────────
async function fetchSamplePNR() {
  try {
    const data = await apiRequest("/pnr/PNRVQSTSXX").catch(() => null);
    const pnrVal = data?.booking?.pnr || data?.data?.pnr || data?.pnr;
    if (pnrVal) {
      state.samplePNR = pnrVal;
      const btn = document.getElementById("sample-pnr-btn");
      if (btn) btn.innerText = state.samplePNR;
    }
  } catch (_) {}
}

function useSamplePNR(pnr) {
  const input = document.getElementById("pnr-input");
  if (input) {
    input.value = pnr;
    handlePNRSearch(new Event("submit"));
  }
}

async function handlePNRSearch(e) {
  if (e && e.preventDefault) e.preventDefault();
  const pnr = document.getElementById("pnr-input")?.value?.trim()?.toUpperCase();

  if (!pnr) {
    showToast("Please enter a valid PNR number", "error");
    return;
  }

  try {
    const res = await apiRequest(`/pnr/${pnr}`);
    const booking = res.booking || res.data;
    if (booking) {
      renderPNRTicket(booking);
      showToast("PNR details fetched", "success");
    }
  } catch (err) {
    showToast(err.message || "PNR not found", "error");
    const container = document.getElementById("pnr-result-container");
    if (container) container.style.display = "none";
  }
}

function renderPNRTicket(booking) {
  const container = document.getElementById("pnr-result-container");
  if (!container || !booking) return;

  container.style.display = "block";
  const jDate = new Date(booking.journeyDate).toLocaleDateString("en-IN", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const passengersRows = (booking.passengers || []).map((p, idx) => `
    <tr>
      <td><strong>${idx + 1}.</strong> ${p.name} (${p.age}, ${p.gender})</td>
      <td><span class="role-pill passenger">${booking.travelClass}</span></td>
      <td><strong style="color:#60a5fa; font-family:var(--font-mono);">${p.seatNumber || 'Confirmed'}</strong></td>
      <td>${p.berthPreference || 'No Preference'}</td>
      <td><span class="ticket-status-badge ${booking.status}">${p.status || booking.status}</span></td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div class="e-ticket">
      <div class="ticket-header">
        <div>
          <span style="font-size:0.75rem; opacity:0.8; text-transform:uppercase; letter-spacing:0.05em;">Passenger Name Record</span>
          <div class="ticket-pnr-code">${booking.pnr}</div>
        </div>
        <div>
          <span class="ticket-status-badge ${booking.status}">${booking.status}</span>
        </div>
      </div>

      <div class="ticket-body">
        <div class="ticket-route-grid">
          <div class="station-point">
            <span class="station-code">${booking.fromStation?.code || 'ORIGIN'}</span>
            <span class="station-name">${booking.fromStation?.name || ''}</span>
          </div>
          <div class="route-progress-wrap">
            <strong style="color:white; font-size:1.05rem;">${booking.trainName || 'Express'}</strong>
            <span style="font-family:var(--font-mono); color:#93c5fd; font-size:0.85rem;">#${booking.trainNumber || ''} • ${jDate}</span>
          </div>
          <div class="station-point dest">
            <span class="station-code">${booking.toStation?.code || 'DEST'}</span>
            <span class="station-name">${booking.toStation?.name || ''}</span>
          </div>
        </div>

        <div>
          <h4 style="font-size:0.9rem; margin-bottom:0.6rem; color:var(--text-secondary);">TRAVELLER DETAILS & BERTH ALLOCATION</h4>
          <table class="ticket-passengers-table">
            <thead>
              <tr>
                <th>Passenger</th>
                <th>Class</th>
                <th>Seat / Berth</th>
                <th>Preference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${passengersRows}
            </tbody>
          </table>
        </div>
      </div>

      <div class="ticket-footer">
        <div>
          <span style="font-size:0.75rem; color:var(--text-muted);">Total Fare Paid:</span>
          <div style="font-size:1.15rem; font-weight:800; color:#34d399; font-family:var(--font-mono);">
            ₹${booking.fare?.totalFare || booking.totalFare || 0}
          </div>
        </div>
        <div class="ticket-actions">
          <button class="btn btn-glass btn-sm" onclick="window.print()">🖨️ Print / Save</button>
          ${booking.status === 'confirmed' ? `
            <button class="btn btn-danger btn-sm" onclick="handleCancelBooking('${booking._id}', '${booking.pnr}')">
              Cancel Ticket
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

async function handleCancelBooking(bookingId, pnr) {
  if (!confirm(`Are you sure you want to cancel booking PNR ${pnr}? Cancellation charges will apply according to railway policy.`)) {
    return;
  }

  try {
    const res = await apiRequest(`/bookings/${bookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Passenger requested cancellation" }),
    });

    const refundAmt = res.refundAmount || res.data?.refundAmount || 0;
    showToast(`Ticket cancelled. Refund of ₹${refundAmt} initiated!`, "success");
    handlePNRSearch(null);
    loadNotifications();
  } catch (err) {
    showToast(err.message || "Cancellation failed", "error");
  }
}

// ─── Live Radar & Tracking Simulation ─────────────────────────────────────
function populateRadarSelect() {
  const select = document.getElementById("radar-train-select");
  if (!select) return;

  let options = `<option value="">Select train to track...</option>`;
  state.trains.forEach((t) => {
    options += `<option value="${t._id}">${t.trainNumber} - ${t.trainName} (${t.source?.code} ➔ ${t.destination?.code})</option>`;
  });
  select.innerHTML = options;
}

function trackTrainDirect(trainId) {
  switchTab("tracking-tab");
  const select = document.getElementById("radar-train-select");
  if (select) {
    select.value = trainId;
    loadTrainLiveStatus(trainId);
  }
}

async function loadTrainLiveStatus(trainId) {
  if (!trainId) return;

  const displayEl = document.getElementById("radar-display");
  if (!displayEl) return;

  displayEl.innerHTML = `<div class="skeleton-card"></div>`;

  try {
    const res = await apiRequest(`/trains/${trainId}/status`);
    const statusData = res.status || res.data || res;

    const stopsHtml = (statusData.stops || []).map((stop, idx) => {
      let statusClass = "";
      if (idx < statusData.currentStopIndex) statusClass = "passed";
      else if (idx === statusData.currentStopIndex) statusClass = "current-loc";

      return `
        <div class="stop-row ${statusClass}">
          <div class="stop-dot"></div>
          <div class="stop-meta">
            <h4>${stop.stationName} (${stop.stationCode})</h4>
            <span>Platform ${stop.platform || 1} • Day ${stop.day || 1}</span>
          </div>
          <div class="stop-timing">
            <div>Arr: ${stop.arrivalTime}</div>
            <div style="color:#60a5fa;">Dep: ${stop.departureTime}</div>
          </div>
        </div>
      `;
    }).join("");

    displayEl.innerHTML = `
      <div class="telemetry-banner">
        <div class="tele-item">
          <span class="tele-label">Train Name & No</span>
          <span class="tele-val" style="color:white; font-size:1rem;">${statusData.trainName} (${statusData.trainNumber})</span>
        </div>
        <div class="tele-item">
          <span class="tele-label">Telemetry Status</span>
          <span class="tele-val ${statusData.delayMinutes > 0 ? 'delayed' : 'ontime'}">
            ${statusData.delayMinutes > 0 ? `Delayed by ${statusData.delayMinutes} min` : '🟢 Running on Time'}
          </span>
        </div>
        <div class="tele-item">
          <span class="tele-label">Current Position</span>
          <span class="tele-val" style="color:#38bdf8;">${statusData.currentStation?.name || 'In Transit'}</span>
        </div>
        <div class="tele-item">
          <span class="tele-label">Next Halt</span>
          <span class="tele-val" style="color:#fcd34d;">${statusData.nextStation?.name || 'Destination'}</span>
        </div>
      </div>

      <h3 style="font-size:1.1rem; margin-bottom:1rem;">Scheduled Halts & Live Position</h3>
      <div class="stops-timeline">
        ${stopsHtml}
      </div>
    `;
  } catch (err) {
    displayEl.innerHTML = `<div class="empty-state"><h3>Failed to track train</h3><p>${err.message}</p></div>`;
  }
}

// ─── My Bookings & Journeys ───────────────────────────────────────────────
function switchBookingSubTab(subTab) {
  state.bookingSubTab = subTab;
  document.querySelectorAll(".pill-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.innerText.toLowerCase().includes(subTab));
  });
  loadMyBookings();
}

async function loadMyBookings() {
  const container = document.getElementById("my-bookings-list");
  if (!container) return;

  if (!state.token) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <h3>Login Required</h3>
        <p>Please login to view your confirmed bookings and journey history.</p>
        <button class="btn btn-primary btn-sm" onclick="openAuthModal('login')">Sign In</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="skeleton-card"></div>`;

  try {
    const endpoint = state.bookingSubTab === "history" ? "/bookings/history" : "/bookings/my";
    const res = await apiRequest(endpoint);
    const bookings = res.bookings || res.data || [];

    if (bookings.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎟️</div>
          <h3>No bookings found</h3>
          <p>You have no ${state.bookingSubTab} tickets reserved.</p>
          <button class="btn btn-primary btn-sm" onclick="switchTab('booking-tab')">Search & Book</button>
        </div>
      `;
      return;
    }

    container.innerHTML = bookings.map((b) => {
      const jDate = new Date(b.journeyDate).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      return `
        <div class="booking-item-card">
          <div>
            <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.3rem;">
              <span class="train-number-badge" style="font-size:0.8rem; padding:0.2rem 0.4rem;">${b.pnr}</span>
              <strong style="font-size:1.05rem; color:white;">${b.trainName} (${b.trainNumber})</strong>
              <span class="ticket-status-badge ${b.status}">${b.status}</span>
            </div>
            <div style="font-size:0.85rem; color:var(--text-secondary);">
              ${b.fromStation?.code || 'SRC'} ➔ ${b.toStation?.code || 'DST'} • ${jDate} • Class ${b.travelClass} • ${b.passengers?.length || 1} Passenger(s)
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div style="text-align:right;">
              <span style="font-size:0.75rem; color:var(--text-muted);">Fare:</span>
              <div style="font-size:1.1rem; font-weight:800; color:#34d399; font-family:var(--font-mono);">
                ₹${b.fare?.totalFare || b.totalFare || 0}
              </div>
            </div>
            <button class="btn btn-glass btn-sm" onclick="viewTicketFromHistory('${b.pnr}')">View Ticket</button>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

function viewTicketFromHistory(pnr) {
  switchTab("pnr-tab");
  const input = document.getElementById("pnr-input");
  if (input) input.value = pnr;
  handlePNRSearch(null);
}

// ─── Passenger Master Directory ───────────────────────────────────────────
async function loadPassengers() {
  const container = document.getElementById("passengers-list");
  if (!container) return;

  if (!state.token) {
    container.innerHTML = `<div class="empty-state"><h3>Login to manage saved passengers</h3></div>`;
    return;
  }

  try {
    const res = await apiRequest("/passengers");
    const passengers = res.passengers || res.data || [];

    if (passengers.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">👥</div>
          <h3>No saved passengers</h3>
          <p>Add family & friends to speed up ticket booking checkout.</p>
          <button class="btn btn-primary btn-sm" onclick="openAddPassengerModal()">+ Add First Passenger</button>
        </div>
      `;
      return;
    }

    container.innerHTML = passengers.map((p) => `
      <div class="passenger-card">
        <div class="pass-card-header">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div class="pass-avatar-sm">${p.name.charAt(0)}</div>
            <div>
              <strong style="color:white; display:block;">${p.name}</strong>
              <span style="font-size:0.75rem; color:var(--text-muted);">${p.age} yrs • ${p.gender}</span>
            </div>
          </div>
          <button class="btn btn-danger btn-xs" onclick="handleDeletePassenger('${p._id}')">✕</button>
        </div>
        <div style="font-size:0.8rem; background:rgba(0,0,0,0.25); padding:0.6rem; border-radius:var(--radius-sm);">
          <div><span style="color:var(--text-muted);">ID Type:</span> <strong>${p.idType}</strong></div>
          <div><span style="color:var(--text-muted);">ID No:</span> <code>${p.idNumber}</code></div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p>${err.message}</p>`;
  }
}

function openAddPassengerModal() {
  document.getElementById("passenger-form")?.reset();
  openModal("passenger-modal");
}

async function handleSavePassenger(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById("pass-name")?.value?.trim(),
    age: parseInt(document.getElementById("pass-age")?.value, 10),
    gender: document.getElementById("pass-gender")?.value,
    idType: document.getElementById("pass-idtype")?.value,
    idNumber: document.getElementById("pass-idnumber")?.value?.trim(),
    phone: document.getElementById("pass-phone")?.value?.trim() || undefined,
  };

  try {
    await apiRequest("/passengers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    closeModal("passenger-modal");
    showToast("Passenger saved to master list", "success");
    loadPassengers();
  } catch (err) {
    showToast(err.message || "Failed to save passenger", "error");
  }
}

async function handleDeletePassenger(id) {
  if (!confirm("Remove this passenger?")) return;
  try {
    await apiRequest(`/passengers/${id}`, { method: "DELETE" });
    showToast("Passenger removed", "info");
    loadPassengers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ─── Admin Dashboard & Ops Hub ────────────────────────────────────────────
async function loadAdminDashboard() {
  if (!state.token) {
    showToast("Please login as Admin or Staff", "error");
    return;
  }

  try {
    const [statsRes, analyticsRes, fleetRes, cancellationsRes] = await Promise.all([
      apiRequest("/admin/dashboard").catch((e) => ({ data: {} })),
      apiRequest("/admin/analytics/revenue").catch((e) => ({ data: {} })),
      apiRequest("/trains?limit=50").catch((e) => ({ data: [] })),
      apiRequest("/admin/cancellations").catch((e) => ({ data: [] })),
    ]);

    const stats = statsRes.stats || statsRes.data || {};
    const analytics = analyticsRes.analytics || analyticsRes.data || {};
    const fleet = fleetRes.trains || fleetRes.data || [];
    const cancellations = cancellationsRes.cancellations || cancellationsRes.data || [];

    document.getElementById("kpi-bookings").innerText = stats.totalBookings || 0;
    document.getElementById("kpi-revenue").innerText = `₹${(stats.totalRevenue || 0).toLocaleString("en-IN")}`;
    document.getElementById("kpi-trains").innerText = stats.totalTrains || fleet.length || 0;
    document.getElementById("kpi-users").innerText = stats.totalUsers || 0;

    // Render Revenue by Class Table
    const classRows = (analytics.byClass || []).map((c) => `
      <tr>
        <td><strong class="role-pill passenger">${c._id}</strong></td>
        <td>${c.totalBookings}</td>
        <td>${c.totalPassengers}</td>
        <td><strong style="color:#34d399; font-family:var(--font-mono);">₹${c.totalRevenue?.toLocaleString("en-IN")}</strong></td>
      </tr>
    `).join("");
    document.getElementById("class-revenue-tbody").innerHTML = classRows || `<tr><td colspan="4" class="text-center">No revenue records yet</td></tr>`;

    // Render Fleet Table
    const fleetRows = fleet.map((t) => `
      <tr>
        <td><strong>${t.trainName}</strong> <small style="color:#60a5fa;">#${t.trainNumber}</small></td>
        <td>${t.source?.code} ➔ ${t.destination?.code}</td>
        <td>${(t.classes || []).map((c) => c.className).join(", ")}</td>
        <td><span class="role-pill ${t.status === 'active' ? 'passenger' : 'admin'}">${t.status}</span></td>
        <td>
          <button class="btn btn-glass btn-xs" onclick="trackTrainDirect('${t._id}')">Radar</button>
        </td>
      </tr>
    `).join("");
    document.getElementById("admin-fleet-tbody").innerHTML = fleetRows || `<tr><td colspan="5">No trains in fleet</td></tr>`;

    // Render Cancellations & Refund Queue
    const cancelRows = cancellations.map((cn) => `
      <tr>
        <td><strong>${cn.pnr}</strong></td>
        <td>${cn.booking?.passengers?.[0]?.name || 'Passenger'}</td>
        <td>₹${cn.farePaid || 0}</td>
        <td>₹${cn.cancellationCharge || 0}</td>
        <td><strong style="color:#34d399;">₹${cn.refundAmount || 0}</strong></td>
        <td><span class="role-pill ${cn.status === 'processed' ? 'passenger' : 'staff'}">${cn.status}</span></td>
        <td>
          ${cn.status === 'pending' ? `
            <button class="btn btn-primary btn-xs" onclick="handleProcessRefund('${cn._id}')">Approve Refund</button>
          ` : '<span style="color:#34d399;">Completed</span>'}
        </td>
      </tr>
    `).join("");
    document.getElementById("admin-cancellations-tbody").innerHTML = cancelRows || `<tr><td colspan="7" class="text-center">No cancellation requests</td></tr>`;
  } catch (err) {
    showToast(err.message || "Failed to load admin stats", "error");
  }
}

function openAddTrainModal() { openModal("add-train-modal"); }
function openAddStationModal() { openModal("add-station-modal"); }
function openBroadcastModal() { openModal("broadcast-modal"); }

async function handleCreateTrain(e) {
  e.preventDefault();
  const payload = {
    trainNumber: document.getElementById("new-train-no")?.value?.trim(),
    trainName: document.getElementById("new-train-name")?.value?.trim(),
    type: document.getElementById("new-train-type")?.value,
    source: {
      code: document.getElementById("new-train-src-code")?.value?.trim()?.toUpperCase(),
      name: document.getElementById("new-train-src-name")?.value?.trim(),
    },
    destination: {
      code: document.getElementById("new-train-dst-code")?.value?.trim()?.toUpperCase(),
      name: document.getElementById("new-train-dst-name")?.value?.trim(),
    },
    departureTime: document.getElementById("new-train-dep")?.value,
    arrivalTime: document.getElementById("new-train-arr")?.value,
    totalDistance: parseInt(document.getElementById("new-train-dist")?.value, 10),
    duration: document.getElementById("new-train-dur")?.value,
    classes: [
      { className: "1A", totalSeats: 24, farePerSeat: 3500 },
      { className: "2A", totalSeats: 60, farePerSeat: 2200 },
      { className: "3A", totalSeats: 180, farePerSeat: 1500 },
      { className: "SL", totalSeats: 300, farePerSeat: 650 },
    ],
  };

  try {
    await apiRequest("/trains", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    closeModal("add-train-modal");
    showToast("Train added to active operations fleet", "success");
    loadAllTrains();
    loadAdminDashboard();
  } catch (err) {
    showToast(err.message || "Failed to create train", "error");
  }
}

async function handleCreateStation(e) {
  e.preventDefault();
  const payload = {
    code: document.getElementById("stn-code")?.value?.trim()?.toUpperCase(),
    name: document.getElementById("stn-name")?.value?.trim(),
    city: document.getElementById("stn-city")?.value?.trim(),
    state: document.getElementById("stn-state")?.value?.trim(),
    zone: document.getElementById("stn-zone")?.value?.trim(),
    platforms: parseInt(document.getElementById("stn-platforms")?.value, 10),
  };

  try {
    await apiRequest("/stations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    closeModal("add-station-modal");
    showToast("Station added successfully", "success");
    loadStations();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleBroadcastNotification(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById("bc-title")?.value?.trim(),
    message: document.getElementById("bc-message")?.value?.trim(),
    type: document.getElementById("bc-type")?.value,
  };

  try {
    await apiRequest("/admin/broadcast", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    closeModal("broadcast-modal");
    showToast("📢 Broadcast alert sent to all passengers", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleProcessRefund(cancelId) {
  try {
    await apiRequest(`/admin/cancellations/${cancelId}/refund`, { method: "POST" });
    showToast("Refund marked as processed", "success");
    loadAdminDashboard();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ─── Notifications Center ─────────────────────────────────────────────────
async function loadNotifications() {
  if (!state.token) return;
  try {
    const res = await apiRequest("/notifications?limit=10");
    const notifications = res.data || [];
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    const badge = document.getElementById("notif-badge");
    if (badge) {
      badge.style.display = unreadCount > 0 ? "flex" : "none";
      badge.innerText = unreadCount;
    }

    const listEl = document.getElementById("notif-list");
    if (!listEl) return;

    if (notifications.length === 0) {
      listEl.innerHTML = `<div class="empty-state-sm" style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.8rem;">No notifications</div>`;
      return;
    }

    listEl.innerHTML = notifications.map((n) => `
      <div class="notif-item ${!n.isRead ? 'unread' : ''}">
        <h5>${n.title}</h5>
        <p>${n.message}</p>
        <time>${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
      </div>
    `).join("");
  } catch (_) {}
}

async function markAllNotificationsRead() {
  try {
    await apiRequest("/notifications/read-all", { method: "PATCH" });
    loadNotifications();
    showToast("All notifications marked read", "info");
  } catch (_) {}
}

// ─── Authentication & Profile ─────────────────────────────────────────────
function openAuthModal(mode = "login") {
  setAuthMode(mode);
  openModal("auth-modal");
}

function setAuthMode(mode) {
  const loginForm = document.getElementById("login-form");
  const regForm = document.getElementById("register-form");
  const toggleLogin = document.getElementById("toggle-login");
  const toggleReg = document.getElementById("toggle-register");
  const title = document.getElementById("auth-modal-title");

  if (mode === "login") {
    loginForm.style.display = "block";
    regForm.style.display = "none";
    toggleLogin.classList.add("active");
    toggleReg.classList.remove("active");
    title.innerText = "Sign In to RailPulse";
  } else {
    loginForm.style.display = "none";
    regForm.style.display = "block";
    toggleLogin.classList.remove("active");
    toggleReg.classList.add("active");
    title.innerText = "Create Railway Account";
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email")?.value?.trim();
  const password = document.getElementById("login-password")?.value;

  try {
    const res = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const token = res.token || res.data?.token;
    const user = res.user || res.data?.user;
    saveAuthSession(token, user);
    closeModal("auth-modal");
    showToast(`Welcome back, ${user?.name}!`, "success");
  } catch (err) {
    showToast(err.message || "Invalid email or password", "error");
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById("reg-name")?.value?.trim(),
    email: document.getElementById("reg-email")?.value?.trim(),
    phone: document.getElementById("reg-phone")?.value?.trim(),
    role: document.getElementById("reg-role")?.value,
    password: document.getElementById("reg-password")?.value,
  };

  try {
    const res = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const token = res.token || res.data?.token;
    const user = res.user || res.data?.user;
    saveAuthSession(token, user);
    closeModal("auth-modal");
    showToast(`Account created successfully!`, "success");
  } catch (err) {
    showToast(err.message || "Registration failed", "error");
  }
}

async function quickLogin(role) {
  const creds = {
    passenger: { email: "rahul@gmail.com", password: "Passenger@123" },
    staff: { email: "staff@railway.gov.in", password: "Staff@123" },
    admin: { email: "admin@railway.gov.in", password: "Admin@123" },
  };

  const account = creds[role];
  if (!account) return;

  try {
    const res = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(account),
    });

    const token = res.token || res.data?.token;
    const user = res.user || res.data?.user;
    saveAuthSession(token, user);
    toggleDropdown("demo-dropdown");
    showToast(`Logged in as ${user?.name} (${role.toUpperCase()})`, "success");

    if (role === "admin" || role === "staff") {
      switchTab("admin-tab");
    }
  } catch (err) {
    showToast(err.message || "Quick login failed", "error");
  }
}

function saveAuthSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("railpulse_token", token);
  localStorage.setItem("railpulse_user", JSON.stringify(user));
  updateAuthUI();
  loadNotifications();
}

function logoutUser() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("railpulse_token");
  localStorage.removeItem("railpulse_user");
  updateAuthUI();
  showToast("Logged out successfully", "info");
  switchTab("booking-tab");
}

function updateAuthUI() {
  const loginBtn = document.getElementById("login-btn");
  const userPill = document.getElementById("user-profile-pill");
  const adminNav = document.getElementById("admin-nav-btn");

  if (state.token && state.user) {
    if (loginBtn) loginBtn.style.display = "none";
    if (userPill) {
      userPill.style.display = "flex";
      document.getElementById("nav-user-avatar").innerText = state.user.name?.charAt(0) || "U";
      document.getElementById("nav-user-name").innerText = state.user.name || "User";
      document.getElementById("nav-user-role").innerText = state.user.role || "passenger";
    }
    if (adminNav) {
      adminNav.style.display = (state.user.role === "admin" || state.user.role === "staff") ? "flex" : "none";
    }
  } else {
    if (loginBtn) loginBtn.style.display = "inline-flex";
    if (userPill) userPill.style.display = "none";
    if (adminNav) adminNav.style.display = "none";
  }
}

// ─── Database Seeding Trigger ─────────────────────────────────────────────
async function triggerSeedData() {
  toggleDropdown("demo-dropdown");
  showToast("🌱 Seeding demo trains, stations and bookings...", "info");

  try {
    await apiRequest("/seed", { method: "POST" });
    showToast("✅ Demo database populated successfully!", "success");
    await loadStations();
    await loadAllTrains();
    await fetchSamplePNR();
  } catch (err) {
    showToast(err.message || "Seeding failed", "error");
  }
}
