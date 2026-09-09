const form = document.getElementById("reservation-form");
const message = document.getElementById("reservation-message");
const typeSelect = document.getElementById("res-type");
const checkIn = document.getElementById("res-checkin");
const checkOut = document.getElementById("res-checkout");
const mapSection = document.getElementById("rv-availability");
const mapTitle = document.getElementById("map-section-title");
const mapSummary = document.getElementById("map-date-summary");
const preferredSpotInput = document.getElementById("res-preferred-spot");
const preferredSpotDisplay = document.getElementById("preferred-spot-display");
const selectedSpotLabel = document.getElementById("selected-spot-label");
const clearSpotBtn = document.getElementById("clear-spot");
const rvDetailsGroup = document.getElementById("rv-details-group");
const rigSelect = document.getElementById("res-rig");
const stayLengthNotice = document.getElementById("stay-length-notice");
const memberIdInput = document.getElementById("res-member-id");
const memberReservationNotice = document.getElementById("member-reservation-notice");
const completeBookingBtn = document.getElementById("complete-booking-btn");
const bookingConfirmed = document.getElementById("booking-confirmed");
const bookAnotherBtn = document.getElementById("book-another-btn");
const bookingSigninNotice = document.getElementById("booking-signin-notice");
const myReservationsSection = document.getElementById("my-reservations");
const myReservationsBody = document.getElementById("my-reservations-body");
const myReservationsMessage = document.getElementById("my-reservations-message");
const bookingFormTitle = document.getElementById("booking-form-title");
const editingBanner = document.getElementById("editing-banner");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
let memberBookings = [];
let editingBookingId = null;
let occupancyRows = [];
let occupancyFetchToken = 0;
const reservationMode = document.body?.dataset?.reservationMode || "book";
const editIdFromUrl = new URLSearchParams(window.location.search).get("id");

function goToReservationHub(ok) {
  const q = ok ? `?ok=${encodeURIComponent(ok)}` : "";
  window.location.href = `reservations.html${q}`;
}

function getEditingBooking() {
  if (!editingBookingId) return null;
  return memberBookings.find((b) => b.id === editingBookingId) || null;
}

function editingExcludeOptions() {
  const editing = getEditingBooking();
  if (!editingBookingId && !editing) return {};
  if (!editing?.spot || !editing.check_in || !editing.check_out) {
    return editingBookingId ? { excludeBookingId: editingBookingId } : {};
  }
  return {
    excludeBookingId: editingBookingId || editing.id || null,
    excludeSpotId: editing.spot,
    excludeCheckIn: window.SpotAvailability.normalizeDate(editing.check_in),
    excludeCheckOut: window.SpotAvailability.normalizeDate(editing.check_out),
  };
}

function selectedRigLength() {
  if (!isRvReservationType(typeSelect.value)) return null;
  const raw = rigSelect?.value;
  if (raw === "" || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mapStatusOptions(extra = {}) {
  const opts = { ...editingExcludeOptions(), ...extra };
  const rig = selectedRigLength();
  if (rig != null) opts.rigLength = rig;
  return opts;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatSpotLabel(spotId) {
  if (!spotId) return "—";
  const unit = window.SpotAvailability?.findUnit?.(spotId);
  if (!unit) return spotId;
  if (unit.category === "condo") return `Condo ${unit.label}`;
  if (unit.category === "reunion") return unit.name || `Family site ${unit.label}`;
  return `Site ${unit.label}`;
}

function bookingIsEditable(booking) {
  if (typeof Auth?.bookingCanEditOrCancel === "function") {
    return Auth.bookingCanEditOrCancel(booking).allowed;
  }
  if (!booking || booking.status === "cancelled") return false;
  const today = window.SpotAvailability.getToday();
  return Boolean(booking.check_out && booking.check_out >= today);
}

function bookingEditBlockedReason(booking) {
  if (typeof Auth?.bookingCanEditOrCancel === "function") {
    const gate = Auth.bookingCanEditOrCancel(booking);
    return gate.allowed ? "" : gate.reason || "That reservation can no longer be edited.";
  }
  return "That reservation can no longer be edited.";
}

function showMyReservationsMessage(text, type) {
  if (!myReservationsMessage) return;
  myReservationsMessage.textContent = text || "";
  myReservationsMessage.className = type ? `form-message ${type}` : "form-message";
}

function setEditingMode(booking) {
  editingBookingId = booking?.id || null;
  if (bookingFormTitle) {
    bookingFormTitle.textContent = editingBookingId ? "Edit reservation" : "Book your stay";
  }
  if (editingBanner) {
    editingBanner.hidden = !editingBookingId;
    if (editingBookingId && booking) {
      const originalLabel =
        typeof Auth !== "undefined" && Auth.formatOriginalStayLabel
          ? Auth.formatOriginalStayLabel(booking)
          : "";
      editingBanner.textContent = originalLabel
        ? `Editing: new dates must stay within your original stay (${originalLabel}). Site can change; type cannot.`
        : "Editing: new dates must stay within your original booking window. Site can change; type cannot.";
    }
  }
  if (cancelEditBtn) cancelEditBtn.hidden = !editingBookingId;
  if (completeBookingBtn) {
    completeBookingBtn.textContent = editingBookingId ? "Save changes" : "Complete Booking";
  }
}

function clearEditingMode() {
  setEditingMode(null);
}

async function refreshMemberBookings() {
  const user = typeof Auth !== "undefined" ? Auth.getCurrentUser() : null;
  if (!user) {
    memberBookings = [];
    occupancyRows = [];
    if (myReservationsSection) myReservationsSection.hidden = true;
    return;
  }
  if (myReservationsSection) myReservationsSection.hidden = false;
  try {
    memberBookings = await Auth.listBookings();
  } catch (err) {
    memberBookings = [];
    showMyReservationsMessage(err.message, "error");
  }
  renderMyReservations();
  await refreshOccupancyForSelectedDates();
  updateMapAvailability();
  updateMemberReservationNotice();
}

function renderMyReservations() {
  if (!myReservationsBody) return;
  if (!memberBookings.length) {
    myReservationsBody.innerHTML = `<tr><td colspan="5">No reservations yet.</td></tr>`;
    return;
  }

  myReservationsBody.innerHTML = memberBookings
    .map((b) => {
      const type = Auth.reservationTypeLabel(b.reservation_type) || "—";
      const dates =
        b.check_in && b.check_out
          ? window.SpotAvailability.formatDateRange(b.check_in, b.check_out)
          : "—";
      const status = b.status || "—";
      const gate =
        typeof Auth.bookingCanEditOrCancel === "function"
          ? Auth.bookingCanEditOrCancel(b)
          : { allowed: bookingIsEditable(b), code: bookingIsEditable(b) ? "ok" : "past" };
      const editable = gate.allowed;
      const actions = editable
        ? `<button type="button" class="btn-link" data-action="edit" data-id="${escapeHtml(b.id)}">Edit</button>
           <button type="button" class="btn-link" data-action="delete" data-id="${escapeHtml(b.id)}">Delete</button>`
        : status === "cancelled"
          ? `<span class="label-optional">Cancelled</span>`
          : gate.code === "too-late"
            ? `<span class="label-optional" title="${escapeHtml(gate.reason || "")}">Too close to check-in</span>`
            : `<span class="label-optional">Past stay</span>`;
      return `<tr>
        <td>${escapeHtml(type)}</td>
        <td>${escapeHtml(formatSpotLabel(b.spot))}</td>
        <td>${escapeHtml(dates)}</td>
        <td><span class="status-pill ${
          status === "confirmed" ? "available" : status === "cancelled" ? "booked" : "partial"
        }">${escapeHtml(status)}</span></td>
        <td class="admin-actions">${actions}</td>
      </tr>`;
    })
    .join("");
}

function loadBookingIntoForm(booking) {
  if (!booking) return;
  checkIn.value = booking.check_in || "";
  checkOut.value = booking.check_out || "";
  typeSelect.value = Auth.toUiReservationType(booking.reservation_type) || "";
  const lockedType = document.getElementById("res-type-locked");
  if (lockedType) lockedType.value = typeSelect.value;
  if (reservationMode === "edit") {
    typeSelect.disabled = true;
  }
  updateRvFields();
  setEditingMode(booking);
  syncDateLimits();
  if (booking.spot) {
    preferredSpotInput.value = booking.spot;
    const unit = window.SpotAvailability.findUnit(booking.spot);
    if (unit) {
      selectedSpotLabel.textContent = formatSelectedUnit(unit);
      preferredSpotDisplay.hidden = false;
    } else {
      selectedSpotLabel.textContent = booking.spot;
      preferredSpotDisplay.hidden = false;
    }
  } else {
    clearPreferredSpot();
  }
  const notesField = document.getElementById("res-notes");
  if (notesField) notesField.value = booking.notes || "";
  showBookingFormState();
  document.getElementById("request-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const withinOriginal =
    typeof Auth !== "undefined" && Auth.stayWithinOriginal
      ? Auth.stayWithinOriginal(checkIn.value, checkOut.value, booking)
      : true;
  if (!withinOriginal) {
    const originalLabel = Auth.formatOriginalStayLabel(booking);
    message.textContent = originalLabel
      ? `These dates are outside your original booking (${originalLabel}). Choose dates within that window.`
      : "These dates are outside your original booking window. Choose dates within that window.";
    message.className = "form-message error";
  }
  syncAvailabilityFromDates().then(() => {
    if (booking.spot && preferredSpotInput.value === booking.spot) {
      CampgroundMap.selectUnit(booking.spot, { force: true });
    }
  });
}

function syncDateLimits() {
  const today = window.SpotAvailability.getToday();
  const maxCheckIn = window.SpotAvailability.getMaxCheckInDate();
  const editing = getEditingBooking();
  const win =
    editing && typeof Auth !== "undefined" && Auth.getOriginalStayWindow
      ? Auth.getOriginalStayWindow(editing)
      : null;

  let minIn = today;
  let maxIn = maxCheckIn;
  if (win?.start && win?.end) {
    if (win.start > minIn) minIn = win.start;
    const lastCheckIn = window.SpotAvailability.addDays(win.end, -1);
    if (lastCheckIn < maxIn) maxIn = lastCheckIn;
  }

  checkIn.min = minIn;
  checkIn.max = maxIn;
  if (checkIn.value && checkIn.value < minIn) checkIn.value = minIn;
  if (checkIn.value && checkIn.value > maxIn) {
    checkIn.value = "";
    checkOut.value = "";
  }
  syncCheckoutMin();
}

syncDateLimits();

function isCheckInTooFarOut(checkInValue) {
  return checkInValue && !window.SpotAvailability.isCheckInWithinAdvanceWindow(checkInValue);
}

function advanceBookingMessage() {
  const latest = window.SpotAvailability.getMaxCheckInDate();
  const latestFormatted = new Date(`${latest}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Reservations can only be made up to ${window.RESERVATION_MAX_ADVANCE_DAYS} days in advance. Latest check-in: ${latestFormatted}.`;
}

function isRvReservationType(value) {
  return value === "rv" || value === "motorhome" || value === "travel-trailer";
}

function isCondoReservationType(value) {
  return value === "condo";
}

function isReunionReservationType(value) {
  return value === "family-reunion" || value === "reunion" || value === "family_reunion";
}

function getMapUnitFilter(type) {
  if (isRvReservationType(type)) return "rv";
  if (isCondoReservationType(type)) return "condo";
  if (isReunionReservationType(type)) return "reunion";
  return "all";
}

function formatSelectedUnit(unit) {
  if (unit.category === "condo") {
    return `Condo ${unit.label} (${unit.bedrooms}-bedroom)`;
  }
  if (unit.category === "reunion") {
    return unit.name || `Family site ${unit.label}`;
  }
  const type = window.SPOT_TYPE_LABELS[unit.type] || unit.type;
  const lengthBit = window.SpotAvailability?.formatUnitLengthBit?.(unit);
  return lengthBit
    ? `Site ${unit.label} (${type} · ${lengthBit})`
    : `Site ${unit.label} (${type})`;
}

function unitMatchesReservationType(unit, type) {
  if (isRvReservationType(type)) return unit.category === "rv";
  if (isCondoReservationType(type)) return unit.category === "condo";
  if (isReunionReservationType(type)) return unit.category === "reunion";
  return false;
}

function canBookSelectUnit(unit) {
  const type = typeSelect.value;
  if (!type) return false;
  return unitMatchesReservationType(unit, type);
}

CampgroundMap.init({
  layerId: "spots-layer",
  detailId: "map-unit-detail",
  svgId: "campground-map",
  photoId: "campground-map-photo",
  requireDatesForSpots: false,
  unitFilter: "all",
  canBookSelect: canBookSelectUnit,
  onSpotSelect(unit) {
    if (!canBookSelectUnit(unit)) return;
    preferredSpotInput.value = unit.id;
    selectedSpotLabel.textContent = formatSelectedUnit(unit);
    preferredSpotDisplay.hidden = false;
  },
});

MapZoom.init({
  viewport: document.getElementById("map-viewport"),
  stage: document.getElementById("map-zoom-stage"),
  zoomInBtn: document.getElementById("map-zoom-in"),
  zoomOutBtn: document.getElementById("map-zoom-out"),
  resetBtn: document.getElementById("map-zoom-reset"),
});

function syncCheckoutMin() {
  if (!checkIn.value) return;
  const next = new Date(checkIn.value + "T12:00:00");
  next.setDate(next.getDate() + 1);
  checkOut.min = next.toISOString().split("T")[0];

  const editing = getEditingBooking();
  const win =
    editing && typeof Auth !== "undefined" && Auth.getOriginalStayWindow
      ? Auth.getOriginalStayWindow(editing)
      : null;
  if (win?.end) {
    checkOut.max = win.end;
    if (checkOut.value && checkOut.value > win.end) {
      checkOut.value = win.end;
    }
  } else {
    checkOut.removeAttribute("max");
  }

  if (checkOut.value && checkOut.value <= checkIn.value) {
    checkOut.value = "";
  }
}

function clearPreferredSpot() {
  preferredSpotInput.value = "";
  preferredSpotDisplay.hidden = true;
  selectedSpotLabel.textContent = "";
  CampgroundMap.clearSelection();
}

function updateRvFields() {
  const showRvLength = isRvReservationType(typeSelect.value);
  rvDetailsGroup.hidden = !showRvLength;
  if (!showRvLength) {
    rigSelect.value = "";
  }
  CampgroundMap.setRigLength(showRvLength ? selectedRigLength() : null);
}

function updateStayLengthNotice() {
  if (!stayLengthNotice) return;

  const inDate = checkIn.value;
  const outDate = checkOut.value;
  const maxNights = window.RESERVATION_MAX_NIGHTS || 7;
  const nights = window.SpotAvailability.getStayNights(inDate, outDate);

  if (!inDate || !outDate || outDate <= inDate || nights <= maxNights) {
    stayLengthNotice.hidden = true;
    stayLengthNotice.textContent = "";
    return;
  }

  const bookingsNeeded = Math.ceil(nights / maxNights);
  const firstCheckout = window.SpotAvailability.addDays(inDate, maxNights);
  const firstRange = window.SpotAvailability.formatDateRange(inDate, firstCheckout);

  stayLengthNotice.hidden = false;
  stayLengthNotice.textContent =
    `Your stay is ${nights} nights. Resort bylaws allow up to ${maxNights} consecutive days per reservation, ` +
    `so you will need ${bookingsNeeded} separate bookings. Complete this form for ${firstRange}, ` +
    `then submit a new booking for the remaining nights of your trip.`;
}

function formatActiveReservationRanges(active) {
  return active
    .map((r) => {
      const range = window.SpotAvailability.formatDateRange(r.checkIn, r.checkOut);
      const conf =
        typeof Auth !== "undefined" && typeof Auth.bookingConfirmationId === "function"
          ? Auth.bookingConfirmationId(r.id || r)
          : "";
      return conf ? `Confirmation #${conf} · ${range}` : range;
    })
    .join("; ");
}

function getActiveMemberBookings() {
  if (typeof Auth !== "undefined" && Auth.getActiveBookings) {
    return Auth.getActiveBookings(memberBookings)
      .filter((b) => b.id !== editingBookingId)
      .map((b) => ({
        id: b.id,
        checkIn: b.check_in,
        checkOut: b.check_out,
      }));
  }
  const memberId = window.SpotAvailability.normalizeMemberId(memberIdInput?.value);
  return window.SpotAvailability.getActiveMemberReservations(memberId);
}

function updateMemberReservationNotice() {
  if (!memberReservationNotice) return;

  const user = typeof Auth !== "undefined" ? Auth.getCurrentUser() : null;
  const memberId = window.SpotAvailability.normalizeMemberId(memberIdInput?.value);
  if (!user && !memberId) {
    memberReservationNotice.hidden = true;
    memberReservationNotice.textContent = "";
    memberReservationNotice.classList.remove("stay-length-notice--limit");
    return;
  }

  const maxActive = window.RESERVATION_MAX_ACTIVE || 2;
  const active = getActiveMemberBookings();

  if (active.length >= maxActive) {
    memberReservationNotice.hidden = false;
    memberReservationNotice.classList.add("stay-length-notice--limit");
    memberReservationNotice.textContent =
      `You have ${active.length} upcoming reservations (maximum ${maxActive}): ` +
      `${formatActiveReservationRanges(active)}. Once you check in, or after deleting one, you can book again.`;
    return;
  }

  memberReservationNotice.classList.remove("stay-length-notice--limit");
  if (active.length > 0) {
    const remaining = maxActive - active.length;
    memberReservationNotice.hidden = false;
    memberReservationNotice.textContent =
      `You have ${active.length} upcoming reservation${active.length === 1 ? "" : "s"} ` +
      `(${formatActiveReservationRanges(active)}). You may book ${remaining} more before check-in.`;
    return;
  }

  memberReservationNotice.hidden = true;
  memberReservationNotice.textContent = "";
}

function updateMapAvailability() {
  const inDate = checkIn.value;
  const outDate = checkOut.value;
  const type = typeSelect.value;
  const isRv = isRvReservationType(type);
  const isCondo = isCondoReservationType(type);
  const isReunion = isReunionReservationType(type);
  const filter = getMapUnitFilter(type);
  const statusOpts = mapStatusOptions();
  const rigFeet = statusOpts.rigLength || null;

  CampgroundMap.setUnitFilter(filter);
  if (typeof CampgroundMap.setAvailabilityExclude === "function") {
    CampgroundMap.setAvailabilityExclude(editingExcludeOptions(), { render: false });
  }
  if (typeof CampgroundMap.setRigLength === "function") {
    CampgroundMap.setRigLength(isRv ? rigFeet : null, { render: false });
  }

  if (mapTitle) {
    mapTitle.textContent = isCondo
      ? "Condo map"
      : isReunion
        ? "Family reunion sites"
        : "Booking Map";
  }

  if (isCheckInTooFarOut(inDate)) {
    updateStayLengthNotice();
    mapSummary.textContent = advanceBookingMessage();
    CampgroundMap.setDates("", "");
    clearPreferredSpot();
    return;
  }

  if (!inDate || !outDate || outDate <= inDate) {
    updateStayLengthNotice();
    const lengthHint =
      isRv && rigFeet
        ? ` Black sites are shorter than your ${rigFeet}' RV and cannot be selected.`
        : "";
    mapSummary.textContent = !type
      ? "Click any RV site, condo, or family reunion site to see upcoming bookings. Pick dates and reservation type above to book."
      : isCondo
        ? "Click any brown condo on the map. Pick check-in and check-out dates above to see availability."
        : isReunion
          ? "Click a family reunion site on the map. Pick check-in and check-out dates above to see availability."
          : `Click any green RV site on the map. Pick check-in and check-out dates above to see availability.${lengthHint}`;
    CampgroundMap.setDates("", "");
    if (preferredSpotInput.value) {
      const unit = window.SpotAvailability.findUnit(preferredSpotInput.value);
      if (unit && !window.SpotAvailability.unitFitsRigLength(unit, rigFeet)) {
        clearPreferredSpot();
      }
    }
    return;
  }

  updateStayLengthNotice();

  CampgroundMap.setDates(inDate, outDate);

  const lengthLegend = isRv && rigFeet ? " Black = too short for your RV." : "";

  if (isRv) {
    const available = window.SpotAvailability.countAvailable(
      inDate,
      outDate,
      "rv",
      statusOpts
    );
    mapSummary.textContent = `${available} RV site${available === 1 ? "" : "s"} open for your full stay (${inDate} to ${outDate}). Green = available, yellow = partially booked, red = fully booked.${lengthLegend}`;
  } else if (isCondo) {
    const available = window.SpotAvailability.countAvailable(
      inDate,
      outDate,
      "condo",
      statusOpts
    );
    mapSummary.textContent = `${available} condo${available === 1 ? "" : "s"} open for your full stay (${inDate} to ${outDate}). Green = available, yellow = partially booked, red = fully booked.`;
  } else if (isReunion) {
    const available = window.SpotAvailability.countAvailable(
      inDate,
      outDate,
      "reunion",
      statusOpts
    );
    mapSummary.textContent = `${available} family site${available === 1 ? "" : "s"} open for your full stay (${inDate} to ${outDate}). Green = available, yellow = partially booked, red = fully booked.`;
  } else {
    const rvOpen = window.SpotAvailability.countAvailable(inDate, outDate, "rv", statusOpts);
    const condoOpen = window.SpotAvailability.countAvailable(
      inDate,
      outDate,
      "condo",
      statusOpts
    );
    const reunionOpen = window.SpotAvailability.countAvailable(
      inDate,
      outDate,
      "reunion",
      statusOpts
    );
    mapSummary.textContent =
      `${rvOpen} RV site${rvOpen === 1 ? "" : "s"}, ${condoOpen} condo${condoOpen === 1 ? "" : "s"}, and ${reunionOpen} family site${reunionOpen === 1 ? "" : "s"} open for ${inDate} to ${outDate}. Click any unit to view its schedule, or choose a reservation type above to book.`;
    clearPreferredSpot();
  }

  if (preferredSpotInput.value) {
    const unit = window.SpotAvailability.findUnit(preferredSpotInput.value);
    const status = unit
      ? window.SpotAvailability.getStatusForDates(unit, inDate, outDate, statusOpts)
      : "booked";
    const wrongCategory = unit && type && !unitMatchesReservationType(unit, type);

    if (status !== "available" || wrongCategory) {
      clearPreferredSpot();
    } else {
      CampgroundMap.selectUnit(preferredSpotInput.value, { force: true });
    }
  }
}

async function syncAvailabilityFromDates() {
  await refreshOccupancyForSelectedDates();
  updateMapAvailability();
}

checkIn.addEventListener("change", () => {
  syncDateLimits();
  syncAvailabilityFromDates();
});

checkOut.addEventListener("change", () => {
  syncAvailabilityFromDates();
});
memberIdInput?.addEventListener("input", updateMemberReservationNotice);
memberIdInput?.addEventListener("change", updateMemberReservationNotice);
typeSelect.addEventListener("change", () => {
  updateRvFields();
  clearPreferredSpot();
  updateMapAvailability();
  updateMemberReservationNotice();
});
rigSelect?.addEventListener("change", () => {
  updateMapAvailability();
});

updateRvFields();
updateMapAvailability();
updateMemberReservationNotice();

function showConfirmedState(record) {
  const signedIn = typeof Auth !== "undefined" && Auth.getCurrentUser();
  if (bookingSigninNotice) bookingSigninNotice.hidden = true;
  if (bookingConfirmed) bookingConfirmed.hidden = false;
  if (bookAnotherBtn) bookAnotherBtn.hidden = false;
  // Keep Complete Booking available so a second reservation is always possible
  if (completeBookingBtn) {
    completeBookingBtn.hidden = !signedIn;
    completeBookingBtn.disabled = !signedIn;
  }
  if (record?.detail) {
    message.textContent = record.detail;
    message.className = "form-message success";
  }
}

function showBookingFormState() {
  const signedIn = typeof Auth !== "undefined" && Auth.getCurrentUser();
  if (bookingConfirmed) bookingConfirmed.hidden = true;
  if (bookAnotherBtn) bookAnotherBtn.hidden = true;
  if (completeBookingBtn) {
    completeBookingBtn.hidden = !signedIn;
    completeBookingBtn.disabled = !signedIn;
  }
  if (bookingSigninNotice) bookingSigninNotice.hidden = Boolean(signedIn);
}

function startAnotherBooking() {
  if (typeof Auth !== "undefined" && Auth.clearLastBooking) {
    Auth.clearLastBooking();
  }
  if (reservationMode === "edit") {
    goToReservationHub();
    return;
  }
  clearEditingMode();
  message.textContent = "";
  message.className = "form-message";
  form.reset();
  syncDateLimits();
  typeSelect.value = "";
  clearPreferredSpot();
  updateRvFields();
  updateMapAvailability();
  showBookingFormState();
  const user = typeof Auth !== "undefined" ? Auth.getCurrentUser() : null;
  prefillFromProfile(user);
  updateMemberReservationNotice();
  checkIn?.focus();
}


function rebuildSpotBookingsFromMembers() {
  if (!window.BASE_SPOT_BOOKINGS) {
    // Seed once from static demo rows, then prefer live occupancy when available.
    window.BASE_SPOT_BOOKINGS = Array.isArray(window.SPOT_BOOKINGS)
      ? window.SPOT_BOOKINGS.slice()
      : [];
  }

  const editingId = editingBookingId ? String(editingBookingId) : null;
  const keyOf = (row) =>
    `${row.bookingId || ""}|${row.spotId}|${row.checkIn}|${row.checkOut}`;
  const merged = new Map();

  const addRow = (row) => {
    if (!row?.spotId || !row.checkIn || !row.checkOut) return;
    const bookingId = row.bookingId != null && row.bookingId !== "" ? String(row.bookingId) : null;
    if (editingId && bookingId && bookingId === editingId) return;
    const normalized = {
      bookingId,
      spotId: String(row.spotId),
      checkIn: window.SpotAvailability.normalizeDate(row.checkIn),
      checkOut: window.SpotAvailability.normalizeDate(row.checkOut),
    };
    if (!normalized.checkIn || !normalized.checkOut) return;
    merged.set(keyOf(normalized), normalized);
  };

  if (occupancyRows.length) {
    occupancyRows.forEach((r) =>
      addRow({
        bookingId: r.id || r.booking_id || null,
        spotId: r.spot,
        checkIn: r.check_in,
        checkOut: r.check_out,
      })
    );
  } else {
    (window.BASE_SPOT_BOOKINGS || []).forEach(addRow);
  }

  (memberBookings || [])
    .filter(
      (b) =>
        b.status !== "cancelled" &&
        b.spot &&
        b.check_in &&
        b.check_out &&
        (!editingId || String(b.id) !== editingId)
    )
    .forEach((b) =>
      addRow({
        bookingId: b.id,
        spotId: b.spot,
        checkIn: b.check_in,
        checkOut: b.check_out,
      })
    );

  let rows = Array.from(merged.values());
  const excludeOpts = editingExcludeOptions();
  if (excludeOpts.excludeBookingId || excludeOpts.excludeSpotId) {
    rows = window.SpotAvailability.applyExcludeOptions(rows, excludeOpts);
  }
  window.SPOT_BOOKINGS = rows;
}

function mergeUserBookingsIntoMap(bookings) {
  rebuildSpotBookingsFromMembers();
  if (!Array.isArray(bookings)) return;
  const editingId = editingBookingId ? String(editingBookingId) : null;
  bookings.forEach((b) => {
    if (!b.spot || !b.check_in || !b.check_out || b.status === "cancelled") return;
    if (editingId && String(b.id) === editingId) return;
    const spotId = String(b.spot);
    const checkIn = window.SpotAvailability.normalizeDate(b.check_in);
    const checkOut = window.SpotAvailability.normalizeDate(b.check_out);
    const exists = window.SPOT_BOOKINGS.some(
      (row) =>
        (b.id && row.bookingId && String(row.bookingId) === String(b.id)) ||
        (row.spotId === spotId && row.checkIn === checkIn && row.checkOut === checkOut)
    );
    if (!exists) {
      window.SPOT_BOOKINGS.push({
        bookingId: b.id || null,
        spotId,
        checkIn,
        checkOut,
      });
    }
  });
  const excludeOpts = editingExcludeOptions();
  if (excludeOpts.excludeBookingId || excludeOpts.excludeSpotId) {
    window.SPOT_BOOKINGS = window.SpotAvailability.applyExcludeOptions(
      window.SPOT_BOOKINGS,
      excludeOpts
    );
  }
}

async function refreshOccupancyForSelectedDates() {
  const inDate = checkIn.value;
  const outDate = checkOut.value;
  const token = ++occupancyFetchToken;

  if (
    !inDate ||
    !outDate ||
    outDate <= inDate ||
    typeof Auth === "undefined" ||
    !Auth.getSiteOccupancy ||
    !Auth.getCurrentUser()
  ) {
    occupancyRows = [];
    rebuildSpotBookingsFromMembers();
    return;
  }

  try {
    const rows = await Auth.getSiteOccupancy(inDate, outDate);
    if (token !== occupancyFetchToken) return;
    occupancyRows = Array.isArray(rows) ? rows : [];
  } catch {
    if (token !== occupancyFetchToken) return;
    // Keep prior rows if a refresh fails mid-typing; fall back to member/demo merge.
    occupancyRows = occupancyRows || [];
  }
  rebuildSpotBookingsFromMembers();
}

function prefillFromProfile(user) {
  if (!user) return;
  if (document.getElementById("res-name") && !document.getElementById("res-name").value) {
    document.getElementById("res-name").value = user.name || "";
  }
  if (document.getElementById("res-email") && !document.getElementById("res-email").value) {
    document.getElementById("res-email").value = user.profileEmail || user.email || "";
  }
  if (document.getElementById("res-phone") && !document.getElementById("res-phone").value) {
    document.getElementById("res-phone").value = user.phone || "";
  }
  if (memberIdInput && !memberIdInput.value) {
    memberIdInput.value = user.memberId || user.email || user.id || "";
  }
  if (typeSelect && user.reservationType && !typeSelect.value) {
    typeSelect.value = user.reservationType;
    updateRvFields();
  }
}

clearSpotBtn.addEventListener("click", clearPreferredSpot);
bookAnotherBtn?.addEventListener("click", startAnotherBooking);
if (cancelEditBtn && cancelEditBtn.tagName === "BUTTON") {
  cancelEditBtn.addEventListener("click", () => {
    startAnotherBooking();
    showMyReservationsMessage("", "");
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "";
  message.className = "form-message";

  const user = typeof Auth !== "undefined" ? Auth.getCurrentUser() : null;
  if (!user) {
    message.textContent = "Sign in to complete a booking.";
    message.className = "form-message error";
    showBookingFormState();
    return;
  }

  if (checkOut.value <= checkIn.value) {
    message.textContent = "Check-out must be after check-in.";
    message.className = "form-message error";
    checkOut.focus();
    return;
  }

  if (isCheckInTooFarOut(checkIn.value)) {
    message.textContent = advanceBookingMessage();
    message.className = "form-message error";
    checkIn.focus();
    return;
  }

  const maxNights = window.RESERVATION_MAX_NIGHTS || 7;
  const stayNights = window.SpotAvailability.getStayNights(checkIn.value, checkOut.value);
  if (stayNights > maxNights) {
    const firstCheckout = window.SpotAvailability.addDays(checkIn.value, maxNights);
    const firstRange = window.SpotAvailability.formatDateRange(checkIn.value, firstCheckout);
    message.textContent =
      `Each reservation is limited to ${maxNights} consecutive days. Shorten your dates to ${firstRange} for this booking, then submit a separate reservation for the rest of your stay.`;
    message.className = "form-message error";
    stayLengthNotice?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  const memberId = window.SpotAvailability.normalizeMemberId(data.memberId || user.email);

  if (editingBookingId) {
    const existing = memberBookings.find((b) => b.id === editingBookingId);
    if (!existing) {
      message.textContent = "Reservation not found.";
      message.className = "form-message error";
      return;
    }
    const editGate =
      typeof Auth.bookingCanEditOrCancel === "function"
        ? Auth.bookingCanEditOrCancel(existing)
        : { allowed: bookingIsEditable(existing), reason: bookingEditBlockedReason(existing) };
    if (!editGate.allowed) {
      message.textContent = editGate.reason || bookingEditBlockedReason(existing);
      message.className = "form-message error";
      return;
    }
    data.type = Auth.toUiReservationType(existing.reservation_type) || data.type;
    if (!Auth.stayWithinOriginal(data.checkIn, data.checkOut, existing)) {
      const originalLabel = Auth.formatOriginalStayLabel(existing);
      message.textContent = originalLabel
        ? `Edited dates must stay within your original booking (${originalLabel}). To book different dates, delete this reservation and book a new one.`
        : "Edited dates must stay within your original booking window. To book different dates, delete this reservation and book a new one.";
      message.className = "form-message error";
      return;
    }
  }

  const active = getActiveMemberBookings();
  const maxActive = window.RESERVATION_MAX_ACTIVE || 2;
  if (!editingBookingId && active.length >= maxActive) {
    message.textContent =
      `You have ${active.length} upcoming reservations (maximum ${maxActive}): ` +
      `${formatActiveReservationRanges(active)}. Once you check in, or after deleting one, you can book again.`;
    message.className = "form-message error";
    updateMemberReservationNotice();
    memberReservationNotice?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  const typeLabels = {
    condo: "Condo",
    rv: "RV",
    "family-reunion": "Family reunion",
    family_reunion: "Family reunion",
    "travel-trailer": "Travel trailer",
    motorhome: "Motorhome",
    reunion: "Family reunion",
  };

  const needsMapUnit =
    isRvReservationType(data.type) ||
    isCondoReservationType(data.type) ||
    isReunionReservationType(data.type);

  if (needsMapUnit) {
    if (!data.preferredSpot) {
      message.textContent = isCondoReservationType(data.type)
        ? "Select an open (green) condo on the map before completing your booking."
        : isReunionReservationType(data.type)
          ? "Select an open (green) family reunion site on the map before completing your booking."
          : "Select an open (green) RV site on the map before completing your booking.";
      message.className = "form-message error";
      mapSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    const unit = window.SpotAvailability.findUnit(data.preferredSpot);
    const expectedCategory = isCondoReservationType(data.type)
      ? "condo"
      : isReunionReservationType(data.type)
        ? "reunion"
        : "rv";

    if (!unit || unit.category !== expectedCategory) {
      message.textContent = "That unit could not be found. Please select another open unit on the map.";
      message.className = "form-message error";
      clearPreferredSpot();
      return;
    }

    // Live occupancy + member rows already exclude the stay being edited.
    await refreshOccupancyForSelectedDates();
    const statusOpts = mapStatusOptions();
    const status = window.SpotAvailability.getStatusForDates(
      unit,
      data.checkIn,
      data.checkOut,
      statusOpts
    );
    if (status === "tooShort") {
      const max = window.SpotAvailability.getUnitMaxLength(unit);
      message.textContent =
        max != null
          ? `Site ${unit.label} allows up to ${max}'. Choose a longer site or a shorter RV length.`
          : `Site ${unit.label} is too short for your RV. Choose another site.`;
      message.className = "form-message error";
      clearPreferredSpot();
      updateMapAvailability();
      return;
    }
    if (status !== "available") {
      const conflicts = window.SpotAvailability.getBookingsForUnit(
        unit.id,
        data.checkIn,
        data.checkOut,
        statusOpts
      );
      const datesNote = conflicts.length
        ? ` Booked ${conflicts.map((b) => window.SpotAvailability.formatDateRange(b.checkIn, b.checkOut)).join("; ")}.`
        : "";
      message.textContent = `${
        unit.category === "condo"
          ? "Condo"
          : unit.category === "reunion"
            ? "Family site"
            : "Site"
      } ${unit.label} is no longer open for those dates.${datesNote} Please choose another green unit on the map.`;
      message.className = "form-message error";
      clearPreferredSpot();
      updateMapAvailability();
      return;
    }

    window.SPOT_BOOKINGS.push({
      bookingId: editingBookingId || null,
      spotId: String(unit.id),
      checkIn: window.SpotAvailability.normalizeDate(data.checkIn),
      checkOut: window.SpotAvailability.normalizeDate(data.checkOut),
    });
    updateMapAvailability();
  }

  let booking;
  try {
    if (editingBookingId) {
      booking = await Auth.updateOwnBooking(editingBookingId, {
        reservationType: data.type,
        spot: data.preferredSpot || null,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        notes: data.notes || "",
      });
    } else {
      booking = await Auth.createBooking({
        reservationType: data.type,
        spot: data.preferredSpot || null,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        notes: data.notes || "",
      });
    }
  } catch (err) {
    // Roll back optimistic map hold and resync occupancy.
    rebuildSpotBookingsFromMembers();
    await refreshOccupancyForSelectedDates();
    updateMapAvailability();
    message.textContent = err.message;
    message.className = "form-message error";
    return;
  }

  const confirmationId = booking.id
    ? `ECR-${String(booking.id).replace(/-/g, "").slice(0, 8).toUpperCase()}`
    : `ECR-${Date.now().toString(36).toUpperCase()}`;

  if (!editingBookingId) {
    window.SpotAvailability.addMemberReservation({
      memberId: user.id,
      spotId: data.preferredSpot || null,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      type: data.type,
      confirmationId,
    });
  }

  let unitNote = "";
  if (needsMapUnit && data.preferredSpot) {
    const unit = window.SpotAvailability.findUnit(data.preferredSpot);
    if (unit) {
      unitNote =
        unit.category === "condo"
          ? ` Condo ${unit.label} is reserved for you.`
          : unit.category === "reunion"
            ? ` ${unit.name || `Family site ${unit.label}`} is reserved for you.`
            : ` Site ${unit.label} is reserved for you.`;
    }
  }

  const wasEditing = Boolean(editingBookingId);
  const detail = wasEditing
    ? `Reservation updated.${unitNote} Confirmation #${confirmationId}.`
    : `You're booked, ${data.name.split(" ")[0]}! Your ${typeLabels[data.type] || "reservation"} for ` +
      `${data.checkIn} to ${data.checkOut} is confirmed.${unitNote} Confirmation #${confirmationId} was sent to ${data.email}.`;

  const record = {
    id: booking.id,
    type: data.type,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    spot: data.preferredSpot || null,
    detail,
  };
  Auth.saveLastBooking(record);
  clearEditingMode();
  goToReservationHub(wasEditing ? "updated" : "created");
});

(async function initReservationAuth() {
  if (typeof Auth === "undefined") {
    showBookingFormState();
    return;
  }

  const gate = Auth.redirectForAuth({
    requireMember: true,
    loginPage:
      reservationMode === "edit"
        ? `login.html?next=${encodeURIComponent(
            `reservation-edit.html${editIdFromUrl ? `?id=${editIdFromUrl}` : ""}`
          )}`
        : "login.html?next=reservation-book.html",
  });
  if (!gate) return;

  try {
    await Auth.ready();
  } catch {
    /* cached session is enough to book */
  }
  const user = Auth.getCurrentUser();
  prefillFromProfile(user);
  if (user) {
    await refreshMemberBookings();
  }

  if (reservationMode === "edit") {
    if (!editIdFromUrl) {
      message.textContent = "Missing reservation to edit.";
      message.className = "form-message error";
      return;
    }
    const booking = memberBookings.find((b) => b.id === editIdFromUrl);
    if (!booking) {
      message.textContent = "Reservation not found.";
      message.className = "form-message error";
      return;
    }
    if (!bookingIsEditable(booking)) {
      message.textContent = bookingEditBlockedReason(booking);
      message.className = "form-message error";
      if (completeBookingBtn) completeBookingBtn.disabled = true;
      return;
    }
    loadBookingIntoForm(booking);
  } else {
    showBookingFormState();
  }
  updateMemberReservationNotice();
})();
