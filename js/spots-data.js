/**
 * Campground availability helpers — unit definitions live in map-units-generated.js.
 * Regenerate coordinates: node scripts/generate-map-coordinates.js
 * Fine-tune with map.html?mapEdit=1
 */
window.MAP_CONFIG = {
  image: "pix/map.png",
  baseWidth: 1013,
  baseHeight: 782,
};

/** Existing bookings — dates only; member identity is not exposed on the map. */
window.SPOT_BOOKINGS = [
  { spotId: "3", checkIn: "2026-08-15", checkOut: "2026-08-18" },
  { spotId: "7", checkIn: "2026-08-10", checkOut: "2026-08-14" },
  { spotId: "14", checkIn: "2026-08-20", checkOut: "2026-08-24" },
  { spotId: "42", checkIn: "2026-09-01", checkOut: "2026-09-05" },
  { spotId: "12A", checkIn: "2026-08-12", checkOut: "2026-08-15" },
  { spotId: "13C", checkIn: "2026-08-18", checkOut: "2026-08-22" },
];

window.SPOT_TYPE_LABELS = {
  "pull-through": "Pull-Through Full Hookup",
  "back-in": "Back-In Full Hookup",
  "drive-in": "Drive-In Full Hookup",
  partial: "Partial Hookup",
  tent: "Tent Site",
  condo: "Condominium",
};

window.STATUS_LABELS = {
  available: "Available",
  partial: "Partially booked",
  booked: "Booked",
  tooShort: "Too short for your RV",
  unknown: "Select dates",
  previewOpen: "Open (next 90 days)",
  previewBooked: "Bookings scheduled",
};

/** Maximum consecutive days per reservation (resort bylaws). */
window.RESERVATION_MAX_NIGHTS = 7;

/** How far in advance a reservation may be made (resort policy). */
window.RESERVATION_MAX_ADVANCE_DAYS = 60;

/** Maximum confirmed reservations (before office check-in) a member may hold at one time. */
window.RESERVATION_MAX_ACTIVE = 2;

window.MEMBER_RESERVATIONS_STORAGE_KEY = "ecr-member-reservations";

window.SpotAvailability = {
  loadMemberReservations() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(window.MEMBER_RESERVATIONS_STORAGE_KEY) || "[]"
      );
      window.MEMBER_RESERVATIONS = Array.isArray(saved) ? saved : [];
    } catch {
      window.MEMBER_RESERVATIONS = [];
    }
  },

  saveMemberReservations() {
    localStorage.setItem(
      window.MEMBER_RESERVATIONS_STORAGE_KEY,
      JSON.stringify(window.MEMBER_RESERVATIONS || [])
    );
  },

  normalizeMemberId(memberId) {
    return String(memberId || "").trim();
  },

  /** Confirmed local reservations counting toward the max-2 limit (legacy offline helper). */
  getActiveMemberReservations(memberId) {
    const id = this.normalizeMemberId(memberId);
    if (!id) return [];
    const today = this.getToday();
    return (window.MEMBER_RESERVATIONS || []).filter(
      (r) =>
        this.normalizeMemberId(r.memberId) === id &&
        r.checkOut &&
        r.checkOut > today &&
        String(r.status || "confirmed").toLowerCase() === "confirmed"
    );
  },

  canMemberAddReservation(memberId) {
    return (
      this.getActiveMemberReservations(memberId).length <
      (window.RESERVATION_MAX_ACTIVE || 2)
    );
  },

  addMemberReservation(record) {
    if (!window.MEMBER_RESERVATIONS) window.MEMBER_RESERVATIONS = [];
    window.MEMBER_RESERVATIONS.push(record);
    this.saveMemberReservations();
  },

  datesOverlap(checkIn, checkOut, bookingStart, bookingEnd) {
    return checkIn < bookingEnd && bookingStart < checkOut;
  },

  eachNight(checkIn, checkOut) {
    const nights = [];
    const d = new Date(`${checkIn}T12:00:00`);
    const end = new Date(`${checkOut}T12:00:00`);
    while (d < end) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      nights.push(`${y}-${m}-${day}`);
      d.setDate(d.getDate() + 1);
    }
    return nights;
  },

  /** Normalize date-like values to YYYY-MM-DD for reliable comparisons. */
  normalizeDate(value) {
    if (!value) return "";
    const s = String(value).trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
  },

  isNightBooked(night, bookings) {
    const n = this.normalizeDate(night);
    return bookings.some((b) => {
      const start = this.normalizeDate(b.checkIn);
      const end = this.normalizeDate(b.checkOut);
      return n >= start && n < end;
    });
  },

  /**
   * Drop the stay being edited from a SPOT_BOOKINGS-style list.
   * Prefer bookingId when present; also drop anonymous rows that match spot + dates.
   */
  excludeStay(bookings, spotId, checkIn, checkOut, bookingId = null) {
    if (!Array.isArray(bookings)) return [];
    const excludeId = bookingId ? String(bookingId) : null;
    const spot = spotId != null && spotId !== "" ? String(spotId) : null;
    const start = this.normalizeDate(checkIn);
    const end = this.normalizeDate(checkOut);
    let removedDateMatch = false;
    return bookings.filter((b) => {
      if (excludeId && b.bookingId != null && String(b.bookingId) === excludeId) {
        return false;
      }
      const dateMatch =
        Boolean(spot && start && end) &&
        String(b.spotId) === spot &&
        this.normalizeDate(b.checkIn) === start &&
        this.normalizeDate(b.checkOut) === end;
      if (dateMatch && !removedDateMatch && (!excludeId || b.bookingId == null)) {
        removedDateMatch = true;
        return false;
      }
      return true;
    });
  },

  applyExcludeOptions(bookings, options = {}) {
    if (!options || !Array.isArray(bookings)) return bookings || [];
    if (
      options.excludeBookingId ||
      (options.excludeSpotId && options.excludeCheckIn && options.excludeCheckOut)
    ) {
      return this.excludeStay(
        bookings,
        options.excludeSpotId,
        options.excludeCheckIn,
        options.excludeCheckOut,
        options.excludeBookingId || null
      );
    }
    return bookings;
  },

  /**
   * Max RV length for a site (feet). From map legend `sizeFeet` on RV units
   * (see scripts/apply-rv-meta.js). Non-RV units return null.
   */
  getUnitMaxLength(unit) {
    if (!unit || unit.category !== "rv") return null;
    const feet = Number(unit.sizeFeet);
    return Number.isFinite(feet) && feet > 0 ? feet : null;
  },

  /** Site-details fragment, e.g. "Length 60′". Null for condo/reunion or missing size. */
  formatUnitLengthBit(unit) {
    const feet = this.getUnitMaxLength(unit);
    if (feet == null) return null;
    return `Length ${feet}′`;
  },

  /**
   * Human-readable site details for hub cards / view / delete summaries.
   * RV includes type and length; condo/reunion omit length.
   */
  formatSiteDetails(spotId) {
    const unit = this.findUnit?.(spotId);
    if (!unit) return spotId ? `Site ID ${spotId}` : "No site selected";
    const bits = [];
    if (unit.category === "condo") {
      bits.push(`Condo ${unit.label}`);
      if (unit.bedrooms) bits.push(`${unit.bedrooms}-bedroom`);
    } else if (unit.category === "reunion") {
      bits.push(unit.name || `Family site ${unit.label}`);
    } else {
      bits.push(`Site ${unit.label}`);
      if (unit.type && window.SPOT_TYPE_LABELS?.[unit.type]) {
        bits.push(window.SPOT_TYPE_LABELS[unit.type]);
      }
      const lengthBit = this.formatUnitLengthBit(unit);
      if (lengthBit) bits.push(lengthBit);
    }
    return bits.join(" · ");
  },

  /** True when the site can hold the selected RV length (or length is unset). */
  unitFitsRigLength(unit, rigFeet) {
    if (rigFeet == null || rigFeet === "") return true;
    const needed = Number(rigFeet);
    if (!Number.isFinite(needed) || needed <= 0) return true;
    if (!unit || unit.category !== "rv") return true;
    const max = this.getUnitMaxLength(unit);
    if (max == null) return true;
    return max >= needed;
  },

  getStatusForDates(unit, checkIn, checkOut, options = {}) {
    // Length filter applies even before dates are chosen (black = unusable for this RV).
    if (!this.unitFitsRigLength(unit, options.rigLength)) return "tooShort";

    if (!checkIn || !checkOut || checkOut <= checkIn) return "unknown";

    let unitBookings = (window.SPOT_BOOKINGS || []).filter(
      (b) => String(b.spotId) === String(unit.id)
    );
    unitBookings = this.applyExcludeOptions(unitBookings, options);
    const nights = this.eachNight(checkIn, checkOut);
    let bookedNights = 0;

    nights.forEach((night) => {
      if (this.isNightBooked(night, unitBookings)) bookedNights += 1;
    });

    if (bookedNights === 0) return "available";
    if (bookedNights === nights.length) return "booked";
    return "partial";
  },

  countAvailable(checkIn, checkOut, category = null, options = {}) {
    if (!checkIn || !checkOut || checkOut <= checkIn) return null;
    let available = 0;
    const units = window.MAP_UNITS || [];
    units.forEach((unit) => {
      if (category && unit.category !== category) return;
      if (this.getStatusForDates(unit, checkIn, checkOut, options) === "available") {
        available += 1;
      }
    });
    return available;
  },

  findUnit(id) {
    return (window.MAP_UNITS || []).find((u) => u.id === id) || null;
  },

  formatDateRange(checkIn, checkOut) {
    const opts = { month: "short", day: "numeric", year: "numeric" };
    const start = new Date(`${checkIn}T12:00:00`);
    const end = new Date(`${checkOut}T12:00:00`);
    return `${start.toLocaleDateString("en-US", opts)} \u2192 ${end.toLocaleDateString("en-US", opts)}`;
  },

  /** Short stay label e.g. "Sep 10–14" or "Sep 28–Oct 2". */
  formatOriginalStayRange(checkIn, checkOut) {
    if (!checkIn || !checkOut) return "";
    const start = new Date(`${checkIn}T12:00:00`);
    const end = new Date(`${checkOut}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
    const sameMonth =
      start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      const mon = start.toLocaleDateString("en-US", { month: "short" });
      return `${mon} ${start.getDate()}\u2013${end.getDate()}`;
    }
    const opts = { month: "short", day: "numeric" };
    return `${start.toLocaleDateString("en-US", opts)}\u2013${end.toLocaleDateString("en-US", opts)}`;
  },


  getStayNights(checkIn, checkOut) {
    if (!checkIn || !checkOut || checkOut <= checkIn) return 0;
    return this.eachNight(checkIn, checkOut).length;
  },

  addDays(dateStr, days) {
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  },

  getToday() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  },

  getMaxCheckInDate() {
    return this.addDays(this.getToday(), window.RESERVATION_MAX_ADVANCE_DAYS || 60);
  },

  isCheckInWithinAdvanceWindow(checkIn) {
    if (!checkIn) return true;
    return checkIn <= this.getMaxCheckInDate();
  },

  /** Bookings for a unit within the next N days — no member identity exposed. */
  getUpcomingBookingsForUnit(unitId, daysAhead = 90) {
    const today = this.getToday();
    const windowEnd = this.addDays(today, daysAhead);
    return (window.SPOT_BOOKINGS || [])
      .filter((b) => String(b.spotId) === String(unitId))
      .filter((b) => b.checkOut > today && b.checkIn < windowEnd)
      .map((b) => ({
        bookingId: b.bookingId || null,
        spotId: String(b.spotId),
        checkIn: this.normalizeDate(b.checkIn),
        checkOut: this.normalizeDate(b.checkOut),
      }))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  },

  /** Booked date ranges for a unit — never includes who made the booking. */
  getBookingsForUnit(unitId, checkIn, checkOut, options = {}) {
    let bookings = (window.SPOT_BOOKINGS || [])
      .filter((b) => String(b.spotId) === String(unitId))
      .map((b) => ({
        bookingId: b.bookingId || null,
        spotId: String(b.spotId),
        checkIn: this.normalizeDate(b.checkIn),
        checkOut: this.normalizeDate(b.checkOut),
      }));

    bookings = this.applyExcludeOptions(bookings, options)
      .map((b) => ({ checkIn: b.checkIn, checkOut: b.checkOut }))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      return bookings;
    }

    const start = this.normalizeDate(checkIn);
    const end = this.normalizeDate(checkOut);
    return bookings.filter((b) => this.datesOverlap(start, end, b.checkIn, b.checkOut));
  },
};

window.MEMBER_RESERVATIONS = [];
window.SpotAvailability.loadMemberReservations();
