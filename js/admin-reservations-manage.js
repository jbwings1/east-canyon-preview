(async function () {
  const me = await AdminCommon.requireAdmin("reservations_manage");
  if (!me) return;

  const bookingsBody = document.getElementById("admin-bookings-body");
  const bookingMember = document.getElementById("booking-member");
  const bookingType = document.getElementById("booking-type");
  const message = document.getElementById("admin-message");
  const createForm = document.getElementById("admin-create-booking-form");
  let profiles = [];
  let bookings = [];

  function renderBookingMemberOptions() {
    const current = bookingMember.value;
    bookingMember.innerHTML = `<option value="">Select member…</option>`;
    profiles
      .filter((m) => m.account_kind === "member" && m.account_status !== "closed")
      .forEach((m) => {
        const option = document.createElement("option");
        option.value = m.id;
        option.textContent = `${m.full_name || m.email}${m.member_id ? ` · ${m.member_id}` : ""}`;
        bookingMember.appendChild(option);
      });
    if (current) bookingMember.value = current;
  }

  function renderBookings() {
    if (!bookings.length) {
      bookingsBody.innerHTML = `<tr><td colspan="6">No bookings yet.</td></tr>`;
      return;
    }
    bookingsBody.innerHTML = bookings
      .map((b) => {
        const type = Auth.reservationTypeLabel(b.reservation_type) || "—";
        const dates = b.check_in && b.check_out ? `${b.check_in} → ${b.check_out}` : "—";
        const canConfirm = b.status !== "confirmed" && b.status !== "cancelled";
        const canCancel = b.status !== "cancelled";
        return `<tr data-booking-id="${AdminCommon.escapeHtml(b.id)}">
          <td>${AdminCommon.escapeHtml(AdminCommon.memberLabel(profiles, b.user_id))}</td>
          <td>${AdminCommon.escapeHtml(type)}</td>
          <td>${AdminCommon.escapeHtml(b.spot || "—")}</td>
          <td>${AdminCommon.escapeHtml(dates)}</td>
          <td><span class="status-pill ${b.status === "confirmed" ? "available" : b.status === "cancelled" ? "booked" : "partial"}">${AdminCommon.escapeHtml(b.status || "—")}</span></td>
          <td class="admin-actions">
            ${canConfirm ? `<button type="button" class="btn-link" data-action="confirmed">Confirm</button>` : ""}
            ${canCancel ? `<button type="button" class="btn-link" data-action="cancelled">Cancel</button>` : ""}
          </td>
        </tr>`;
      })
      .join("");
  }

  async function load() {
    profiles = await Auth.listAllProfiles();
    bookings = await Auth.listAllBookings();
    renderBookingMemberOptions();
    renderBookings();
  }

  function evaluateSelectedMemberRights() {
    if (typeof MembershipRights === "undefined") {
      return { ok: true, violations: [] };
    }
    const memberUserId = bookingMember.value;
    const profile = profiles.find((p) => p.id === memberUserId);
    const memberId = profile?.member_id || "";
    const reservationType = bookingType.value;
    const checkIn = document.getElementById("booking-check-in").value;
    const checkOut = document.getElementById("booking-check-out").value;
    const existing = bookings.filter((b) => b.user_id === memberUserId);
    return MembershipRights.validateBooking({
      memberId,
      reservationType,
      checkIn,
      checkOut,
      existingBookings: existing,
    });
  }

  createForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const result = document.getElementById("admin-create-booking-result");
    AdminCommon.showMessage(result, "", "");
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const gate = evaluateSelectedMemberRights();
      if (!gate.ok) {
        const limitText = MembershipRights.formatViolations(gate.violations);
        const override = await MembershipRights.showOverrideDialog(
          `${limitText} As an admin you may override this class limit, or start over.`
        );
        if (!override) {
          e.target.reset();
          AdminCommon.showMessage(result, "Started over — reservation not saved.", "");
          return;
        }
      }

      await Auth.createBookingForMember({
        memberUserId: document.getElementById("booking-member").value,
        reservationType: document.getElementById("booking-type").value,
        spot: document.getElementById("booking-spot").value.trim(),
        checkIn: document.getElementById("booking-check-in").value,
        checkOut: document.getElementById("booking-check-out").value,
        notes: document.getElementById("booking-notes").value.trim(),
      });
      AdminCommon.showMessage(result, "Reservation created for the member.", "success");
      e.target.reset();
      await load();
    } catch (err) {
      AdminCommon.showMessage(result, err.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  bookingsBody?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest("tr[data-booking-id]");
    if (!row) return;
    const status = button.getAttribute("data-action");
    button.disabled = true;
    try {
      await Auth.updateBookingStatus(row.getAttribute("data-booking-id"), status);
      AdminCommon.showMessage(
        message,
        status === "confirmed" ? "Booking confirmed." : "Booking cancelled.",
        "success"
      );
      await load();
    } catch (err) {
      AdminCommon.showMessage(message, err.message, "error");
      button.disabled = false;
    }
  });

  try {
    await load();
  } catch (err) {
    AdminCommon.showMessage(message, err.message, "error");
  }
})();
