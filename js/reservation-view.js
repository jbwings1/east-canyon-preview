(async function () {
  const summary = document.getElementById("view-summary");
  const message = document.getElementById("view-message");
  const actions = document.getElementById("view-actions");
  const editLink = document.getElementById("view-edit-link");
  const deleteLink = document.getElementById("view-delete-link");
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
    if (typeof window.SpotAvailability?.formatSiteDetails === "function") {
      return window.SpotAvailability.formatSiteDetails(spotId);
    }
    return spotId ? `Site ID ${spotId}` : "No site selected";
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

  const user = Auth.redirectForAuth({
    requireMember: true,
    loginPage: `login.html?next=${encodeURIComponent(
      `reservation-view.html${bookingId ? `?id=${bookingId}` : ""}`
    )}`,
  });
  if (!user) return;

  if (!bookingId) {
    showMessage("Missing reservation.", "error");
    return;
  }

  try {
    await Auth.ready();
  } catch {
    /* ignore */
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

  const gate =
    typeof Auth.bookingCanEditOrCancel === "function"
      ? Auth.bookingCanEditOrCancel(booking)
      : {
          allowed:
            booking.status !== "cancelled" &&
            booking.check_out &&
            booking.check_out >= window.SpotAvailability.getToday(),
          reason: "",
          code: "fallback",
        };
  const editable = gate.allowed;

  const originalStay = originalStayDisplay(booking);
  const rows = [
    ["Type", Auth.reservationTypeLabel(booking.reservation_type) || "—"],
    ["Status", bookingStatusLabel(booking)],
    ["Booked by", bookedByLabel(booking)],
    ["Booked", formatBookedEditedLineHtml(booking), true],
    ...(originalStay ? [["Original stay", originalStay]] : []),
    ["Confirmation #", Auth.bookingConfirmationId(booking)],
    [
      "Stay dates",
      booking.check_in && booking.check_out
        ? window.SpotAvailability.formatDateRange(booking.check_in, booking.check_out)
        : "—",
    ],
    ["Site", formatSiteDetails(booking.spot)],
    ["Notes", booking.notes || ""],
  ].filter(([, value]) => String(value || "").trim());

  summary.innerHTML = rows
    .map(([label, value, isHtml]) => {
      const dd = isHtml ? value : escapeHtml(value);
      return `<div><dt>${escapeHtml(label)}</dt><dd>${dd}</dd></div>`;
    })
    .join("");

  actions.hidden = false;
  if (editable) {
    editLink.hidden = false;
    deleteLink.hidden = false;
    editLink.href = `reservation-edit.html?id=${encodeURIComponent(bookingId)}`;
    deleteLink.href = `reservation-delete.html?id=${encodeURIComponent(bookingId)}`;
  } else if (gate.code === "too-late" && gate.reason) {
    showMessage(gate.reason, "error");
  }
})();
