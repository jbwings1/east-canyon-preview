/**
 * Evaluate existing bookings against site reservation rules (for admin flags).
 * Covers class rights, max upcoming stays, max nights, advance window,
 * date validity, missing site, site/type mismatch, and same-site overlaps.
 */
(function (global) {
  function maxNights() {
    return global.RESERVATION_MAX_NIGHTS || 7;
  }

  function maxAdvanceDays() {
    return global.RESERVATION_MAX_ADVANCE_DAYS || 60;
  }

  function maxActive() {
    return global.RESERVATION_MAX_ACTIVE || 2;
  }

  function todayIso() {
    if (global.SpotAvailability?.getToday) return global.SpotAvailability.getToday();
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function normalizeDate(value) {
    if (!value) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addDays(dateStr, days) {
    if (global.SpotAvailability?.addDays) {
      return global.SpotAvailability.addDays(dateStr, days);
    }
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function stayNights(checkIn, checkOut) {
    if (global.SpotAvailability?.getStayNights) {
      return global.SpotAvailability.getStayNights(checkIn, checkOut);
    }
    if (global.MembershipRights?.eachNight) {
      return global.MembershipRights.eachNight(checkIn, checkOut).length;
    }
    const start = normalizeDate(checkIn);
    const end = normalizeDate(checkOut);
    if (!start || !end || end <= start) return 0;
    const nights = [];
    const d = new Date(`${start}T12:00:00`);
    const last = new Date(`${end}T12:00:00`);
    while (d < last) {
      nights.push(1);
      d.setDate(d.getDate() + 1);
    }
    return nights.length;
  }

  function datesOverlap(aStart, aEnd, bStart, bEnd) {
    if (global.Auth?.datesOverlap) {
      return global.Auth.datesOverlap(aStart, aEnd, bStart, bEnd);
    }
    return Boolean(aStart && aEnd && bStart && bEnd && aStart < bEnd && bStart < aEnd);
  }

  function bookingTypeUi(booking) {
    const raw = booking?.reservation_type || booking?.type || "";
    if (global.Auth?.toUiReservationType) {
      return global.Auth.toUiReservationType(raw) || raw;
    }
    if (raw === "family_reunion") return "family-reunion";
    return raw;
  }

  function needsAssignedSite(reservationType) {
    const MR = global.MembershipRights;
    if (!MR) {
      return (
        reservationType === "condo" ||
        reservationType === "rv" ||
        reservationType === "family-reunion" ||
        reservationType === "family_reunion"
      );
    }
    return (
      MR.isCondoReservationType(reservationType) ||
      MR.isRvReservationType(reservationType) ||
      MR.isReunionReservationType(reservationType)
    );
  }

  function expectedCategory(reservationType) {
    const MR = global.MembershipRights;
    if (MR?.isCondoReservationType(reservationType)) return "condo";
    if (MR?.isReunionReservationType(reservationType)) return "reunion";
    if (MR?.isRvReservationType(reservationType)) return "rv";
    if (reservationType === "condo") return "condo";
    if (reservationType === "family-reunion" || reservationType === "family_reunion") {
      return "reunion";
    }
    if (reservationType === "rv" || reservationType === "motorhome" || reservationType === "travel-trailer") {
      return "rv";
    }
    return null;
  }

  /** Confirmed stay not yet office-checked-in; still holds a max-2 slot until check-out ends. */
  function isUpcomingReservation(booking, today = todayIso()) {
    if (!booking || String(booking.status || "").toLowerCase() !== "confirmed") return false;
    const checkOut = normalizeDate(booking.check_out || booking.checkOut);
    return Boolean(checkOut && checkOut > today);
  }

  /** Stay activated by office check-in (status active) and not yet past check-out. */
  function isInProgressReservation(booking, today = todayIso()) {
    if (!booking || String(booking.status || "").toLowerCase() !== "active") return false;
    const checkOut = normalizeDate(booking.check_out || booking.checkOut);
    return Boolean(checkOut && checkOut > today);
  }

  function isCurrentOrUpcoming(booking, today = todayIso()) {
    if (!booking || String(booking.status || "").toLowerCase() === "cancelled") return false;
    const checkOut = normalizeDate(booking.check_out || booking.checkOut);
    if (checkOut && checkOut < today) return false;
    return true;
  }

  /**
   * @returns {{ ok: boolean, kinds: string[], violations: Array<{code:string,message:string}>, message: string }}
   */
  function evaluateBookingRules(booking, { allBookings = [], memberId = "" } = {}) {
    const violations = [];
    const kinds = new Set();

    if (!booking || String(booking.status || "").toLowerCase() === "cancelled") {
      return { ok: true, kinds: [], violations, message: "" };
    }

    const today = todayIso();
    const checkIn = normalizeDate(booking.check_in || booking.checkIn);
    const checkOut = normalizeDate(booking.check_out || booking.checkOut);
    const spot = String(booking.spot || "").trim();
    const reservationType = bookingTypeUi(booking);
    const memberBookings = (allBookings || []).filter(
      (b) => b.user_id && booking.user_id && b.user_id === booking.user_id
    );

    // Dates
    if (!checkIn || !checkOut) {
      kinds.add("dates");
      violations.push({
        code: "dates-missing",
        message: "Check-in or check-out date is missing.",
      });
    } else if (checkOut <= checkIn) {
      kinds.add("dates");
      violations.push({
        code: "dates-order",
        message: "Check-out must be after check-in.",
      });
    }

    // Max consecutive nights
    if (checkIn && checkOut && checkOut > checkIn) {
      const nights = stayNights(checkIn, checkOut);
      const cap = maxNights();
      if (nights > cap) {
        kinds.add("nights");
        violations.push({
          code: "max-nights",
          message: `Stay is ${nights} nights (maximum ${cap} consecutive days per reservation).`,
        });
      }
    }

    // Advance booking window (based on when the booking was created)
    if (checkIn && booking.created_at) {
      const createdDay = normalizeDate(booking.created_at);
      if (createdDay) {
        const latestAllowed = addDays(createdDay, maxAdvanceDays());
        if (checkIn > latestAllowed) {
          kinds.add("advance");
          violations.push({
            code: "advance-window",
            message: `Check-in was more than ${maxAdvanceDays()} days after the booking was made (advance limit).`,
          });
        }
      }
    }

    // Assigned site required for RV / condo / reunion
    if (needsAssignedSite(reservationType) && !spot) {
      kinds.add("site");
      violations.push({
        code: "site-missing",
        message: "No site/unit is assigned.",
      });
    }

    // Site must match reservation type
    if (spot && global.SpotAvailability?.findUnit) {
      const unit = global.SpotAvailability.findUnit(spot);
      const expected = expectedCategory(reservationType);
      if (!unit) {
        kinds.add("site");
        violations.push({
          code: "site-unknown",
          message: `Site/unit “${spot}” was not found on the map.`,
        });
      } else if (expected && unit.category !== expected) {
        kinds.add("site");
        violations.push({
          code: "site-type-mismatch",
          message: `Site/unit “${spot}” is a ${unit.category} site, but this booking is ${reservationType || "unknown type"}.`,
        });
      }
    }

    // Same-site overlap with another non-cancelled booking
    if (spot && checkIn && checkOut) {
      const overlaps = (allBookings || []).filter((other) => {
        if (!other || other.id === booking.id) return false;
        const otherStatus = String(other.status || "").toLowerCase();
        if (otherStatus === "cancelled" || otherStatus === "pending" || otherStatus === "completed") {
          return false;
        }
        if (String(other.spot || "").trim() !== spot) return false;
        const oIn = normalizeDate(other.check_in || other.checkIn);
        const oOut = normalizeDate(other.check_out || other.checkOut);
        return datesOverlap(checkIn, checkOut, oIn, oOut);
      });
      if (overlaps.length) {
        kinds.add("overlap");
        violations.push({
          code: "site-overlap",
          message: `Overlaps another booking on site/unit ${spot}.`,
        });
      }
    }

    // Max reservations held before office check-in (checked-in / active stays do not count)
    const upcoming = memberBookings.filter((b) => isUpcomingReservation(b, today)).length;
    const capActive = maxActive();
    if (upcoming > capActive && isUpcomingReservation(booking, today)) {
      kinds.add("limit");
      violations.push({
        code: "max-active",
        message: `Member has ${upcoming} upcoming reservation${upcoming === 1 ? "" : "s"} (maximum ${capActive}).`,
      });
    }

    // Membership class rights
    if (global.MembershipRights?.evaluateExistingBooking) {
      const gate = global.MembershipRights.evaluateExistingBooking(
        booking,
        memberBookings,
        memberId
      );
      if (!gate.ok) {
        kinds.add("class");
        (gate.violations || []).forEach((v) => {
          violations.push({
            code: v.code || "class",
            message: v.message || "Breaks membership class rules.",
          });
        });
      }
    }

    const kindList = [...kinds];
    const message = violations
      .map((v) => v.message)
      .filter(Boolean)
      .join(" ");

    return {
      ok: violations.length === 0,
      kinds: kindList,
      violations,
      message,
    };
  }

  function flagLabel(kinds) {
    const set = new Set(kinds || []);
    if (set.size === 0) return "Rule flag";
    if (set.size > 1) return "Rule flag";
    if (set.has("class")) return "Class flag";
    if (set.has("limit")) return "Limit flag";
    if (set.has("nights")) return "Length flag";
    if (set.has("advance")) return "Advance flag";
    if (set.has("site") || set.has("overlap")) return "Site flag";
    if (set.has("dates")) return "Date flag";
    return "Rule flag";
  }

  function displayStatus(booking, today = todayIso()) {
    const status = String(booking?.status || "").toLowerCase();
    if (status === "cancelled") return "Cancelled";
    if (status === "pending") return "Pending";
    if (status === "completed") return "Completed";
    if (status === "active") {
      const checkOut = normalizeDate(booking.check_out || booking.checkOut);
      if (checkOut && checkOut <= today) return "Completed";
      return "Active";
    }
    if (status === "confirmed") {
      const checkOut = normalizeDate(booking.check_out || booking.checkOut);
      if (checkOut && checkOut <= today) return "Completed";
      return "Confirmed";
    }
    return booking?.status || "—";
  }

  global.BookingRuleFlags = {
    evaluateBookingRules,
    flagLabel,
    displayStatus,
    maxNights,
    maxAdvanceDays,
    maxActive,
    isUpcomingReservation,
    isInProgressReservation,
    isCurrentOrUpcoming,
  };
})(typeof window !== "undefined" ? window : globalThis);
