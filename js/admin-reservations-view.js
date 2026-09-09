(async function () {
  const me = await AdminCommon.requireAdmin("reservations_view");
  if (!me) return;

  const bookingsBody = document.getElementById("admin-bookings-body");
  const message = document.getElementById("admin-message");

  try {
    const [profiles, bookings] = await Promise.all([
      Auth.listAllProfiles(),
      Auth.listAllBookings(),
    ]);
    if (!bookings.length) {
      bookingsBody.innerHTML = `<tr><td colspan="5">No bookings yet.</td></tr>`;
      return;
    }
    bookingsBody.innerHTML = bookings
      .map((b) => {
        const type = Auth.reservationTypeLabel(b.reservation_type) || "—";
        const dates = b.check_in && b.check_out ? `${b.check_in} → ${b.check_out}` : "—";
        return `<tr>
          <td>${AdminCommon.escapeHtml(AdminCommon.memberLabel(profiles, b.user_id))}</td>
          <td>${AdminCommon.escapeHtml(type)}</td>
          <td>${AdminCommon.escapeHtml(b.spot || "—")}</td>
          <td>${AdminCommon.escapeHtml(dates)}</td>
          <td><span class="status-pill ${b.status === "confirmed" ? "available" : b.status === "cancelled" ? "booked" : "partial"}">${AdminCommon.escapeHtml(b.status || "—")}</span></td>
        </tr>`;
      })
      .join("");
  } catch (err) {
    AdminCommon.showMessage(message, err.message, "error");
    bookingsBody.innerHTML = `<tr><td colspan="5">${AdminCommon.escapeHtml(err.message)}</td></tr>`;
  }
})();
