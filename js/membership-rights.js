/**
 * Membership class rights for booking controls.
 * Source: membership-use-rights.html / Policies §3.2, seasons §2.10–2.11,
 * reservation year §2.12, Class C anytime §5.1.7.
 */
(function (global) {
  const FULL_CLASSES = ["A", "B", "C", "D", "F", "G", "H", "I", "L", "M", "O", "P", "Q"];

  /** Regular Time allotments and lodging rights by class (§3.2). */
  const CLASS_RIGHTS = {
    A: {
      summerDays: 5,
      winterDays: 5,
      rvAllowed: true,
      condoAllowed: true,
      reunionAllowed: true,
      notes: "5 Summer / 5 Winter Regular; RV Use",
    },
    B: {
      summerDays: 4,
      winterDays: 4,
      rvAllowed: true,
      condoAllowed: true,
      reunionAllowed: true,
      notes: "4 Summer / 4 Winter Regular; RV Use",
    },
    C: {
      summerDays: 4,
      winterDays: 0,
      rvAllowed: true,
      condoAllowed: true,
      reunionAllowed: true,
      daysAnytime: true,
      notes: "4 Regular days anytime in the year (§5.1.7); RV Use",
    },
    D: {
      summerDays: 0,
      winterDays: 0,
      rvAllowed: true,
      condoAllowed: false,
      reunionAllowed: true,
      notes: "RV Use only (no Regular condo)",
    },
    F: {
      summerDays: 4,
      winterDays: 3,
      rvAllowed: true,
      condoAllowed: true,
      reunionAllowed: true,
      notes: "4 Summer / 3 Winter Regular; RV Use",
    },
    G: {
      summerDays: 7,
      winterDays: 7,
      rvAllowed: true,
      condoAllowed: true,
      reunionAllowed: true,
      notes: "7 Summer / 7 Winter Regular; RV Use",
    },
    H: {
      summerDays: 5,
      winterDays: 5,
      rvAllowed: true,
      condoAllowed: true,
      reunionAllowed: true,
      notes: "Corporate; 5 Summer / 5 Winter Regular; RV Use with occupancy rules",
    },
    I: {
      summerDays: 5,
      winterDays: 5,
      rvAllowed: true,
      condoAllowed: true,
      reunionAllowed: true,
      notes: "Corporate; 5 Summer / 5 Winter Regular; RV Use with occupancy rules",
    },
    L: {
      summerDays: 0,
      winterDays: 0,
      rvAllowed: true,
      condoAllowed: false,
      reunionAllowed: true,
      notes: "RV Use only (no Regular condo)",
    },
    M: {
      summerDays: 4,
      winterDays: 3,
      rvAllowed: true,
      condoAllowed: true,
      reunionAllowed: true,
      notes: "4 Summer / 3 Winter Regular; RV Use",
    },
    O: {
      summerDays: 4,
      winterDays: 3,
      rvAllowed: false,
      condoAllowed: true,
      reunionAllowed: true,
      notes: "Condo Regular only (no RV Use)",
    },
    P: {
      summerDays: 7,
      winterDays: 7,
      rvAllowed: false,
      condoAllowed: true,
      reunionAllowed: true,
      notes: "Condo Regular only (no RV Use)",
    },
    Q: {
      summerDays: 4,
      winterDays: 3,
      rvAllowed: false,
      condoAllowed: true,
      reunionAllowed: true,
      notes: "Condo Regular in fixed purchase-agreement week; no RV Use",
    },
    RR: {
      summerDays: 0,
      winterDays: 0,
      rvAllowed: true,
      condoAllowed: false,
      reunionAllowed: true,
      notes: "Relative Rights: no Regular Time; Bonus Time only online (no Regular condo)",
    },
    T: {
      summerDays: 0,
      winterDays: 0,
      rvAllowed: false,
      condoAllowed: true,
      reunionAllowed: true,
      notes: "Temporary Member Condo / FRA — limited stay rights",
    },
  };

  function normalizeMemberId(value) {
    return String(value || "")
      .trim()
      .toUpperCase();
  }

  /**
   * Parse class from the start of Member ID (e.g. L123, L-123, A-0042, RR-12, T-9).
   * Returns null when the prefix is not a known class.
   */
  function parseClassFromMemberId(memberId) {
    const raw = normalizeMemberId(memberId);
    if (!raw) return null;
    if (/^RR(?:[-–\s]|\d|$)/.test(raw) || raw === "RR") return "RR";
    if (/^T(?:[-–\s]|\d|$)/.test(raw)) return "T";
    const letter = raw.charAt(0);
    if (FULL_CLASSES.includes(letter)) return letter;
    return null;
  }

  function getRights(classCode) {
    if (!classCode) return null;
    return CLASS_RIGHTS[String(classCode).toUpperCase()] || null;
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

  function eachNight(checkIn, checkOut) {
    const start = normalizeDate(checkIn);
    const end = normalizeDate(checkOut);
    if (!start || !end || end <= start) return [];
    if (global.SpotAvailability?.eachNight) {
      return global.SpotAvailability.eachNight(start, end);
    }
    const nights = [];
    const d = new Date(`${start}T12:00:00`);
    const last = new Date(`${end}T12:00:00`);
    while (d < last) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      nights.push(`${y}-${m}-${day}`);
      d.setDate(d.getDate() + 1);
    }
    return nights;
  }

  /** Summer May 15–Sep 15; Winter Sep 16–May 14 (§2.10–2.11). */
  function seasonForNight(dateStr) {
    const n = normalizeDate(dateStr);
    if (!n) return null;
    const md = n.slice(5); // MM-DD
    if (md >= "05-15" && md <= "09-15") return "summer";
    return "winter";
  }

  /** Reservation year begins Apr 1 and ends Mar 31 (§2.12). Returns April 1 YYYY. */
  function reservationYearStart(dateStr) {
    const n = normalizeDate(dateStr);
    if (!n) return null;
    const y = Number(n.slice(0, 4));
    const md = n.slice(5);
    const year = md >= "04-01" ? y : y - 1;
    return `${year}-04-01`;
  }

  function isCondoReservationType(value) {
    return value === "condo";
  }

  function isRvReservationType(value) {
    return value === "rv" || value === "motorhome" || value === "travel-trailer";
  }

  function isReunionReservationType(value) {
    return value === "family-reunion" || value === "reunion" || value === "family_reunion";
  }

  function bookingTypeUi(booking) {
    const raw = booking?.reservation_type || booking?.type || "";
    if (global.Auth?.toUiReservationType) {
      return global.Auth.toUiReservationType(raw) || raw;
    }
    if (raw === "family_reunion") return "family-reunion";
    return raw;
  }

  function isConfirmedBooking(booking) {
    const status = String(booking?.status || "").toLowerCase();
    return status === "confirmed" || status === "active";
  }

  function isCondoBooking(booking) {
    return isCondoReservationType(bookingTypeUi(booking));
  }

  /**
   * Count nights of a stay by season (and reservation year).
   * Class C (daysAnytime): all nights go under key "anytime".
   */
  function countStayNightsByBucket(checkIn, checkOut, rights) {
    const nights = eachNight(checkIn, checkOut);
    const buckets = {};
    nights.forEach((night) => {
      const yearStart = reservationYearStart(night);
      if (!yearStart) return;
      if (rights?.daysAnytime) {
        const key = `${yearStart}|anytime`;
        buckets[key] = (buckets[key] || 0) + 1;
        return;
      }
      const season = seasonForNight(night);
      const key = `${yearStart}|${season}`;
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return buckets;
  }

  function allotmentForBucket(rights, bucketKey) {
    if (!rights) return 0;
    const season = bucketKey.split("|")[1];
    if (season === "anytime" || rights.daysAnytime) {
      return Number(rights.summerDays) || 0;
    }
    if (season === "summer") return Number(rights.summerDays) || 0;
    if (season === "winter") return Number(rights.winterDays) || 0;
    return 0;
  }

  function seasonLabel(season) {
    if (season === "anytime") return "Regular (anytime)";
    if (season === "summer") return "Summer Regular";
    if (season === "winter") return "Winter Regular";
    return "Regular";
  }

  function yearLabel(yearStart) {
    if (!yearStart) return "";
    const y = Number(yearStart.slice(0, 4));
    return `reservation year ${y}–${y + 1}`;
  }

  /**
   * Sum confirmed condo Regular nights already used, grouped by year|season.
   * Excludes excludeBookingId (edit flow).
   */
  function usedCondoNightsByBucket(bookings, { excludeBookingId = null, rights = null } = {}) {
    const used = {};
    (bookings || []).forEach((b) => {
      if (!isConfirmedBooking(b)) return;
      if (!isCondoBooking(b)) return;
      if (excludeBookingId && String(b.id) === String(excludeBookingId)) return;
      const checkIn = b.check_in || b.checkIn;
      const checkOut = b.check_out || b.checkOut;
      const buckets = countStayNightsByBucket(checkIn, checkOut, rights);
      Object.keys(buckets).forEach((key) => {
        used[key] = (used[key] || 0) + buckets[key];
      });
    });
    return used;
  }

  function typeAllowed(rights, reservationType) {
    if (!rights || !reservationType) return { allowed: true };
    if (isCondoReservationType(reservationType)) {
      return {
        allowed: rights.condoAllowed === true,
        kind: "condo",
        label: "condo",
      };
    }
    if (isRvReservationType(reservationType)) {
      return {
        allowed: rights.rvAllowed === true,
        kind: "rv",
        label: "RV",
      };
    }
    if (isReunionReservationType(reservationType)) {
      return {
        allowed: rights.reunionAllowed !== false,
        kind: "reunion",
        label: "family reunion",
      };
    }
    return { allowed: true };
  }

  /**
   * Validate a proposed booking against class rights.
   * @returns {{ ok: boolean, classCode: string|null, rights: object|null, violations: Array }}
   */
  function validateBooking({
    memberId,
    classCode: classCodeIn = null,
    reservationType,
    checkIn,
    checkOut,
    existingBookings = [],
    excludeBookingId = null,
  } = {}) {
    const classCode = classCodeIn || parseClassFromMemberId(memberId);
    const rights = getRights(classCode);
    const violations = [];

    if (!classCode || !rights) {
      return { ok: true, classCode: classCode || null, rights: null, violations };
    }

    const typeGate = typeAllowed(rights, reservationType);
    if (!typeGate.allowed) {
      violations.push({
        code: "type-disallowed",
        kind: typeGate.kind,
        message: `Class ${classCode} cannot book ${typeGate.label} stays. ${rights.notes || ""}`.trim(),
      });
    }

    if (isCondoReservationType(reservationType) && rights.condoAllowed) {
      const needed = countStayNightsByBucket(checkIn, checkOut, rights);
      const used = usedCondoNightsByBucket(existingBookings, {
        excludeBookingId,
        rights,
      });

      Object.keys(needed).forEach((key) => {
        const [, season] = key.split("|");
        const allotment = allotmentForBucket(rights, key);
        const already = used[key] || 0;
        const request = needed[key] || 0;
        const remaining = Math.max(0, allotment - already);
        if (request > remaining) {
          const yearStart = key.split("|")[0];
          violations.push({
            code: "condo-days",
            season,
            yearStart,
            allotment,
            used: already,
            remaining,
            requested: request,
            message:
              `Class ${classCode} has ${remaining} ${seasonLabel(season)} day${remaining === 1 ? "" : "s"} left ` +
              `(${already} of ${allotment} used) for ${yearLabel(yearStart)}. ` +
              `This stay uses ${request} night${request === 1 ? "" : "s"}. Please reduce the nights of the reservation.`,
          });
        }
      });

      // Zero Regular allotment and daysAnytime false with condoAllowed true shouldn't happen;
      // Class with condoAllowed and 0/0 would fail type? D/L have condoAllowed false.
      if (rights.daysAnytime && (rights.summerDays || 0) === 0) {
        /* no Regular pool */
      }
    }

    // Condo with 0 Regular days but condoAllowed true (shouldn't occur) — still ok for Bonus later.
    // Classes with condoAllowed false already violated on type.

    return {
      ok: violations.length === 0,
      classCode,
      rights,
      violations,
    };
  }

  function formatViolations(violations) {
    return (violations || []).map((v) => v.message).filter(Boolean).join(" ");
  }

  /**
   * Check an existing booking against class rights (other member bookings as context).
   * Cancelled stays are not flagged.
   */
  function evaluateExistingBooking(booking, memberBookings = [], memberId = "") {
    if (!booking || String(booking.status || "").toLowerCase() === "cancelled") {
      return { ok: true, classCode: null, rights: null, violations: [] };
    }
    return validateBooking({
      memberId,
      reservationType: bookingTypeUi(booking),
      checkIn: booking.check_in || booking.checkIn,
      checkOut: booking.check_out || booking.checkOut,
      existingBookings: memberBookings,
      excludeBookingId: booking.id,
    });
  }

  function ensureOverrideDialog() {
    let root = document.getElementById("membership-override-dialog");
    if (root) return root;

    root = document.createElement("div");
    root.id = "membership-override-dialog";
    root.className = "membership-override-dialog";
    root.hidden = true;
    root.innerHTML = `
      <div class="membership-override-backdrop" data-override-dismiss="start-over"></div>
      <div class="membership-override-panel" role="dialog" aria-modal="true" aria-labelledby="membership-override-title">
        <h2 id="membership-override-title">Membership limit</h2>
        <p id="membership-override-message" class="membership-override-message"></p>
        <div class="membership-override-actions">
          <button type="button" class="btn btn-primary" data-override-choice="override">Override</button>
          <button type="button" class="btn btn-outline" data-override-choice="start-over">Start over</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  }

  /**
   * Theme-matched admin warning. Resolves true = Override, false = Start over.
   */
  function showOverrideDialog(message) {
    const root = ensureOverrideDialog();
    const msgEl = root.querySelector("#membership-override-message");
    if (msgEl) msgEl.textContent = message || "This booking exceeds the member’s class limits.";
    root.hidden = false;
    document.body.classList.add("membership-override-open");

    return new Promise((resolve) => {
      const finish = (override) => {
        root.hidden = true;
        document.body.classList.remove("membership-override-open");
        root.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKey);
        resolve(Boolean(override));
      };
      const onClick = (event) => {
        const choice = event.target?.closest?.("[data-override-choice], [data-override-dismiss]");
        if (!choice) return;
        const value =
          choice.getAttribute("data-override-choice") ||
          choice.getAttribute("data-override-dismiss");
        finish(value === "override");
      };
      const onKey = (event) => {
        if (event.key === "Escape") finish(false);
      };
      root.addEventListener("click", onClick);
      document.addEventListener("keydown", onKey);
      root.querySelector('[data-override-choice="override"]')?.focus();
    });
  }

  function getClassRuleLines(classCode) {
    const code = String(classCode || "").toUpperCase();
    const rights = getRights(code);
    if (!rights) return null;

    const lines = [];
    lines.push(`Membership class ${code}`);

    if (rights.daysAnytime) {
      lines.push(
        `${rights.summerDays} Regular Time day${rights.summerDays === 1 ? "" : "s"} anytime in the reservation year (Apr 1–Mar 31).`
      );
    } else if ((rights.summerDays || 0) > 0 || (rights.winterDays || 0) > 0) {
      lines.push(
        `Regular Time: ${rights.summerDays || 0} Summer day${(rights.summerDays || 0) === 1 ? "" : "s"} (May 15–Sep 15) and ${rights.winterDays || 0} Winter day${(rights.winterDays || 0) === 1 ? "" : "s"} (Sep 16–May 14) per reservation year.`
      );
    } else {
      lines.push("No Regular Time condo allotment for this class.");
    }

    const lodging = [];
    if (rights.condoAllowed) lodging.push("condo Regular Time");
    else lodging.push("no Regular condo");
    if (rights.rvAllowed) lodging.push("RV Use");
    else lodging.push("no RV Use");
    if (rights.reunionAllowed !== false) lodging.push("family reunion sites");
    lines.push(`Lodging rights: ${lodging.join("; ")}.`);

    if (code === "RR") {
      lines.push("Relative Rights: Bonus Time only online (space available); no Regular Time.");
    } else if (code === "Q") {
      lines.push("Condo Regular Time is limited to the fixed week in the purchase agreement.");
    } else if (code === "H" || code === "I") {
      lines.push("Corporate class: designated-member occupancy rules apply (see Policies §3.2).");
    } else if (code === "T") {
      lines.push("Temporary membership: limited condo / family reunion stay rights.");
    } else if (!rights.daysAnytime && ((rights.summerDays || 0) > 0 || (rights.winterDays || 0) > 0)) {
      lines.push("Bonus Time may be available online when space allows (does not use Regular Time days).");
    }

    lines.push("You may hold up to 2 confirmed reservations at a time until office check-in.");
    lines.push("Each reservation is limited to 7 consecutive nights and must start within 60 days.");

    if (rights.notes) {
      lines.push(`Summary: ${rights.notes}.`);
    }

    return { classCode: code, rights, lines };
  }

  function describeClassRules(memberId, classCodeIn = null) {
    const classCode = classCodeIn || parseClassFromMemberId(memberId);
    return getClassRuleLines(classCode);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Fill a container with class rules for the member.
   * @returns {boolean} true if rules were rendered
   */
  function renderClassRules(container, { memberId = "", classCode = null } = {}) {
    if (!container) return false;
    const described = describeClassRules(memberId, classCode);
    if (!described) {
      container.hidden = true;
      container.innerHTML = "";
      return false;
    }
    container.hidden = false;
    container.innerHTML = `
      <div class="member-class-rules-head">
        <h2 class="member-class-rules-title">Your class rules</h2>
        <a class="member-class-rules-sheet-link" href="membership-use-rights.html">Class information sheet</a>
      </div>
      <p class="member-class-rules-lead">
        These limits apply to Class ${escapeHtml(described.classCode)} based on resort membership use rights.
      </p>
      <ul class="member-class-rules-list">
        ${described.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>
      <p class="member-class-rules-more">
        <a href="membership-use-rights.html">Full membership use rights</a>
        · <a href="policies-and-rules.html">Policies and Rules</a>
      </p>
    `;
    return true;
  }

  const MembershipRights = {
    FULL_CLASSES,
    CLASS_RIGHTS,
    parseClassFromMemberId,
    getRights,
    getClassRuleLines,
    describeClassRules,
    renderClassRules,
    seasonForNight,
    reservationYearStart,
    eachNight,
    countStayNightsByBucket,
    usedCondoNightsByBucket,
    typeAllowed,
    validateBooking,
    formatViolations,
    evaluateExistingBooking,
    showOverrideDialog,
    isCondoReservationType,
    isRvReservationType,
    isReunionReservationType,
  };

  global.MembershipRights = MembershipRights;
})(typeof window !== "undefined" ? window : globalThis);
