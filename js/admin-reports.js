/**
 * Admin reports: reservations, current members, and counts by type.
 * Date helpers are on AdminReports so they can be checked without a browser.
 */
(function (root) {
  const TYPE_ROWS = [
    {
      label: "RV",
      match(type) {
        return type === "rv" || type === "travel-trailer" || type === "motorhome";
      },
    },
    {
      label: "Condo",
      match(type) {
        return type === "condo";
      },
    },
    {
      label: "Family reunion",
      match(type) {
        return type === "family_reunion" || type === "family-reunion" || type === "reunion";
      },
    },
  ];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toIso(year, month, day) {
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  function isoDate(value) {
    const text = String(value || "").trim();
    return text.length >= 10 ? text.slice(0, 10) : "";
  }

  function todayIso(now = new Date()) {
    return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  function calendarPreset(kind, today) {
    const year = Number(String(today).slice(0, 4));
    if (kind === "past-year") {
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31`, mode: "overlap" };
    }
    if (kind === "current-year") {
      return { from: `${year}-01-01`, to: `${year}-12-31`, mode: "overlap" };
    }
    if (kind === "upcoming") {
      return { from: today, to: "", mode: "upcoming" };
    }
    return null;
  }

  function monthsAgo(today, months) {
    const [year, month, day] = String(today).split("-").map(Number);
    const cursor = new Date(year, month - 1, 1);
    cursor.setMonth(cursor.getMonth() - Number(months));
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    return toIso(cursor.getFullYear(), cursor.getMonth() + 1, Math.min(day, last));
  }

  function isCancelled(booking) {
    return String(booking?.status || "").toLowerCase() === "cancelled";
  }

  function stayOverlapsRange(checkIn, checkOut, from, to) {
    if (!checkIn || !checkOut) return false;
    if (from && checkOut <= from) return false;
    if (to && checkIn > to) return false;
    return true;
  }

  function rangeError(from, to) {
    if (from && to && from > to) return "The start date is after the end date.";
    return "";
  }

  function reservationMatches(booking, range) {
    const checkIn = isoDate(booking?.check_in);
    const checkOut = isoDate(booking?.check_out);
    if (range?.mode === "upcoming") {
      const from = range.from || range.today || "";
      if (!checkIn || (from && checkIn < from)) return false;
      if (range.to && checkIn > range.to) return false;
      return true;
    }
    return stayOverlapsRange(checkIn, checkOut, range?.from || "", range?.to || "");
  }

  function stayInLookback(booking, today, months) {
    if (isCancelled(booking)) return false;
    const start = monthsAgo(today, months);
    return stayOverlapsRange(isoDate(booking?.check_in), isoDate(booking?.check_out), start, today);
  }

  function isCurrentMember(profile) {
    if (!String(profile?.member_id || "").trim()) return false;
    const status = String(profile?.account_status || "active").toLowerCase();
    return status === "active" || status === "pending_activation";
  }

  function passwordStatus(profile) {
    return profile?.must_change_password ? "Temp / change required" : "Set";
  }

  function memberSinceIso(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return isoDate(text);
    return toIso(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  function memberMatchesQuery(profile, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return false;
    const name = String(profile?.full_name || "").toLowerCase();
    const memberId = String(profile?.member_id || "").toLowerCase();
    const label = String(profile?.label || "").toLowerCase();
    return (
      (name && name.includes(q)) ||
      (memberId && memberId.includes(q)) ||
      (label && label.includes(q))
    );
  }

  function rankMemberMatch(profile, query) {
    const q = String(query || "").trim().toLowerCase();
    const name = String(profile?.full_name || "").toLowerCase();
    const memberId = String(profile?.member_id || "").toLowerCase();
    if (!memberMatchesQuery(profile, q)) return 9;
    if (memberId && memberId === q) return 0;
    if (memberId && memberId.startsWith(q)) return 1;
    if (name.startsWith(q)) return 2;
    return 3;
  }

  function countByType(bookings, range) {
    const matched = (bookings || []).filter((booking) => reservationMatches(booking, range));
    const active = matched.filter((booking) => !isCancelled(booking));
    const rows = TYPE_ROWS.map((row) => ({
      label: row.label,
      count: active.filter((booking) => row.match(String(booking.reservation_type || ""))).length,
    }));
    const known = active.filter((booking) =>
      TYPE_ROWS.some((row) => row.match(String(booking.reservation_type || "")))
    ).length;
    return {
      rows,
      other: active.length - known,
      cancelled: matched.length - active.length,
      total: active.length,
    };
  }

  root.AdminReports = {
    TYPE_ROWS,
    todayIso,
    calendarPreset,
    monthsAgo,
    isCancelled,
    stayOverlapsRange,
    rangeError,
    reservationMatches,
    stayInLookback,
    isCurrentMember,
    passwordStatus,
    memberSinceIso,
    countByType,
    isoDate,
    memberMatchesQuery,
    rankMemberMatch,
  };

  if (typeof document === "undefined") return;

  const escapeHtml =
    root.AdminCommon?.escapeHtml ||
    function (value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    };

  function formatStayDate(value) {
    const iso = isoDate(value);
    if (typeof root.SpotAvailability?.formatStayDate === "function") {
      return root.SpotAvailability.formatStayDate(iso) || iso || "—";
    }
    return iso || "—";
  }

  function formatMemberSince(value) {
    const iso = memberSinceIso(value);
    return iso ? formatStayDate(iso) : "—";
  }

  function typeLabel(value) {
    if (typeof root.Auth?.reservationTypeLabel === "function") {
      const label = root.Auth.reservationTypeLabel(value);
      if (label) return label;
    }
    const raw = String(value || "");
    const row = TYPE_ROWS.find((item) => item.match(raw));
    return row ? row.label : raw || "—";
  }

  function statusLabel(booking) {
    if (typeof root.Auth?.bookingDisplayStatus === "function") {
      return root.Auth.bookingDisplayStatus(booking);
    }
    return booking?.status || "—";
  }

  function statusClass(label) {
    if (typeof root.Auth?.bookingStatusClass === "function") {
      return root.Auth.bookingStatusClass(label);
    }
    if (label === "Past") return "booked";
    if (label === "Cancelled") return "cancelled";
    if (label === "Active" || label === "Confirmed") return "available";
    return "partial";
  }

  function memberName(profiles, userId) {
    if (typeof root.AdminCommon?.memberLabel === "function") {
      return root.AdminCommon.memberLabel(profiles, userId);
    }
    return userId || "—";
  }

  function setPressed(report, preset) {
    document.querySelectorAll(`[data-report="${report}"][data-preset]`).forEach((button) => {
      button.setAttribute("aria-pressed", button.getAttribute("data-preset") === preset ? "true" : "false");
    });
  }

  function matchingPreset(range) {
    const today = todayIso();
    return ["past-year", "current-year", "upcoming"].find((kind) => {
      const preset = calendarPreset(kind, today);
      return (
        preset.from === (range.from || "") &&
        preset.to === (range.to || "") &&
        preset.mode === range.mode
      );
    }) || "";
  }

  function setDateValue(id, iso) {
    const input = document.getElementById(id);
    if (input) input.value = iso || "";
  }

  const REPORT_PANELS = ["reservations", "members", "types", "overrides"];

  function showReport(id) {
    const next = REPORT_PANELS.includes(id) ? id : "reservations";
    document.querySelectorAll("[data-report-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-report-panel") !== next;
    });
    document.querySelectorAll("[data-report-picker]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        button.getAttribute("data-report-picker") === next ? "true" : "false"
      );
    });
    const hash = next === "reservations" ? "" : `#${next}`;
    const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
    return next;
  }

  function describeRange(range) {
    if (range?.mode === "upcoming") {
      const from = formatStayDate(range.from);
      const to = range.to ? formatStayDate(range.to) : "";
      if (to && to !== "—") return `Upcoming stays from ${from} through ${to}.`;
      return from && from !== "—" ? `Upcoming stays starting ${from}.` : "Upcoming stays.";
    }
    const from = range?.from ? formatStayDate(range.from) : "";
    const to = range?.to ? formatStayDate(range.to) : "";
    if (from && from !== "—" && to && to !== "—") return `${from} through ${to}.`;
    if (from && from !== "—") return `From ${from}.`;
    if (to && to !== "—") return `Through ${to}.`;
    return "All dates.";
  }

  function setPrintRange(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  (async function () {
    document.getElementById("report-print-btn")?.addEventListener("click", () => {
      window.print();
    });
    document.querySelectorAll("[data-report-picker]").forEach((button) => {
      button.addEventListener("click", () => {
        showReport(button.getAttribute("data-report-picker"));
      });
    });
    showReport(String(window.location.hash || "").replace(/^#/, ""));

    const me = await root.AdminCommon.requireAdmin("reports");
    if (!me) return;

    const message = document.getElementById("admin-message");
    const resBody = document.getElementById("report-res-body");
    const resSummary = document.getElementById("report-res-summary");
    const membersBody = document.getElementById("report-members-body");
    const membersSummary = document.getElementById("report-members-summary");
    const staysHeading = document.getElementById("report-stays-heading");
    const typeBody = document.getElementById("report-type-body");
    const typeSummary = document.getElementById("report-type-summary");

    let profiles = [];
    let bookings = [];
    let stayMonths = 12;
    const ranges = {
      reservations: { from: "", to: "", mode: "overlap" },
      types: { from: "", to: "", mode: "overlap" },
    };

    function readRange(report, fromId, toId) {
      const from = document.getElementById(fromId)?.value || "";
      const to = document.getElementById(toId)?.value || "";
      const current = ranges[report];
      if (current.mode === "upcoming" && from === current.from && to === current.to) {
        return current;
      }
      return { from, to, mode: "overlap" };
    }

    function applyPreset(report, kind, fromId, toId) {
      const preset = calendarPreset(kind, todayIso());
      if (!preset) return;
      ranges[report] = preset;
      setDateValue(fromId, preset.from);
      setDateValue(toId, preset.to);
      setPressed(report, kind);
    }

    const MEMBER_MATCH_LIMIT = 12;
    let memberOptions = [];
    let memberHighlight = -1;

    function selectedMemberId() {
      return document.getElementById("report-res-member")?.value || "";
    }

    function memberSearchInput() {
      return document.getElementById("report-res-member-search");
    }

    function memberList() {
      return document.getElementById("report-res-member-list");
    }

    function buildMemberOptions() {
      const booked = new Set(bookings.map((booking) => booking.user_id).filter(Boolean));
      const members = profiles.filter((profile) => {
        const id = profile.id || "";
        return id && (root.AdminCommon.profileHasMembership(profile) || booked.has(id));
      });
      const known = new Set(members.map((profile) => profile.id));
      const extras = [...booked].filter((id) => !known.has(id));
      const choice = (id, profile) => {
        const closed =
          String(profile?.account_status || "").toLowerCase() === "closed" ? " — Closed" : "";
        const name = memberName(profiles, id);
        return {
          id,
          label: `${name}${closed}`,
          full_name: String(profile?.full_name || profile?.email || name || ""),
          member_id: String(profile?.member_id || ""),
        };
      };
      memberOptions = members
        .map((profile) => choice(profile.id, profile))
        .concat(
          extras.map((id) =>
            choice(id, {
              full_name: memberName(profiles, id),
              member_id: "",
            })
          )
        );
    }

    function matchingMembers(query) {
      return memberOptions
        .filter((option) =>
          memberMatchesQuery(
            {
              full_name: option.full_name,
              member_id: option.member_id,
              label: option.label,
            },
            query
          )
        )
        .sort((a, b) => {
          const rank =
            rankMemberMatch(
              { full_name: a.full_name, member_id: a.member_id, label: a.label },
              query
            ) -
            rankMemberMatch(
              { full_name: b.full_name, member_id: b.member_id, label: b.label },
              query
            );
          if (rank) return rank;
          return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
        });
    }

    function closeMemberList() {
      const list = memberList();
      const input = memberSearchInput();
      memberHighlight = -1;
      if (list) {
        list.hidden = true;
        list.innerHTML = "";
      }
      if (input) {
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
      }
    }

    function paintMemberHighlight() {
      const list = memberList();
      const input = memberSearchInput();
      if (!list) return;
      const buttons = [...list.querySelectorAll("[data-member-id]")];
      buttons.forEach((button, index) => {
        const on = index === memberHighlight;
        button.setAttribute("aria-selected", on ? "true" : "false");
        button.classList.toggle("is-active", on);
        if (on) {
          button.id = "report-res-member-active";
          input?.setAttribute("aria-activedescendant", button.id);
          button.scrollIntoView({ block: "nearest" });
        } else if (button.id === "report-res-member-active") {
          button.removeAttribute("id");
        }
      });
    }

    function showMemberMatches(query) {
      const list = memberList();
      const input = memberSearchInput();
      if (!list || !input) return;
      const q = String(query || "").trim();
      if (!q) {
        closeMemberList();
        return;
      }
      const matches = matchingMembers(q);
      const shown = matches.slice(0, MEMBER_MATCH_LIMIT);
      memberHighlight = shown.length ? 0 : -1;
      const items = shown
        .map(
          (option, index) =>
            `<li role="presentation"><button type="button" role="option" data-member-id="${escapeHtml(
              option.id
            )}" aria-selected="${index === 0 ? "true" : "false"}">${escapeHtml(option.label)}</button></li>`
        )
        .join("");
      const more =
        matches.length > shown.length
          ? `<li class="member-lookup-note" role="presentation">Showing ${shown.length} of ${matches.length}. Keep typing to narrow the list.</li>`
          : "";
      const empty = shown.length
        ? ""
        : `<li class="member-lookup-note" role="presentation">No members match.</li>`;
      list.innerHTML = items + more + empty;
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      if (shown.length) {
        const first = list.querySelector("[data-member-id]");
        if (first) {
          first.id = "report-res-member-active";
          input.setAttribute("aria-activedescendant", first.id);
        }
      }
    }

    function applyMemberSelection(id) {
      const hidden = document.getElementById("report-res-member");
      const input = memberSearchInput();
      const previous = hidden?.value || "";
      const next = id || "";
      if (hidden) hidden.value = next;
      const option = memberOptions.find((item) => item.id === next);
      if (input) input.value = option ? option.label : "";
      closeMemberList();
      if (previous === next) return;
      if (next) {
        ranges.reservations = { from: "", to: "", mode: "overlap" };
        setDateValue("report-res-from", "");
        setDateValue("report-res-to", "");
        setPressed("reservations", "");
      } else {
        applyPreset("reservations", "current-year", "report-res-from", "report-res-to");
      }
      renderReservations();
    }

    function restoreMemberField() {
      const input = memberSearchInput();
      if (!input) return;
      const option = memberOptions.find((item) => item.id === selectedMemberId());
      input.value = option ? option.label : "";
    }

    function renderReservations() {
      const range = readRange("reservations", "report-res-from", "report-res-to");
      ranges.reservations = range;
      setPressed("reservations", matchingPreset(range));
      const memberId = selectedMemberId();
      const who = memberId ? memberName(profiles, memberId) : "";
      setPrintRange(
        "report-res-print-range",
        who ? `${who}. ${describeRange(range)}` : describeRange(range)
      );
      const error = range.mode === "overlap" ? rangeError(range.from, range.to) : "";
      if (error) {
        resSummary.textContent = error;
        resBody.innerHTML = `<tr><td colspan="7">${escapeHtml(error)}</td></tr>`;
        return;
      }
      const rows = bookings
        .filter((booking) => {
          if (memberId && booking.user_id !== memberId) return false;
          return reservationMatches(booking, range);
        })
        .sort((a, b) => {
          const start = isoDate(b.check_in).localeCompare(isoDate(a.check_in));
          if (start) return start;
          return memberName(profiles, a.user_id).localeCompare(memberName(profiles, b.user_id));
        });
      const cancelled = rows.filter(isCancelled).length;
      if (!rows.length) {
        const empty = who
          ? `No reservations for ${who}.`
          : "No reservations in this range.";
        resSummary.textContent = empty;
        resBody.innerHTML = `<tr><td colspan="7">${escapeHtml(empty)}</td></tr>`;
        return;
      }
      const cancelNote = cancelled ? ` (${cancelled} cancelled)` : "";
      const forWhom = who ? ` for ${who}` : "";
      resSummary.textContent = `${rows.length} reservation${rows.length === 1 ? "" : "s"}${cancelNote}${forWhom}.`;
      resBody.innerHTML = rows
        .map((booking) => {
          const display = statusLabel(booking);
          const conf =
            typeof root.Auth?.bookingConfirmationId === "function"
              ? root.Auth.bookingConfirmationId(booking)
              : booking.id || "—";
          return `<tr>
            <td><code>${escapeHtml(conf)}</code></td>
            <td>${escapeHtml(memberName(profiles, booking.user_id))}</td>
            <td>${escapeHtml(typeLabel(booking.reservation_type))}</td>
            <td>${escapeHtml(booking.spot || "—")}</td>
            <td>${escapeHtml(formatStayDate(booking.check_in))}</td>
            <td>${escapeHtml(formatStayDate(booking.check_out))}</td>
            <td><span class="status-pill ${statusClass(display)}">${escapeHtml(display)}</span></td>
          </tr>`;
        })
        .join("");
    }

    function renderMembers() {
      const today = todayIso();
      const members = profiles
        .filter(isCurrentMember)
        .map((profile) => ({
          profile,
          stays: bookings.filter(
            (booking) => booking.user_id === profile.id && stayInLookback(booking, today, stayMonths)
          ).length,
        }))
        .sort((a, b) =>
          String(a.profile.full_name || a.profile.email || "").localeCompare(
            String(b.profile.full_name || b.profile.email || ""),
            undefined,
            { numeric: true, sensitivity: "base" }
          )
        );
      if (staysHeading) staysHeading.textContent = `Stays (past ${stayMonths} months)`;
      setPrintRange(
        "report-members-print-range",
        `Stays in the past ${stayMonths} months, through ${formatStayDate(today)}.`
      );
      if (!members.length) {
        membersSummary.textContent = "No current members.";
        membersBody.innerHTML = `<tr><td colspan="5">No current members.</td></tr>`;
        return;
      }
      membersSummary.textContent = `${members.length} current member${members.length === 1 ? "" : "s"}.`;
      membersBody.innerHTML = members
        .map(({ profile, stays }) => {
          const name = profile.full_name || profile.email || "Member";
          return `<tr>
            <td>${escapeHtml(profile.member_id || "—")}</td>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(passwordStatus(profile))}</td>
            <td>${escapeHtml(formatMemberSince(profile.created_at))}</td>
            <td>${stays}</td>
          </tr>`;
        })
        .join("");
    }

    function renderTypes() {
      const range = readRange("types", "report-type-from", "report-type-to");
      ranges.types = range;
      setPressed("types", matchingPreset(range));
      setPrintRange("report-type-print-range", describeRange(range));
      const error = range.mode === "overlap" ? rangeError(range.from, range.to) : "";
      if (error) {
        typeSummary.textContent = error;
        typeBody.innerHTML = `<tr><td colspan="2">${escapeHtml(error)}</td></tr>`;
        return;
      }
      const counts = countByType(bookings, range);
      const rows = counts.rows.slice();
      if (counts.other) rows.push({ label: "Other", count: counts.other });
      typeSummary.textContent = counts.cancelled
        ? `${counts.total} reservation${counts.total === 1 ? "" : "s"}. ${counts.cancelled} cancelled left out of the counts.`
        : `${counts.total} reservation${counts.total === 1 ? "" : "s"}.`;
      typeBody.innerHTML =
        rows
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.label)}</td><td>${row.count}</td></tr>`
          )
          .join("") +
        `<tr class="report-total"><td>Total</td><td>${counts.total}</td></tr>`;
    }

    let adminOptions = [];
    let adminHighlight = -1;

    function buildAdminOptions() {
      const map = new Map();
      const add = (id, name, code) => {
        const key = String(id || "").trim();
        if (!key || map.has(key)) return;
        const label = code && code !== name ? `${name} · ${code}` : name || code || key;
        map.set(key, {
          id: key,
          label,
          full_name: name || label,
          member_id: code || "",
        });
      };
      bookings.forEach((booking) => {
        const list = Array.isArray(booking.rule_overrides) ? booking.rule_overrides : [];
        list.forEach((item) => {
          if (!item?.rule) return;
          add(item.by || item.by_name, item.by_name || item.by || "Admin", item.by || "");
        });
      });
      profiles.forEach((profile) => {
        if (!profile?.is_admin && !String(profile?.staff_code || "").trim()) return;
        const name = profile.full_name || profile.email || "Admin";
        add(profile.staff_code || profile.email || profile.id, name, profile.staff_code || "");
      });
      adminOptions = [...map.values()].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
      );
    }

    function selectedAdminId() {
      return document.getElementById("report-override-admin")?.value || "";
    }

    function adminSearchInput() {
      return document.getElementById("report-override-admin-search");
    }

    function adminList() {
      return document.getElementById("report-override-admin-list");
    }

    function closeAdminList() {
      const list = adminList();
      const input = adminSearchInput();
      adminHighlight = -1;
      if (list) {
        list.hidden = true;
        list.innerHTML = "";
      }
      if (input) {
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
      }
    }

    function showAdminMatches(query) {
      const list = adminList();
      const input = adminSearchInput();
      if (!list || !input) return;
      const q = String(query || "").trim();
      if (!q) {
        closeAdminList();
        return;
      }
      const matches = adminOptions
        .filter((option) =>
          memberMatchesQuery(
            { full_name: option.full_name, member_id: option.member_id, label: option.label },
            q
          )
        )
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
      const shown = matches.slice(0, 12);
      adminHighlight = shown.length ? 0 : -1;
      list.innerHTML =
        shown
          .map(
            (option, index) =>
              `<li role="presentation"><button type="button" role="option" data-admin-id="${escapeHtml(
                option.id
              )}" aria-selected="${index === 0 ? "true" : "false"}">${escapeHtml(option.label)}</button></li>`
          )
          .join("") +
        (shown.length ? "" : `<li class="member-lookup-note" role="presentation">No admins match.</li>`);
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function applyAdminSelection(id) {
      const hidden = document.getElementById("report-override-admin");
      const input = adminSearchInput();
      const next = id || "";
      if (hidden) hidden.value = next;
      const option = adminOptions.find((item) => item.id === next);
      if (input) input.value = option ? option.label : "";
      closeAdminList();
      renderOverrides();
    }

    function renderOverrides() {
      const body = document.getElementById("report-override-body");
      const summary = document.getElementById("report-override-summary");
      const printRange = document.getElementById("report-override-print-range");
      if (!body || !summary) return;
      const memberId = document.getElementById("report-override-member")?.value || "";
      const adminId = selectedAdminId();
      const memberLabel = memberId ? memberName(profiles, memberId) : "";
      const adminLabel = adminOptions.find((item) => item.id === adminId)?.label || "";
      const bits = [memberLabel, adminLabel].filter(Boolean);
      if (printRange) printRange.textContent = bits.length ? bits.join(". ") + "." : "All overrides.";
      const rows = [];
      bookings.forEach((booking) => {
        const list = Array.isArray(booking.rule_overrides) ? booking.rule_overrides : [];
        list.forEach((item) => {
          if (!item?.rule) return;
          if (memberId && booking.user_id !== memberId) return;
          if (adminId && item.by !== adminId && item.by_name !== adminId) return;
          rows.push({ booking, item });
        });
      });
      rows.sort((a, b) => String(b.item.at || "").localeCompare(String(a.item.at || "")));
      const overdueCount = rows.filter((row) => row.item.rule === "account_overdue").length;
      summary.textContent = rows.length
        ? `${rows.length} override${rows.length === 1 ? "" : "s"}. ${overdueCount} overdue account${
            overdueCount === 1 ? "" : "s"
          }.`
        : "No overrides match.";
      if (!rows.length) {
        body.innerHTML = `<tr><td colspan="7">No overrides match.</td></tr>`;
        return;
      }
      body.innerHTML = rows
        .map(({ booking, item }) => {
          const when = item.at
            ? (() => {
                const date = new Date(item.at);
                return Number.isNaN(date.getTime()) ? item.at : date.toLocaleString();
              })()
            : "—";
          const kind = item.rule === "account_overdue" ? "Overdue" : "Rule";
          const who =
            item.by && item.by !== item.by_name
              ? `${item.by_name || "Admin"} (${item.by})`
              : item.by_name || item.by || "—";
          const stay =
            booking.check_in && booking.check_out
              ? `${formatStayDate(booking.check_in)} – ${formatStayDate(booking.check_out)}`
              : "—";
          return `<tr>
            <td>${escapeHtml(when)}</td>
            <td>${escapeHtml(memberName(profiles, booking.user_id))}</td>
            <td><code>${escapeHtml(confirmationId(booking))}</code></td>
            <td>${escapeHtml(stay)}</td>
            <td>${escapeHtml(kind)}</td>
            <td>${escapeHtml(who)}</td>
            <td>${escapeHtml(item.note || "—")}</td>
          </tr>`;
        })
        .join("");
    }

    function renderAll() {
      const printed = document.getElementById("report-printed-on");
      if (printed) printed.textContent = `Printed ${formatStayDate(todayIso())}`;
      renderReservations();
      renderMembers();
      renderTypes();
      renderOverrides();
    }

    document.querySelectorAll("[data-report][data-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const report = button.getAttribute("data-report");
        const preset = button.getAttribute("data-preset");
        if (report === "reservations") applyPreset(report, preset, "report-res-from", "report-res-to");
        if (report === "types") applyPreset(report, preset, "report-type-from", "report-type-to");
        renderAll();
      });
    });

    document.querySelectorAll("[data-report='members'][data-months]").forEach((button) => {
      button.addEventListener("click", () => {
        stayMonths = Number(button.getAttribute("data-months")) || 12;
        document.querySelectorAll("[data-report='members'][data-months]").forEach((item) => {
          item.setAttribute("aria-pressed", item === button ? "true" : "false");
        });
        renderMembers();
      });
    });

    const memberSearch = memberSearchInput();
    const memberResultList = memberList();
    memberSearch?.addEventListener("input", () => {
      const text = memberSearch.value;
      if (!text.trim()) {
        applyMemberSelection("");
        return;
      }
      showMemberMatches(text);
    });
    memberSearch?.addEventListener("keydown", (event) => {
      const list = memberList();
      const open = list && !list.hidden;
      const buttons = open ? [...list.querySelectorAll("[data-member-id]")] : [];
      if (event.key === "ArrowDown" && open && buttons.length) {
        event.preventDefault();
        memberHighlight = (memberHighlight + 1) % buttons.length;
        paintMemberHighlight();
      } else if (event.key === "ArrowUp" && open && buttons.length) {
        event.preventDefault();
        memberHighlight = (memberHighlight - 1 + buttons.length) % buttons.length;
        paintMemberHighlight();
      } else if (event.key === "Enter") {
        if (open && buttons.length) {
          event.preventDefault();
          const index = memberHighlight >= 0 ? memberHighlight : 0;
          applyMemberSelection(buttons[index].getAttribute("data-member-id"));
        }
      } else if (event.key === "Escape") {
        closeMemberList();
        restoreMemberField();
      }
    });
    memberSearch?.addEventListener("blur", () => {
      window.setTimeout(() => {
        const list = memberList();
        if (list && list.contains(document.activeElement)) return;
        closeMemberList();
        restoreMemberField();
      }, 150);
    });
    memberResultList?.addEventListener("mousedown", (event) => {
      const button = event.target.closest("[data-member-id]");
      if (!button) return;
      event.preventDefault();
      applyMemberSelection(button.getAttribute("data-member-id"));
    });
    let overrideMemberHighlight = -1;

    function overrideMemberInput() {
      return document.getElementById("report-override-member-search");
    }

    function overrideMemberList() {
      return document.getElementById("report-override-member-list");
    }

    function closeOverrideMemberList() {
      const list = overrideMemberList();
      const input = overrideMemberInput();
      overrideMemberHighlight = -1;
      if (list) {
        list.hidden = true;
        list.innerHTML = "";
      }
      if (input) input.setAttribute("aria-expanded", "false");
    }

    function showOverrideMemberMatches(query) {
      const list = overrideMemberList();
      const input = overrideMemberInput();
      if (!list || !input) return;
      const q = String(query || "").trim();
      if (!q) {
        closeOverrideMemberList();
        return;
      }
      const matches = matchingMembers(q).slice(0, 12);
      overrideMemberHighlight = matches.length ? 0 : -1;
      list.innerHTML = matches.length
        ? matches
            .map(
              (option, index) =>
                `<li role="presentation"><button type="button" role="option" data-override-member-id="${escapeHtml(
                  option.id
                )}" aria-selected="${index === 0 ? "true" : "false"}">${escapeHtml(option.label)}</button></li>`
            )
            .join("")
        : `<li class="member-lookup-note" role="presentation">No members match.</li>`;
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function applyOverrideMember(id) {
      const hidden = document.getElementById("report-override-member");
      const input = overrideMemberInput();
      const next = id || "";
      if (hidden) hidden.value = next;
      const option = memberOptions.find((item) => item.id === next);
      if (input) input.value = option ? option.label : "";
      closeOverrideMemberList();
      renderOverrides();
    }

    const overrideMemberSearch = overrideMemberInput();
    overrideMemberSearch?.addEventListener("input", () => {
      const hidden = document.getElementById("report-override-member");
      if (hidden) hidden.value = "";
      showOverrideMemberMatches(overrideMemberSearch.value);
      if (!overrideMemberSearch.value.trim()) renderOverrides();
    });
    overrideMemberSearch?.addEventListener("keydown", (event) => {
      const list = overrideMemberList();
      const open = list && !list.hidden;
      const buttons = open ? [...list.querySelectorAll("[data-override-member-id]")] : [];
      if (event.key === "ArrowDown" && buttons.length) {
        event.preventDefault();
        overrideMemberHighlight = (overrideMemberHighlight + 1) % buttons.length;
      } else if (event.key === "ArrowUp" && buttons.length) {
        event.preventDefault();
        overrideMemberHighlight = (overrideMemberHighlight - 1 + buttons.length) % buttons.length;
      } else if (event.key === "Enter" && buttons.length) {
        event.preventDefault();
        const index = overrideMemberHighlight >= 0 ? overrideMemberHighlight : 0;
        applyOverrideMember(buttons[index].getAttribute("data-override-member-id"));
        return;
      } else if (event.key === "Escape") {
        closeOverrideMemberList();
        return;
      } else {
        return;
      }
      buttons.forEach((button, index) => {
        button.classList.toggle("is-active", index === overrideMemberHighlight);
      });
    });
    overrideMemberList()?.addEventListener("mousedown", (event) => {
      const button = event.target.closest("[data-override-member-id]");
      if (!button) return;
      event.preventDefault();
      applyOverrideMember(button.getAttribute("data-override-member-id"));
    });

    const adminSearch = adminSearchInput();
    const adminResultList = adminList();
    adminSearch?.addEventListener("input", () => {
      const hidden = document.getElementById("report-override-admin");
      if (hidden) hidden.value = "";
      showAdminMatches(adminSearch.value);
      if (!adminSearch.value.trim()) renderOverrides();
    });
    adminSearch?.addEventListener("keydown", (event) => {
      const list = adminList();
      const open = list && !list.hidden;
      const buttons = open ? [...list.querySelectorAll("[data-admin-id]")] : [];
      if (event.key === "ArrowDown" && open && buttons.length) {
        event.preventDefault();
        adminHighlight = (adminHighlight + 1) % buttons.length;
      } else if (event.key === "ArrowUp" && open && buttons.length) {
        event.preventDefault();
        adminHighlight = (adminHighlight - 1 + buttons.length) % buttons.length;
      } else if (event.key === "Enter" && open && buttons.length) {
        event.preventDefault();
        const index = adminHighlight >= 0 ? adminHighlight : 0;
        applyAdminSelection(buttons[index].getAttribute("data-admin-id"));
        return;
      } else if (event.key === "Escape") {
        closeAdminList();
        return;
      } else {
        return;
      }
      buttons.forEach((button, index) => {
        button.classList.toggle("is-active", index === adminHighlight);
        button.setAttribute("aria-selected", index === adminHighlight ? "true" : "false");
      });
    });
    adminResultList?.addEventListener("mousedown", (event) => {
      const button = event.target.closest("[data-admin-id]");
      if (!button) return;
      event.preventDefault();
      applyAdminSelection(button.getAttribute("data-admin-id"));
    });
    document.addEventListener("click", (event) => {
      const memberField = memberSearchInput()?.closest(".member-lookup");
      if (memberField && !memberField.contains(event.target)) closeMemberList();
      const overrideMemberField = overrideMemberInput()?.closest(".member-lookup");
      if (overrideMemberField && !overrideMemberField.contains(event.target)) closeOverrideMemberList();
      const adminField = adminSearchInput()?.closest(".member-lookup");
      if (adminField && !adminField.contains(event.target)) closeAdminList();
    });

    ["report-res-from", "report-res-to"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        ranges.reservations = { mode: "overlap", from: "", to: "" };
        setPressed("reservations", "");
        renderReservations();
      });
    });
    ["report-type-from", "report-type-to"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        ranges.types = { mode: "overlap", from: "", to: "" };
        setPressed("types", "");
        renderTypes();
      });
    });

    try {
      [profiles, bookings] = await Promise.all([
        root.Auth.listAllProfiles(),
        root.Auth.listAllBookings(),
      ]);
      buildMemberOptions();
      buildAdminOptions();
      applyPreset("reservations", "current-year", "report-res-from", "report-res-to");
      applyPreset("types", "current-year", "report-type-from", "report-type-to");
      renderAll();
    } catch (err) {
      root.AdminCommon.showMessage(message, err.message, "error");
      const text = escapeHtml(err.message || "Could not load reports.");
      resBody.innerHTML = `<tr><td colspan="7">${text}</td></tr>`;
      membersBody.innerHTML = `<tr><td colspan="5">${text}</td></tr>`;
      typeBody.innerHTML = `<tr><td colspan="2">${text}</td></tr>`;
    }
  })();
})(typeof globalThis !== "undefined" ? globalThis : window);
