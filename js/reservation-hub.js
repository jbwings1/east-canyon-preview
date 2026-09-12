(async function () {
  const list = document.getElementById("hub-booking-list");
  const status = document.getElementById("hub-status");
  const notice = document.getElementById("hub-booking-notice");
  const bookLink = document.getElementById("hub-book-link");
  const adminNote = document.getElementById("hub-occupancy-admin-note");
  const occFrom = document.getElementById("occupancy-from");
  const occTo = document.getElementById("occupancy-to");
  const occRig = document.getElementById("occupancy-rig");
  const occBtn = document.getElementById("occupancy-check-btn");
  const occMsg = document.getElementById("occupancy-message");
  const occWrap = document.getElementById("occupancy-map-wrap");
  const occDetail = document.getElementById("occupancy-unit-detail");
  const occDetailShell = document.getElementById("occupancy-detail-shell");

  let bookings = [];
  let occupancyRows = [];
  let isAdmin = false;
  let mapReady = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function openOccupancyDetailOverlay() {
    if (typeof CampgroundMap?.openDetailOverlay === "function") {
      CampgroundMap.openDetailOverlay();
      return;
    }
    if (occDetailShell) occDetailShell.hidden = false;
    if (occDetail) occDetail.hidden = false;
  }

  function closeOccupancyDetailOverlay() {
    if (typeof CampgroundMap?.closeDetailOverlay === "function") {
      CampgroundMap.closeDetailOverlay({ clearSelection: true });
      return;
    }
    if (occDetailShell) occDetailShell.hidden = true;
    if (occDetail) {
      occDetail.hidden = true;
      occDetail.innerHTML = "";
    }
  }

  function occupancyCloseHtml() {
    if (typeof CampgroundMap?._overlayCloseHtml === "function") {
      return CampgroundMap._overlayCloseHtml();
    }
    return `<div class="map-site-overlay-head">
      <button type="button" class="map-site-overlay-close" data-map-detail-close>Close</button>
    </div>`;
  }

  function showStatus(text, type) {
    if (!status) return;
    status.textContent = text || "";
    status.className = type ? `form-message ${type}` : "form-message";
  }

  function showOccMsg(text, type) {
    if (!occMsg) return;
    occMsg.textContent = text || "";
    occMsg.className = type ? `form-message ${type}` : "form-message";
  }

  function formatSpotLabel(spotId) {
    if (!spotId) return "Not assigned yet";
    const unit = window.SpotAvailability?.findUnit?.(spotId);
    if (!unit) return spotId;
    if (unit.category === "condo") return `Condo ${unit.label}`;
    if (unit.category === "reunion") return unit.name || `Family site ${unit.label}`;
    return `Site ${unit.label}`;
  }

  function formatSiteDetails(spotId) {
    if (typeof window.SpotAvailability?.formatSiteDetails === "function") {
      return window.SpotAvailability.formatSiteDetails(spotId);
    }
    const unit = window.SpotAvailability?.findUnit?.(spotId);
    if (!unit) return spotId ? `Site ID ${spotId}` : "No site selected";
    return formatSpotLabel(spotId);
  }

  function bookedByLabel(booking) {
    if (booking.booked_by_kind === "admin") return "ECR admin";
    if (booking.booked_by_kind === "member") return "Member";
    return "Unknown";
  }

  function formatBookedOn(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function bookingWasEdited(booking) {
    if (typeof Auth?.bookingWasEdited === "function") {
      return Auth.bookingWasEdited(booking);
    }
    if (!booking?.edited_at || !booking?.created_at) return false;
    const edited = new Date(booking.edited_at).getTime();
    const created = new Date(booking.created_at).getTime();
    return Number.isFinite(edited) && Number.isFinite(created) && edited > created;
  }

  function sortHubBookings(list) {
    if (typeof Auth?.sortBookingsForDisplay === "function") {
      return Auth.sortBookingsForDisplay(list);
    }
    return list;
  }

  /** Hub/view status text. Pills use text-transform:uppercase → EDIT CONFIRMED. */
  function bookingStatusLabel(booking) {
    const status = booking?.status || "unknown";
    if (status === "cancelled") return "Cancelled";
    if (status === "confirmed" && bookingWasEdited(booking)) {
      const display =
        typeof Auth.bookingDisplayStatus === "function"
          ? Auth.bookingDisplayStatus(booking)
          : "Confirmed";
      if (display === "Active") return "Active";
      if (display === "Completed") return "Completed";
      return "Edit confirmed";
    }
    if (typeof Auth.bookingDisplayStatus === "function") {
      return Auth.bookingDisplayStatus(booking);
    }
    if (status === "confirmed") return "Confirmed";
    return status;
  }

  function editChangeTooltip(booking) {
    if (!bookingWasEdited(booking)) return "Original booking";
    const summary = String(booking.last_edit_summary || "").trim();
    return summary || "Reservation was edited";
  }

  /** Same-line Booked · Edited with native title tooltips for the last change. */
  function formatBookedEditedLineHtml(booking) {
    const booked = formatBookedOn(booking.created_at);
    const tip = escapeHtml(editChangeTooltip(booking));
    if (!bookingWasEdited(booking)) {
      return `<span title="${tip}">${escapeHtml(booked)}</span>`;
    }
    const edited = formatBookedOn(booking.edited_at);
    return (
      `<span title="${tip}">${escapeHtml(booked)}</span>` +
      ` · Edited — <span title="${tip}">${escapeHtml(edited)}</span>`
    );
  }

  function originalStayDisplay(booking) {
    if (typeof Auth?.formatOriginalStayLabel === "function") {
      return Auth.formatOriginalStayLabel(booking) || "";
    }
    return "";
  }

  function confirmationId(booking) {
    return Auth.bookingConfirmationId(booking);
  }

  function bookingEditGate(booking) {
    if (typeof Auth?.bookingCanEditOrCancel === "function") {
      return Auth.bookingCanEditOrCancel(booking);
    }
    if (!booking || booking.status === "cancelled") {
      return { allowed: false, reason: "", code: "cancelled" };
    }
    const today = window.SpotAvailability.getToday();
    if (booking.check_out && booking.check_out >= today) {
      return { allowed: true, reason: "", code: "ok" };
    }
    return { allowed: false, reason: "Past stays cannot be edited or cancelled online.", code: "past" };
  }

  function bookingIsEditable(booking) {
    return bookingEditGate(booking).allowed;
  }

  function updateBookingNotice() {
    if (!notice) return;
    const active = Auth.getActiveBookings(bookings);
    const maxActive = window.RESERVATION_MAX_ACTIVE || 2;
    if (!active.length) {
      notice.hidden = true;
      notice.textContent = "";
      notice.classList.remove("stay-length-notice--limit");
      return;
    }
    const bookingLines = active
      .map((b) => {
        const range = window.SpotAvailability.formatDateRange(b.check_in, b.check_out);
        return `Confirmation #${confirmationId(b)} · ${range}`;
      })
      .join("; ");
    notice.hidden = false;
    if (active.length >= maxActive) {
      notice.classList.add("stay-length-notice--limit");
      notice.textContent =
        `You have ${active.length} upcoming reservations (maximum ${maxActive}): ${bookingLines}. ` +
        `Once the office checks you in, or after deleting one, you can book again.`;
    } else {
      notice.classList.remove("stay-length-notice--limit");
      const remaining = maxActive - active.length;
      notice.textContent =
        `You have ${active.length} upcoming reservation${active.length === 1 ? "" : "s"} ` +
        `(${bookingLines}). You may book ${remaining} more before office check-in.`;
    }
  }

  function renderBookings() {
    if (!list) return;
    bookings = sortHubBookings(bookings);
    if (!bookings.length) {
      list.innerHTML = `
        <p class="dashboard-empty">
          You have no reservations yet.
          <a href="reservation-book.html">Book a new stay</a>.
        </p>`;
      return;
    }

    list.innerHTML = bookings
      .map((b) => {
        const type = Auth.reservationTypeLabel(b.reservation_type) || "Reservation";
        const dates =
          b.check_in && b.check_out
            ? window.SpotAvailability.formatDateRange(b.check_in, b.check_out)
            : "Dates unavailable";
        const status = b.status || "unknown";
        const statusLabel = bookingStatusLabel(b);
        const gate = bookingEditGate(b);
        const editable = gate.allowed;
        const statusClass =
          status === "confirmed"
            ? "available"
            : status === "cancelled"
              ? "booked"
              : "partial";
        const disabledActions =
          !editable && status !== "cancelled" && gate.code === "too-late"
            ? `<span class="btn btn-primary" aria-disabled="true" title="${escapeHtml(
                gate.reason
              )}" style="opacity:0.55;pointer-events:none;cursor:not-allowed">Edit</span>
               <span class="btn btn-outline" aria-disabled="true" title="${escapeHtml(
                 gate.reason
               )}" style="opacity:0.55;pointer-events:none;cursor:not-allowed">Delete</span>`
            : "";
        const actions = `
          <div class="reservation-card-actions">
            <a class="btn btn-outline" href="reservation-view.html?id=${encodeURIComponent(b.id)}">View</a>
            ${
              editable
                ? `<a class="btn btn-primary" href="reservation-edit.html?id=${encodeURIComponent(b.id)}">Edit</a>
                   <a class="btn btn-outline" href="reservation-delete.html?id=${encodeURIComponent(b.id)}">Delete</a>`
                : disabledActions
            }
          </div>
          <p class="reservation-card-hint">${
            editable
              ? "Selected — choose View, Edit, or Delete."
              : gate.code === "too-late"
                ? escapeHtml(gate.reason)
                : status === "cancelled"
                  ? "Cancelled — you can still view details."
                  : escapeHtml(gate.reason || "Past stay — view only.")
          }</p>`;

        return `
          <article
            class="reservation-booking-card is-manageable"
            data-booking-id="${escapeHtml(b.id)}"
            tabindex="0"
            role="button"
            aria-expanded="false"
          >
            <div class="reservation-booking-card-main">
              <div class="reservation-booking-card-top">
                <h3>${escapeHtml(type)}</h3>
                <span class="status-pill ${statusClass}">${escapeHtml(statusLabel)}</span>
              </div>
              <dl class="member-profile-summary reservation-booking-details">
                <div><dt>Booked by</dt><dd>${escapeHtml(bookedByLabel(b))}</dd></div>
                <div><dt>Booked</dt><dd>${formatBookedEditedLineHtml(b)}</dd></div>
                ${
                  originalStayDisplay(b)
                    ? `<div><dt>Original stay</dt><dd>${escapeHtml(originalStayDisplay(b))}</dd></div>`
                    : ""
                }
                <div><dt>Confirmation #</dt><dd>${escapeHtml(confirmationId(b))}</dd></div>
                <div><dt>Stay dates</dt><dd>${escapeHtml(dates)}</dd></div>
                <div><dt>Site</dt><dd>${escapeHtml(formatSiteDetails(b.spot))}</dd></div>
                ${
                  b.notes
                    ? `<div><dt>Notes</dt><dd>${escapeHtml(b.notes)}</dd></div>`
                    : ""
                }
              </dl>
              <p class="reservation-card-tap">${
                editable
                  ? "Tap or click this booking to View, Edit, or Delete"
                  : "Tap or click this booking to View"
              }</p>
            </div>
            <div class="reservation-booking-card-panel" hidden>${actions}</div>
          </article>`;
      })
      .join("");
  }

  function selectedOccupancyRigLength() {
    const raw = occRig?.value;
    if (raw === "" || raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function applyOccupancyRigLength({ render = true } = {}) {
    if (typeof CampgroundMap?.setRigLength !== "function") return;
    CampgroundMap.setRigLength(selectedOccupancyRigLength(), {
      render: Boolean(render && mapReady),
    });
  }

  function ensureOccupancyMap() {
    if (mapReady) return;
    CampgroundMap.init({
      layerId: "occupancy-spots-layer",
      detailId: "occupancy-unit-detail",
      svgId: "occupancy-campground-map",
      photoId: "occupancy-map-photo",
      legendId: "occupancy-map-legend",
      requireDatesForSpots: true,
      lookupOnly: true,
      unitFilter: "all",
      canBookSelect: () => true,
      onSpotSelect(unit, status) {
        showOccupancyDetail(unit, status);
      },
    });
    applyOccupancyRigLength({ render: false });
    if (typeof MapZoom !== "undefined") {
      MapZoom.init({
        viewport: document.getElementById("occupancy-map-viewport"),
        stage: document.getElementById("occupancy-zoom-stage"),
        zoomInBtn: document.getElementById("occupancy-zoom-in"),
        zoomOutBtn: document.getElementById("occupancy-zoom-out"),
        resetBtn: document.getElementById("occupancy-zoom-reset"),
      });
    }
    mapReady = true;
  }

  /** Confirmed bookings only, unique by id (or spot+dates if id missing). */
  function normalizeOccupancyRows(rows, from, to) {
    const byKey = new Map();
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      if (!r || !r.spot || !r.check_in || !r.check_out) return;
      if (r.status && r.status !== "confirmed" && r.status !== "active") return;
      if (!window.SpotAvailability.datesOverlap(from, to, r.check_in, r.check_out)) return;
      const key =
        r.id != null && r.id !== ""
          ? `id:${r.id}`
          : `stay:${r.spot}|${r.check_in}|${r.check_out}`;
      if (!byKey.has(key)) byKey.set(key, r);
    });
    return Array.from(byKey.values());
  }

  function showOccupancyDetail(unit, status) {
    if (!occDetail || !unit) return;
    const from = occFrom.value;
    const to = occTo.value;
    const mapStatus =
      status ||
      (typeof CampgroundMap?.getUnitStatus === "function"
        ? CampgroundMap.getUnitStatus(unit)
        : null);
    const lengthBit = window.SpotAvailability?.formatUnitLengthBit?.(unit);
    const title =
      unit.category === "condo"
        ? `Condo ${unit.label}`
        : unit.category === "reunion"
          ? unit.name || `Family site ${unit.label}`
          : `Site ${unit.label}`;
    const titleWithLength = lengthBit ? `${title} · ${lengthBit}` : title;
    const closeHtml = occupancyCloseHtml();

    if (mapStatus === "tooShort") {
      const max = window.SpotAvailability?.getUnitMaxLength?.(unit);
      const rig = selectedOccupancyRigLength();
      const note =
        max != null && rig != null
          ? `This site allows up to ${max}'. Your RV is ${rig}', so it is too short.`
          : "This site is too short for the selected RV length.";
      occDetail.innerHTML = `
        ${closeHtml}
        <p><strong>${escapeHtml(titleWithLength)}</strong>
          <span class="status-pill tooShort">Too short for your RV</span></p>
        <p>${escapeHtml(note)}</p>`;
      openOccupancyDetailOverlay();
      return;
    }

    const rows = occupancyRows.filter(
      (r) =>
        String(r.spot) === String(unit.id) &&
        window.SpotAvailability.datesOverlap(from, to, r.check_in, r.check_out)
    );
    const statusLabel = rows.length ? "Booked" : "Available";
    const statusClass = rows.length ? "booked" : "available";

    if (!rows.length) {
      occDetail.innerHTML = `
        ${closeHtml}
        <p><strong>${escapeHtml(titleWithLength)}</strong></p>
        <p><span class="status-pill ${statusClass}">${statusLabel}</span> for ${escapeHtml(
          window.SpotAvailability.formatDateRange(from, to)
        )}.</p>`;
      openOccupancyDetailOverlay();
      return;
    }

    const items = rows
      .map((r) => {
        const range = window.SpotAvailability.formatDateRange(r.check_in, r.check_out);
        if (!isAdmin) {
          return `<li>${escapeHtml(range)}</li>`;
        }
        const who = [r.full_name, r.member_id ? `ID ${r.member_id}` : "", r.email]
          .filter(Boolean)
          .join(" · ");
        const conf = r.id ? Auth.bookingConfirmationId(r.id) : "";
        return `<li>
          <strong>${escapeHtml(range)}</strong>
          ${conf ? ` · ${escapeHtml(conf)}` : ""}
          ${who ? `<br>${escapeHtml(who)}` : ""}
          ${r.notes ? `<br>Notes: ${escapeHtml(r.notes)}` : ""}
          ${r.booked_by_kind ? `<br>Booked by: ${escapeHtml(r.booked_by_kind === "admin" ? "ECR admin" : "Member")}` : ""}
        </li>`;
      })
      .join("");

    occDetail.innerHTML = `
      ${closeHtml}
      <p><strong>${escapeHtml(titleWithLength)}</strong>
        <span class="status-pill ${statusClass}">${statusLabel}</span></p>
      <p>Booked dates in your range:</p>
      <ul class="occupancy-date-list">${items}</ul>`;
    openOccupancyDetailOverlay();
  }

  async function runOccupancyCheck() {
    showOccMsg("", "");
    const from = occFrom.value;
    const to = occTo.value;
    if (!from || !to || to <= from) {
      showOccMsg("Choose valid from and to dates.", "error");
      return;
    }
    occBtn.disabled = true;
    try {
      const rawRows = await Auth.getSiteOccupancy(from, to);
      // Distinct confirmed stays only — do not count cancelled or duplicate rows.
      occupancyRows = normalizeOccupancyRows(rawRows, from, to);
      if (!window.BASE_SPOT_BOOKINGS) {
        window.BASE_SPOT_BOOKINGS = Array.isArray(window.SPOT_BOOKINGS)
          ? window.SPOT_BOOKINGS.slice()
          : [];
      }
      window.SPOT_BOOKINGS = occupancyRows.map((r) => ({
        bookingId: r.id || null,
        spotId: r.spot,
        checkIn: r.check_in,
        checkOut: r.check_out,
      }));
      ensureOccupancyMap();
      applyOccupancyRigLength({ render: false });
      CampgroundMap.setDates(from, to);
      CampgroundMap.render?.();
      occWrap.hidden = false;
      closeOccupancyDetailOverlay();
      const n = occupancyRows.length;
      showOccMsg(`${n} booking${n === 1 ? "" : "s"} in that range.`, "success");
    } catch (err) {
      showOccMsg(err.message, "error");
    } finally {
      occBtn.disabled = false;
    }
  }

  const params = new URLSearchParams(window.location.search);
  const ok = params.get("ok");
  if (ok === "created") showStatus("Reservation booked.", "success");
  if (ok === "updated") showStatus("Reservation updated.", "success");
  if (ok === "deleted") showStatus("Reservation deleted.", "success");
  if (ok && window.history.replaceState) {
    window.history.replaceState(null, "", "reservations.html");
  }

  try {
    await Auth.ready();
  } catch {
    /* cached profile */
  }

  let current = Auth.getCurrentUser();
  if (!current) {
    window.location.href = "login.html?next=reservations.html";
    return;
  }
  try {
    isAdmin = await Auth.verifyAdmin();
  } catch {
    isAdmin = current.accountKind === "admin" || current.isAdmin === true;
  }
  if (!isAdmin && !Auth.canAccessMembers(current)) {
    window.location.href = "login.html?next=reservations.html";
    return;
  }

  if (adminNote) adminNote.hidden = !isAdmin;

  if (bookLink) bookLink.hidden = false;

  const today = window.SpotAvailability.getToday();
  const maxDay = window.SpotAvailability.addDays(today, 90);
  occFrom.min = today;
  occFrom.max = maxDay;
  occTo.min = today;
  occTo.max = maxDay;
  occFrom.value = today;
  occTo.value = window.SpotAvailability.addDays(today, 14);

  try {
    if (isAdmin) {
      // Admins use this page for occupancy; personal list may be empty
      bookings = await Auth.listBookings().catch(() => []);
    } else {
      bookings = await Auth.listBookings();
    }
  } catch (err) {
    showStatus(err.message, "error");
    list.innerHTML = `<p class="form-message error">${escapeHtml(err.message)}</p>`;
    return;
  }

  renderBookings();
  updateBookingNotice();

  list?.addEventListener("click", (event) => {
    const card = event.target.closest(".reservation-booking-card.is-manageable");
    if (!card) return;
    if (event.target.closest("a, button")) return;
    const wasOpen = card.classList.contains("is-selected");
    list.querySelectorAll(".reservation-booking-card.is-selected").forEach((el) => {
      el.classList.remove("is-selected");
      el.setAttribute("aria-expanded", "false");
      const panel = el.querySelector(".reservation-booking-card-panel");
      if (panel) panel.hidden = true;
    });
    if (!wasOpen) {
      card.classList.add("is-selected");
      card.setAttribute("aria-expanded", "true");
      const panel = card.querySelector(".reservation-booking-card-panel");
      if (panel) panel.hidden = false;
    }
  });

  list?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".reservation-booking-card.is-manageable");
    if (!card) return;
    event.preventDefault();
    card.click();
  });

  occBtn?.addEventListener("click", runOccupancyCheck);
  occRig?.addEventListener("change", () => {
    if (!mapReady || occWrap?.hidden) {
      applyOccupancyRigLength({ render: false });
      return;
    }
    applyOccupancyRigLength({ render: true });
  });
})();
