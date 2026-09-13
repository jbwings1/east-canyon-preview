/**
 * Unified booking limit evaluation + admin per-rule override UX.
 * Rule ids: max_nights, max_open_reservations, regular_time, type_disallowed,
 * consecutive_14_vacate_7.
 */
(function (global) {
  const RULE = {
    MAX_NIGHTS: "max_nights",
    MAX_OPEN: "max_open_reservations",
    REGULAR_TIME: "regular_time",
    TYPE_DISALLOWED: "type_disallowed",
    CONSECUTIVE_14: "consecutive_14_vacate_7",
  };

  const RULE_LABELS = {
    [RULE.MAX_NIGHTS]: "Max 7 consecutive nights per reservation",
    [RULE.MAX_OPEN]: "Maximum 2 upcoming reservations",
    [RULE.REGULAR_TIME]: "Regular Time condo allotment",
    [RULE.TYPE_DISALLOWED]: "Membership class lodging rights",
    [RULE.CONSECUTIVE_14]: "14 consecutive days then 7 days off",
  };

  const STREAK_MAX_DAYS = 14;
  const VACATE_CLEAR_DAYS = 7;

  function maxNights() {
    return global.RESERVATION_MAX_NIGHTS || 7;
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
    let n = 0;
    const d = new Date(`${start}T12:00:00`);
    const last = new Date(`${end}T12:00:00`);
    while (d < last) {
      n += 1;
      d.setDate(d.getDate() + 1);
    }
    return n;
  }

  function bookingTypeUi(booking) {
    const raw = booking?.reservation_type || booking?.type || "";
    if (global.Auth?.toUiReservationType) {
      return global.Auth.toUiReservationType(raw) || raw;
    }
    if (raw === "family_reunion") return "family-reunion";
    return raw;
  }

  function isLodgingForStreak(reservationType) {
    const t = String(reservationType || "").toLowerCase();
    const MR = global.MembershipRights;
    if (MR?.isCondoReservationType?.(t)) return true;
    if (MR?.isRvReservationType?.(t)) return true;
    if (t === "wilderness" || t === "wilderness-camp" || t === "wilderness_camp") return true;
    if (t === "condo" || t === "rv" || t === "motorhome" || t === "travel-trailer") return true;
    return false;
  }

  function isConfirmedOrActive(booking) {
    const status = String(booking?.status || "").toLowerCase();
    return status === "confirmed" || status === "active";
  }

  function isUpcomingReservation(booking, today = todayIso()) {
    if (!booking || String(booking.status || "").toLowerCase() !== "confirmed") return false;
    const checkOut = normalizeDate(booking.check_out || booking.checkOut);
    return Boolean(checkOut && checkOut > today);
  }

  /**
   * Merge confirmed/active lodging stays into continuous occupancy streaks.
   * Back-to-back: check-out of one === check-in of next → continuous.
   */
  function buildOccupancyStreaks(bookings, { excludeBookingId = null } = {}) {
    const intervals = [];
    (bookings || []).forEach((b) => {
      if (!isConfirmedOrActive(b)) return;
      if (excludeBookingId && String(b.id) === String(excludeBookingId)) return;
      const type = bookingTypeUi(b);
      if (!isLodgingForStreak(type)) return;
      const start = normalizeDate(b.check_in || b.checkIn);
      const end = normalizeDate(b.check_out || b.checkOut);
      if (!start || !end || end <= start) return;
      intervals.push({ start, end });
    });
    intervals.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

    const streaks = [];
    intervals.forEach((iv) => {
      const last = streaks[streaks.length - 1];
      if (last && iv.start <= last.end) {
        if (iv.end > last.end) last.end = iv.end;
        return;
      }
      streaks.push({ start: iv.start, end: iv.end });
    });

    return streaks.map((s) => ({
      start: s.start,
      end: s.end,
      nights: stayNights(s.start, s.end),
    }));
  }

  function evaluateConsecutiveOccupancy({
    checkIn,
    checkOut,
    existingBookings = [],
    excludeBookingId = null,
    reservationType = "rv",
  } = {}) {
    const inDate = normalizeDate(checkIn);
    const outDate = normalizeDate(checkOut);
    if (!inDate || !outDate || outDate <= inDate) {
      return { ok: true, violations: [] };
    }
    if (!isLodgingForStreak(reservationType)) {
      return { ok: true, violations: [] };
    }

    const existingStreaks = buildOccupancyStreaks(existingBookings, { excludeBookingId });
    const withProposed = buildOccupancyStreaks(
      [
        ...(existingBookings || []),
        {
          id: "__proposed__",
          status: "confirmed",
          reservation_type: reservationType,
          check_in: inDate,
          check_out: outDate,
        },
      ],
      { excludeBookingId }
    );

    const violations = [];

    const over = withProposed.find((s) => s.nights > STREAK_MAX_DAYS);
    if (over) {
      violations.push({
        rule: RULE.CONSECUTIVE_14,
        label: RULE_LABELS[RULE.CONSECUTIVE_14],
        code: RULE.CONSECUTIVE_14,
        message:
          `This stay would create ${over.nights} consecutive days of occupancy ` +
          `(${over.start} → ${over.end}). After ${STREAK_MAX_DAYS} consecutive days ` +
          `(condo, RV, or wilderness combined), you must be off the resort at least ` +
          `${VACATE_CLEAR_DAYS} days.`,
        streakNights: over.nights,
        streakStart: over.start,
        streakEnd: over.end,
      });
    }

    existingStreaks.forEach((s) => {
      if (s.nights < STREAK_MAX_DAYS) return;
      if (s.end > inDate) return;
      const earliestReturn = addDays(s.end, VACATE_CLEAR_DAYS);
      if (inDate < earliestReturn) {
        violations.push({
          rule: RULE.CONSECUTIVE_14,
          label: RULE_LABELS[RULE.CONSECUTIVE_14],
          code: RULE.CONSECUTIVE_14,
          message:
            `After ${s.nights} consecutive days of occupancy ending ${s.end}, ` +
            `you must be off the resort at least ${VACATE_CLEAR_DAYS} clear days. ` +
            `Earliest check-in is ${earliestReturn}.`,
          streakNights: s.nights,
          streakStart: s.start,
          streakEnd: s.end,
          earliestReturn,
        });
      }
    });

    // Dedupe same rule if both fired
    if (violations.length > 1) {
      return { ok: false, violations: [violations[0]] };
    }
    return { ok: violations.length === 0, violations };
  }

  function condoStatusForStay({
    memberId,
    classCode: classCodeIn = null,
    reservationType,
    checkIn,
    checkOut,
    existingBookings = [],
    excludeBookingId = null,
  } = {}) {
    const MR = global.MembershipRights;
    if (!MR?.isCondoReservationType?.(reservationType)) return null;
    const classCode = classCodeIn || MR.parseClassFromMemberId?.(memberId);
    const rights = MR.getRights?.(classCode);
    if (!rights || !rights.condoAllowed) return null;

    const used = MR.usedCondoNightsByBucket(existingBookings, {
      excludeBookingId,
      rights,
    });
    const needed = MR.countStayNightsByBucket(checkIn, checkOut, rights);
    const buckets = new Set([...Object.keys(used), ...Object.keys(needed)]);
    if (!buckets.size && (checkIn || checkOut)) {
      // Still show allotment summary for current reservation year of check-in
      const yearStart = MR.reservationYearStart?.(checkIn || todayIso());
      if (yearStart) {
        if (rights.daysAnytime) buckets.add(`${yearStart}|anytime`);
        else {
          buckets.add(`${yearStart}|summer`);
          buckets.add(`${yearStart}|winter`);
        }
      }
    }

    const lines = [];
    [...buckets].sort().forEach((key) => {
      const [yearStart, season] = key.split("|");
      const allotment = MR.allotmentForBucket
        ? MR.allotmentForBucket(rights, key)
        : season === "winter"
          ? Number(rights.winterDays) || 0
          : Number(rights.summerDays) || 0;
      const already = used[key] || 0;
      const request = needed[key] || 0;
      const remaining = Math.max(0, allotment - already);
      const seasonName =
        season === "anytime"
          ? "Regular (anytime)"
          : season === "summer"
            ? "Summer Regular"
            : season === "winter"
              ? "Winter Regular"
              : "Regular";
      const yearBit = yearStart
        ? ` (${Number(yearStart.slice(0, 4))}–${Number(yearStart.slice(0, 4)) + 1})`
        : "";
      let line = `${seasonName}${yearBit}: ${already} used, ${remaining} left of ${allotment}`;
      if (request > 0) line += ` (this stay uses ${request})`;
      lines.push(line);
    });

    return {
      classCode,
      lines,
      text: lines.length
        ? `Regular Time — ${lines.join("; ")}.`
        : `Class ${classCode} Regular Time condo allotment applies to this stay.`,
    };
  }

  /**
   * Full proposed-stay evaluation for create/edit.
   */
  function evaluateProposedStay({
    memberId,
    classCode = null,
    reservationType,
    checkIn,
    checkOut,
    existingBookings = [],
    excludeBookingId = null,
    isNewBooking = true,
  } = {}) {
    const violations = [];
    const inDate = normalizeDate(checkIn);
    const outDate = normalizeDate(checkOut);
    const nights = stayNights(inDate, outDate);
    const cap = maxNights();

    if (inDate && outDate && outDate > inDate && nights > cap) {
      violations.push({
        rule: RULE.MAX_NIGHTS,
        label: RULE_LABELS[RULE.MAX_NIGHTS],
        code: RULE.MAX_NIGHTS,
        message: `Stay is ${nights} nights (maximum ${cap} consecutive days per reservation).`,
        nights,
        cap,
      });
    }

    if (isNewBooking) {
      const today = todayIso();
      const upcoming = (existingBookings || []).filter(
        (b) =>
          (!excludeBookingId || String(b.id) !== String(excludeBookingId)) &&
          isUpcomingReservation(b, today)
      );
      const maxOpen = maxActive();
      if (upcoming.length >= maxOpen) {
        violations.push({
          rule: RULE.MAX_OPEN,
          label: RULE_LABELS[RULE.MAX_OPEN],
          code: RULE.MAX_OPEN,
          message: `Member has ${upcoming.length} upcoming reservation${
            upcoming.length === 1 ? "" : "s"
          } (maximum ${maxOpen}).`,
          count: upcoming.length,
          cap: maxOpen,
        });
      }
    }

    if (global.MembershipRights?.validateBooking) {
      const gate = global.MembershipRights.validateBooking({
        memberId,
        classCode,
        reservationType,
        checkIn: inDate,
        checkOut: outDate,
        existingBookings,
        excludeBookingId,
      });
      (gate.violations || []).forEach((v) => {
        const rule =
          v.rule === RULE.TYPE_DISALLOWED ||
          v.code === "type-disallowed" ||
          v.code === RULE.TYPE_DISALLOWED
            ? RULE.TYPE_DISALLOWED
            : RULE.REGULAR_TIME;
        violations.push({
          rule,
          label: RULE_LABELS[rule],
          code: rule,
          message: v.message,
          season: v.season,
          used: v.used,
          remaining: v.remaining,
          allotment: v.allotment,
          requested: v.requested,
        });
      });
    }

    if (isLodgingForStreak(reservationType)) {
      const streak = evaluateConsecutiveOccupancy({
        checkIn: inDate,
        checkOut: outDate,
        existingBookings,
        excludeBookingId,
        reservationType,
      });
      (streak.violations || []).forEach((v) => violations.push(v));
    }

    const condoStatus = condoStatusForStay({
      memberId,
      classCode,
      reservationType,
      checkIn: inDate,
      checkOut: outDate,
      existingBookings,
      excludeBookingId,
    });

    return {
      ok: violations.length === 0,
      violations,
      condoStatus,
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Session draft overrides keyed by rule id. */
  function createOverrideSession() {
    let drafts = {};
    let fingerprint = "";

    function fingerprintFor(fields) {
      return [
        fields.memberId || "",
        fields.reservationType || "",
        normalizeDate(fields.checkIn) || "",
        normalizeDate(fields.checkOut) || "",
        fields.excludeBookingId || "",
      ].join("|");
    }

    function syncFingerprint(fields) {
      const next = fingerprintFor(fields);
      if (next !== fingerprint) {
        fingerprint = next;
        drafts = {};
      }
    }

    function clear() {
      drafts = {};
      fingerprint = "";
    }

    function list() {
      return Object.values(drafts);
    }

    function has(rule) {
      return Boolean(drafts[rule]);
    }

    function add(record) {
      if (!record?.rule) return;
      drafts[record.rule] = record;
    }

    function pendingViolations(violations) {
      return (violations || []).filter((v) => v?.rule && !drafts[v.rule]);
    }

    function allCovered(violations) {
      return pendingViolations(violations).length === 0;
    }

    return {
      clear,
      syncFingerprint,
      list,
      has,
      add,
      pendingViolations,
      allCovered,
      fingerprintFor,
    };
  }

  function ensureOverrideDialog() {
    let root = document.getElementById("booking-rule-override-dialog");
    if (root) return root;

    root = document.createElement("div");
    root.id = "booking-rule-override-dialog";
    root.className = "membership-override-dialog";
    root.hidden = true;
    root.innerHTML = `
      <div class="membership-override-backdrop" data-override-dismiss="cancel"></div>
      <div class="membership-override-panel" role="dialog" aria-modal="true" aria-labelledby="booking-rule-override-title">
        <h2 id="booking-rule-override-title">Override booking rule</h2>
        <p id="booking-rule-override-rule" class="membership-override-message"></p>
        <p id="booking-rule-override-detail" class="membership-override-message"></p>
        <label class="booking-rule-override-note-label" for="booking-rule-override-note">Reason note (required)</label>
        <textarea id="booking-rule-override-note" class="booking-rule-override-note" rows="3" required></textarea>
        <p id="booking-rule-override-error" class="form-message error" hidden></p>
        <div class="membership-override-actions">
          <button type="button" class="btn btn-primary" data-override-choice="confirm">Confirm override</button>
          <button type="button" class="btn btn-outline" data-override-choice="cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  }

  /**
   * Per-rule override popup. Resolves override record or null if cancelled.
   */
  function showRuleOverrideDialog(violation, actor = {}) {
    const root = ensureOverrideDialog();
    const ruleEl = root.querySelector("#booking-rule-override-rule");
    const detailEl = root.querySelector("#booking-rule-override-detail");
    const noteEl = root.querySelector("#booking-rule-override-note");
    const errEl = root.querySelector("#booking-rule-override-error");
    const label = violation?.label || RULE_LABELS[violation?.rule] || "Booking rule";
    if (ruleEl) ruleEl.textContent = label;
    if (detailEl) detailEl.textContent = violation?.message || "";
    if (noteEl) noteEl.value = "";
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = "";
    }
    root.hidden = false;
    document.body.classList.add("membership-override-open");
    noteEl?.focus();

    return new Promise((resolve) => {
      const finish = (record) => {
        root.hidden = true;
        document.body.classList.remove("membership-override-open");
        root.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKey);
        resolve(record);
      };
      const onClick = (event) => {
        const choice = event.target?.closest?.("[data-override-choice], [data-override-dismiss]");
        if (!choice) return;
        const value =
          choice.getAttribute("data-override-choice") ||
          choice.getAttribute("data-override-dismiss");
        if (value === "confirm") {
          const note = String(noteEl?.value || "").trim();
          if (!note) {
            if (errEl) {
              errEl.hidden = false;
              errEl.textContent = "Enter a reason note before confirming the override.";
            }
            noteEl?.focus();
            return;
          }
          finish({
            rule: violation.rule,
            label,
            by: actor.by || "",
            by_name: actor.by_name || "",
            at: new Date().toISOString(),
            note,
          });
          return;
        }
        finish(null);
      };
      const onKey = (event) => {
        if (event.key === "Escape") finish(null);
      };
      root.addEventListener("click", onClick);
      document.addEventListener("keydown", onKey);
    });
  }

  /**
   * Render limit notice (red box). Admin mode adds per-rule Override buttons.
   */
  function renderLimitNotice(el, evaluation, {
    adminMode = false,
    overrideSession = null,
    onOverrideClick = null,
  } = {}) {
    if (!el) return;

    const violations = evaluation?.violations || [];
    const pending = overrideSession
      ? overrideSession.pendingViolations(violations)
      : violations;
    const overridden = overrideSession
      ? violations.filter((v) => overrideSession.has(v.rule))
      : [];
    const condoStatus = evaluation?.condoStatus;
    const showCondo = Boolean(condoStatus);
    const hasPending = pending.length > 0;
    const hasOverridden = overridden.length > 0;

    if (!hasPending && !hasOverridden && !showCondo) {
      el.hidden = true;
      el.innerHTML = "";
      el.classList.remove("stay-length-notice--limit");
      el.classList.remove("booking-limits-notice");
      return;
    }

    el.hidden = false;
    el.classList.add("booking-limits-notice");
    if (hasPending) el.classList.add("stay-length-notice--limit");
    else el.classList.remove("stay-length-notice--limit");

    const parts = [];
    if (showCondo) {
      parts.push(
        `<p class="booking-limits-condo-status">${escapeHtml(condoStatus.text)}</p>`
      );
    }

    pending.forEach((v) => {
      const btn =
        adminMode && typeof onOverrideClick === "function"
          ? `<button type="button" class="btn btn-outline btn-small booking-limits-override-btn" data-rule="${escapeHtml(
              v.rule
            )}">Override</button>`
          : "";
      parts.push(
        `<div class="booking-limits-violation" data-rule="${escapeHtml(v.rule)}">
          <p>${escapeHtml(v.message)}</p>
          ${btn}
        </div>`
      );
    });

    overridden.forEach((v) => {
      parts.push(
        `<div class="booking-limits-violation booking-limits-violation--overridden" data-rule="${escapeHtml(
          v.rule
        )}">
          <p><span class="booking-limits-overridden-tag">Overridden</span> ${escapeHtml(
            v.label || v.message
          )}</p>
        </div>`
      );
    });

    el.innerHTML = parts.join("");

    if (adminMode && typeof onOverrideClick === "function") {
      el.querySelectorAll("[data-rule].booking-limits-override-btn, .booking-limits-override-btn").forEach(
        (btn) => {
          btn.addEventListener("click", (event) => {
            event.preventDefault();
            const rule = btn.getAttribute("data-rule");
            const violation = pending.find((v) => v.rule === rule);
            if (violation) onOverrideClick(violation);
          });
        }
      );
    }
  }

  function actorFromUser(user) {
    return {
      by: user?.profileEmail || user?.email || user?.id || "",
      by_name: user?.name || user?.fullName || user?.email || "Admin",
    };
  }

  function mergeOverrides(existing, draftList) {
    const base = Array.isArray(existing) ? existing.slice() : [];
    (draftList || []).forEach((item) => {
      if (!item?.rule) return;
      base.push({
        rule: item.rule,
        label: item.label || RULE_LABELS[item.rule] || item.rule,
        by: item.by || "",
        by_name: item.by_name || "",
        at: item.at || new Date().toISOString(),
        note: item.note || "",
      });
    });
    return base;
  }

  function formatOverridesForDisplay(overrides) {
    if (!Array.isArray(overrides) || !overrides.length) return [];
    return overrides.map((o) => {
      const when = o.at
        ? (() => {
            const d = new Date(o.at);
            return Number.isNaN(d.getTime()) ? o.at : d.toLocaleString();
          })()
        : "—";
      return {
        rule: o.rule || "—",
        label: o.label || RULE_LABELS[o.rule] || o.rule || "—",
        who: o.by_name || o.by || "—",
        when,
        note: o.note || "—",
      };
    });
  }

  global.BookingLimits = {
    RULE,
    RULE_LABELS,
    STREAK_MAX_DAYS,
    VACATE_CLEAR_DAYS,
    evaluateProposedStay,
    evaluateConsecutiveOccupancy,
    buildOccupancyStreaks,
    condoStatusForStay,
    createOverrideSession,
    showRuleOverrideDialog,
    renderLimitNotice,
    actorFromUser,
    mergeOverrides,
    formatOverridesForDisplay,
    isLodgingForStreak,
  };
})(typeof window !== "undefined" ? window : globalThis);
