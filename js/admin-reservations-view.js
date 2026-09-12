/**
 * Admin View Reservations — list all bookings; Edit/Cancel when manage task assigned.
 */
(async function () {
  const me = await AdminCommon.requireAdmin("reservations_view");
  if (!me) return;

  const bookingsBody = document.getElementById("admin-bookings-body");
  const message = document.getElementById("admin-message");
  const canManage = Auth.hasAdminTask("reservations_manage");
  const manageHint = document.getElementById("admin-manage-hint");

  if (manageHint) {
    manageHint.hidden = false;
    manageHint.innerHTML = canManage
      ? `You can <strong>Edit</strong> or <strong>Cancel</strong> below, or open <a href="admin-reservations-manage.html">Manage reservations</a>.`
      : `This list is view-only. Cancel and edit are on <a href="admin-reservations-manage.html">Manage reservations</a> (requires the Manage reservations task).`;
  }

  try {
    const [profiles, bookings] = await Promise.all([
      Auth.listAllProfiles(),
      Auth.listAllBookings(),
    ]);
    if (!bookings.length) {
      bookingsBody.innerHTML = `<tr><td colspan="7">No bookings yet.</td></tr>`;
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const sorted = [...bookings].sort((a, b) => {
      const aIn = a.check_in || "";
      const bIn = b.check_in || "";
      if (aIn !== bIn) return aIn < bIn ? -1 : 1;
      return 0;
    });

    bookingsBody.innerHTML = sorted
      .map((b) => {
        const type = Auth.reservationTypeLabel(b.reservation_type) || "—";
        const dates = b.check_in && b.check_out ? `${b.check_in} → ${b.check_out}` : "—";
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
          displayStatus === "Cancelled"
            ? "booked"
            : displayStatus === "Active"
              ? "available"
              : displayStatus === "Confirmed"
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
          <td><code>${AdminCommon.escapeHtml(conf)}</code></td>
          <td>${AdminCommon.escapeHtml(member)}</td>
          <td>${AdminCommon.escapeHtml(type)}</td>
          <td>${AdminCommon.escapeHtml(b.spot || "—")}</td>
          <td>${AdminCommon.escapeHtml(dates)}</td>
          <td><span class="status-pill ${pillClass}">${AdminCommon.escapeHtml(displayStatus)}</span></td>
          ${actions}
        </tr>`;
      })
      .join("");
  } catch (err) {
    AdminCommon.showMessage(message, err.message, "error");
    bookingsBody.innerHTML = `<tr><td colspan="7">${AdminCommon.escapeHtml(err.message)}</td></tr>`;
  }

  bookingsBody?.addEventListener("click", async (event) => {
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
