/**
 * Admin View Reservations — list all bookings; Edit/Cancel when manage task assigned.
 */
(async function () {
  const me = await AdminCommon.requireAdmin("reservations_view");
  if (!me) return;

  const bookingsBody = document.getElementById("admin-bookings-body");
  const message = document.getElementById("admin-message");
  const viewCard = document.getElementById("admin-view-card");
  const viewSummary = document.getElementById("admin-view-summary");
  const viewDetails = document.getElementById("admin-view-details");
  const viewEditLink = document.getElementById("admin-view-edit");
  const canManage = Auth.hasAdminTask("reservations_manage");
  const manageHint = document.getElementById("admin-manage-hint");
  let bookings = [];
  let profiles = [];
  let viewingId = null;

  if (manageHint) {
    manageHint.hidden = false;
    manageHint.innerHTML = canManage
      ? `You can <strong>Edit</strong> or <strong>Cancel</strong> below, or open <a href="admin-reservations-manage.html">Manage reservations</a>.`
      : `This list is view-only. Cancel and edit are on <a href="admin-reservations-manage.html">Manage reservations</a> (requires the Manage reservations task).`;
  }

  function formatStayDate(value) {
    if (!value) return "—";
    return window.SpotAvailability?.formatStayDate?.(value) || String(value);
  }

  function formatBookedDate(value) {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    const iso = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    return formatStayDate(iso);
  }

  function adminLabel(userId, fallback) {
    const profile = profiles.find((p) => p.id === userId);
    if (profile && (profile.staff_code || profile.is_admin || profile.admin_level != null)) {
      return (
        Auth.adminPersonLabel({
          name: profile.full_name || profile.email,
          code: profile.staff_code,
          admin_level: profile.admin_level,
          admin_seat: profile.admin_seat,
        }) || ""
      );
    }
    return Auth.adminPersonLabel(fallback || {}) || "";
  }

  function bookedByLabel(booking) {
    if (booking.booked_by_kind === "admin") {
      return (
        adminLabel(booking.booked_by_user_id, {
          name: booking.booked_by_name,
          code: booking.booked_by_code,
        }) || "ECR admin"
      );
    }
    if (booking.booked_by_kind === "member") {
      return `Member · ${AdminCommon.memberLabel(profiles, booking.booked_by_user_id || booking.user_id)}`;
    }
    return booking.booked_by_kind || "—";
  }

  function detailRow(label, value) {
    const text = value == null || value === "" ? "—" : String(value);
    return `<div><dt>${AdminCommon.escapeHtml(label)}</dt><dd>${AdminCommon.escapeHtml(text)}</dd></div>`;
  }

  function syncBookingQuery() {
    const url = new URL(window.location.href);
    if (viewingId) url.searchParams.set("view", viewingId);
    else url.searchParams.delete("view");
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) history.replaceState(null, "", next);
  }

  function closeView() {
    viewingId = null;
    if (viewCard) viewCard.hidden = true;
    if (viewDetails) viewDetails.innerHTML = "";
    if (viewSummary) viewSummary.textContent = "";
    if (viewEditLink) viewEditLink.hidden = true;
    syncBookingQuery();
  }

  function openView(booking) {
    if (!booking || !viewCard || !viewDetails) return;
    viewingId = booking.id;
    const profile = profiles.find((p) => p.id === booking.user_id) || null;
    const member = AdminCommon.memberLabel(profiles, booking.user_id);
    const displayStatus =
      typeof Auth.bookingDisplayStatus === "function"
        ? Auth.bookingDisplayStatus(booking)
        : booking.status || "—";
    const overrides =
      typeof BookingLimits !== "undefined"
        ? BookingLimits.formatOverridesForDisplay(booking.rule_overrides)
        : [];
    if (viewSummary) {
      viewSummary.textContent = `${Auth.bookingConfirmationId(booking)} · ${member} · ${displayStatus}`;
    }
    const rows = [
      detailRow("Confirmation", Auth.bookingConfirmationId(booking)),
      detailRow("Date booked", formatBookedDate(booking.created_at)),
      detailRow("Status", displayStatus),
      detailRow("Member", profile?.full_name || member),
      detailRow("Member ID", profile?.member_id || "—"),
      detailRow("Email", profile?.email || "—"),
      detailRow("Phone", profile?.phone || "—"),
      detailRow("Type", Auth.reservationTypeLabel(booking.reservation_type) || booking.reservation_type || "—"),
      detailRow("Spot / unit", booking.spot || "—"),
      detailRow("Check in", formatStayDate(booking.check_in)),
      detailRow("Check out", formatStayDate(booking.check_out)),
      detailRow("Notes", booking.notes || "—"),
      detailRow("Booked by", bookedByLabel(booking)),
      detailRow("Checked in by", adminLabel(booking.office_checked_in_by) || "—"),
    ];
    if (!overrides.length) {
      rows.push(detailRow("Rule overrides", "None"));
    } else {
      overrides.forEach((item, index) => {
        rows.push(
          detailRow(
            index === 0 ? "Rule overrides" : " ",
            `${item.label || item.rule} · ${item.who} · ${item.when} · ${item.note}`
          )
        );
      });
    }
    viewDetails.innerHTML = rows.join("");
    if (viewEditLink) {
      const showEdit = canManage && booking.status !== "cancelled";
      viewEditLink.hidden = !showEdit;
      if (showEdit) {
        viewEditLink.href = `admin-reservations-manage.html?edit=${encodeURIComponent(booking.id)}`;
      }
    }
    viewCard.hidden = false;
    viewCard.scrollIntoView({ behavior: "smooth", block: "start" });
    syncBookingQuery();
  }

  function reservationIdLink(booking) {
    const id = AdminCommon.escapeHtml(booking.id);
    const conf = AdminCommon.escapeHtml(Auth.bookingConfirmationId(booking));
    const href = `admin-reservations-view.html?view=${encodeURIComponent(booking.id)}`;
    return `<a class="reservation-id-link" href="${href}" data-open-booking="${id}"><code>${conf}</code></a>`;
  }

  function renderBookings() {
    if (!bookings.length) {
      bookingsBody.innerHTML = `<tr><td colspan="8">No bookings yet.</td></tr>`;
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const sorted = [...bookings].sort((a, b) => {
      const aIn = a.check_in || "";
      const bIn = b.check_in || "";
      if (aIn !== bIn) return aIn > bIn ? -1 : 1;
      return 0;
    });

    bookingsBody.innerHTML = sorted
      .map((b) => {
        const type = Auth.reservationTypeLabel(b.reservation_type) || "—";
        const dates =
          b.check_in && b.check_out
            ? window.SpotAvailability?.formatDateRange?.(b.check_in, b.check_out) ||
              `${b.check_in} → ${b.check_out}`
            : "—";
        const conf = Auth.bookingConfirmationId(b);
        const member = AdminCommon.memberLabel(profiles, b.user_id);
        const past = b.check_out && b.check_out < today;
        const canCancel = canManage && b.status !== "cancelled";
        const canEdit = canManage && b.status !== "cancelled";
        const displayStatus =
          typeof Auth.bookingDisplayStatus === "function"
            ? Auth.bookingDisplayStatus(b)
            : b.status || "—";
        const pillClass =
          typeof Auth.bookingStatusClass === "function"
            ? Auth.bookingStatusClass(displayStatus)
            : displayStatus === "Past"
              ? "booked"
              : displayStatus === "Cancelled"
                ? "cancelled"
              : displayStatus === "Active" || displayStatus === "Confirmed"
                ? "available"
                : "partial";
        const actions = canManage
          ? `<td class="admin-actions admin-booking-actions">
              ${
                canEdit
                  ? `<a class="btn btn-outline btn-small" href="admin-reservations-manage.html?edit=${encodeURIComponent(b.id)}">Edit</a>`
                  : ""
              }
              ${
                canCancel
                  ? `<button type="button" class="btn btn-primary btn-small" data-action="cancelled" data-booking-id="${AdminCommon.escapeHtml(b.id)}" data-label="${AdminCommon.escapeHtml(conf + " · " + member)}">Cancel</button>`
                  : `<span class="admin-help">—</span>`
              }
            </td>`
          : `<td><span class="admin-help">View only</span></td>`;
        return `<tr class="${past && b.status !== "cancelled" ? "admin-booking-past" : ""}">
          <td>${reservationIdLink(b)}</td>
          <td>${AdminCommon.escapeHtml(formatBookedDate(b.created_at))}</td>
          <td>${AdminCommon.escapeHtml(member)}</td>
          <td>${AdminCommon.escapeHtml(type)}</td>
          <td>${AdminCommon.escapeHtml(b.spot || "—")}</td>
          <td>${AdminCommon.escapeHtml(dates)}</td>
          <td>${
            typeof BookingLimits !== "undefined"
              ? BookingLimits.statusWithFlags(
                  `<span class="status-pill ${pillClass}">${AdminCommon.escapeHtml(displayStatus)}</span>`,
                  b.rule_overrides
                )
              : `<span class="status-pill ${pillClass}">${AdminCommon.escapeHtml(displayStatus)}</span>`
          }</td>
          ${actions}
        </tr>`;
      })
      .join("");
  }

  try {
    [profiles, bookings] = await Promise.all([
      Auth.listAllProfiles(),
      Auth.listAllBookings(),
    ]);
    if (typeof BookingLimits?.setAdminDirectory === "function") {
      BookingLimits.setAdminDirectory(profiles);
    }
    renderBookings();
    const viewId = new URLSearchParams(window.location.search).get("view");
    if (viewId) {
      const booking = bookings.find((b) => b.id === viewId);
      if (booking) openView(booking);
    }
  } catch (err) {
    AdminCommon.showMessage(message, err.message, "error");
    bookingsBody.innerHTML = `<tr><td colspan="8">${AdminCommon.escapeHtml(err.message)}</td></tr>`;
  }

  document.getElementById("admin-view-close")?.addEventListener("click", () => {
    closeView();
  });

  bookingsBody?.addEventListener("click", async (event) => {
    const flagBtn = event.target.closest(".status-flag");
    if (flagBtn && bookingsBody.contains(flagBtn)) {
      event.preventDefault();
      event.stopPropagation();
      const index = flagBtn.getAttribute("data-flag-index");
      const cell = flagBtn.closest("td");
      const detail = cell?.querySelector(`.status-flag-detail[data-flag-index="${index}"]`);
      const open = flagBtn.getAttribute("aria-expanded") !== "true";
      flagBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (detail) detail.hidden = !open;
      return;
    }

    const openLink = event.target.closest("a[data-open-booking]");
    if (openLink && bookingsBody.contains(openLink)) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      const booking = bookings.find((b) => b.id === openLink.getAttribute("data-open-booking"));
      if (booking) openView(booking);
      return;
    }

    const button = event.target.closest("button[data-action='cancelled']");
    if (!button || !canManage) return;
    const id = button.getAttribute("data-booking-id");
    const label = button.getAttribute("data-label") || "this reservation";
    const ok = await AdminCommon.confirmAction({
      title: "Confirm action",
      message: `Cancel reservation ${label}?\n\nThe member will no longer hold this stay.`,
      confirmLabel: "Cancel reservation",
      cancelLabel: "Go back",
    });
    if (!ok) return;
    button.disabled = true;
    try {
      await Auth.updateBookingStatus(id, "cancelled");
      AdminCommon.showMessage(message, "Booking cancelled.", "success");
      window.location.reload();
    } catch (err) {
      AdminCommon.showMessage(message, err.message, "error");
      button.disabled = false;
    }
  });
})();
