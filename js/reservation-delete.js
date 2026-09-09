(async function () {
  const summary = document.getElementById("delete-summary");
  const message = document.getElementById("delete-message");
  const actions = document.getElementById("delete-actions");
  const confirmBtn = document.getElementById("confirm-delete-btn");
  const bookingId = new URLSearchParams(window.location.search).get("id");

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showMessage(text, type) {
    message.textContent = text || "";
    message.className = type ? `form-message ${type}` : "form-message";
  }

  function formatSiteDetails(spotId) {
    if (!spotId) return "—";
    if (typeof window.SpotAvailability?.formatSiteDetails === "function") {
      return window.SpotAvailability.formatSiteDetails(spotId);
    }
    const unit = window.SpotAvailability?.findUnit?.(spotId);
    if (!unit) return spotId;
    if (unit.category === "condo") return `Condo ${unit.label}`;
    if (unit.category === "reunion") return unit.name || `Family site ${unit.label}`;
    return `Site ${unit.label}`;
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
    if (!booking?.edited_at || !booking?.created_at) return false;
    const edited = new Date(booking.edited_at).getTime();
    const created = new Date(booking.created_at).getTime();
    return Number.isFinite(edited) && Number.isFinite(created) && edited > created;
  }

  function bookingStatusLabel(booking) {
    const status = booking?.status || "unknown";
    if (status === "cancelled") return "Cancelled";
    if (status === "confirmed" && bookingWasEdited(booking)) return "Edit confirmed";
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

  const user = Auth.redirectForAuth({ requireMember: true });
  if (!user) return;

  if (!bookingId) {
    showMessage("Missing reservation.", "error");
    summary.innerHTML = `<div><dt>Error</dt><dd>No reservation selected.</dd></div>`;
    return;
  }

  try {
    await Auth.ready();
  } catch {
    /* cached session */
  }

  let bookings = [];
  try {
    bookings = await Auth.listBookings();
  } catch (err) {
    showMessage(err.message, "error");
    return;
  }

  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) {
    showMessage("Reservation not found.", "error");
    summary.innerHTML = `<div><dt>Error</dt><dd>That reservation is not on your account.</dd></div>`;
    return;
  }

  if (booking.status === "cancelled") {
    showMessage("This reservation is already cancelled.", "error");
  }

  const cancelGate =
    typeof Auth.bookingCanEditOrCancel === "function"
      ? Auth.bookingCanEditOrCancel(booking)
      : {
          allowed:
            booking.status !== "cancelled" &&
            booking.check_out >= window.SpotAvailability.getToday(),
          reason: "Past or cancelled reservations cannot be deleted here.",
          code: "fallback",
        };
  const canDelete = cancelGate.allowed;

  const originalStay = originalStayDisplay(booking);
  const rows = [
    ["Type", Auth.reservationTypeLabel(booking.reservation_type) || "—"],
    ["Site / unit", formatSiteDetails(booking.spot)],
    [
      "Dates",
      booking.check_in && booking.check_out
        ? window.SpotAvailability.formatDateRange(booking.check_in, booking.check_out)
        : "—",
    ],
    ["Booked", formatBookedEditedLineHtml(booking), true],
    ...(originalStay ? [["Original stay", originalStay]] : []),
    ["Status", bookingStatusLabel(booking)],
    ["Notes", booking.notes || ""],
  ].filter(([, value]) => String(value || "").trim());

  summary.innerHTML = rows
    .map(([label, value, isHtml]) => {
      const dd = isHtml ? value : escapeHtml(value);
      return `<div><dt>${escapeHtml(label)}</dt><dd>${dd}</dd></div>`;
    })
    .join("");

  if (!canDelete) {
    showMessage(
      cancelGate.reason || "Past or cancelled reservations cannot be deleted here.",
      "error"
    );
    return;
  }

  actions.hidden = false;
  confirmBtn.addEventListener("click", async () => {
    const ok = window.confirm(
      "Delete this reservation? This cancels it and frees the dates."
    );
    if (!ok) return;
    confirmBtn.disabled = true;
    try {
      await Auth.cancelOwnBooking(bookingId);
      Auth.clearLastBooking?.();
      window.location.replace("reservations.html?ok=deleted");
    } catch (err) {
      showMessage(err.message, "error");
      confirmBtn.disabled = false;
    }
  });
})();
