/**
 * Admin Manage Reservations — create, edit, confirm, cancel.
 */
(async function () {
  const me = await AdminCommon.requireAdmin("reservations_manage");
  if (!me) return;

  const bookingsBody = document.getElementById("admin-bookings-body");
  const bookingMember = document.getElementById("booking-member");
  const bookingType = document.getElementById("booking-type");
  const message = document.getElementById("admin-message");
  const createForm = document.getElementById("admin-create-booking-form");
  const viewCard = document.getElementById("admin-view-card");
  const viewSummary = document.getElementById("admin-view-summary");
  const viewDetails = document.getElementById("admin-view-details");
  const viewEditBtn = document.getElementById("admin-view-edit");
  const editCard = document.getElementById("admin-edit-card");
  const editForm = document.getElementById("admin-edit-booking-form");
  const editResult = document.getElementById("admin-edit-booking-result");
  const editSummary = document.getElementById("admin-edit-summary");
  const filterStatus = document.getElementById("booking-filter-status");
  const filterSearch = document.getElementById("booking-filter-search");
  const checkinPending = document.getElementById("admin-checkin-pending");
  const checkinDone = document.getElementById("admin-checkin-done");
  const checkinResult = document.getElementById("admin-checkin-result");

  let profiles = [];
  let bookings = [];
  let editingId = null;
  let viewingId = null;

  function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  }

  /** Office check-in is allowed from the reservation check-in date onward. */
  function canOfficeCheckIn(booking) {
    if (!booking) return false;
    if (booking.status === "cancelled") return false;
    if (booking.status === "active" || booking.office_checked_in_at) return false;
    if (booking.status !== "confirmed") return false;
    const checkIn = booking.check_in || "";
    if (!checkIn) return false;
    return checkIn <= todayIso();
  }

  function officeCheckInTooEarlyMessage(booking) {
    const checkIn = booking?.check_in || "";
    if (!checkIn) return "Office check-in is only available on or after the reservation check-in date.";
    return `Office check-in opens on the first day of the stay (${checkIn}).`;
  }

  function uiType(dbType) {
    return Auth.toUiReservationType?.(dbType) || dbType || "rv";
  }

  function confirmationId(booking) {
    return Auth.bookingConfirmationId(booking);
  }

  function memberLabel(userId) {
    return AdminCommon.memberLabel(profiles, userId);
  }

  function memberIdForUser(userId) {
    return profiles.find((p) => p.id === userId)?.member_id || "";
  }

  function ruleFlagForBooking(booking) {
    if (typeof BookingRuleFlags === "undefined") {
      return { ok: true, message: "", kinds: [] };
    }
    return BookingRuleFlags.evaluateBookingRules(booking, {
      allBookings: bookings,
      memberId: memberIdForUser(booking?.user_id),
    });
  }

  function ruleFlagMarkup(flag) {
    if (flag.ok) return "";
    const label =
      typeof BookingRuleFlags !== "undefined"
        ? BookingRuleFlags.flagLabel(flag.kinds)
        : "Rule flag";
    return `<span class="admin-class-flag" title="${AdminCommon.escapeHtml(flag.message)}">${label}</span>
      <span class="admin-class-flag-detail">${AdminCommon.escapeHtml(flag.message)}</span>`;
  }

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

  function filteredBookings() {
    const statusFilter = filterStatus?.value || "active";
    const q = String(filterSearch?.value || "")
      .trim()
      .toLowerCase();
    const today = todayIso();

    return bookings
      .filter((b) => {
        if (statusFilter === "cancelled") return b.status === "cancelled";
        if (statusFilter === "flagged") {
          if (b.status === "cancelled") return false;
          return !ruleFlagForBooking(b).ok;
        }
        if (statusFilter === "active") {
          if (b.status === "cancelled") return false;
          if (b.check_out && b.check_out < today) return false;
          return true;
        }
        return true;
      })
      .filter((b) => {
        if (!q) return true;
        const label = memberLabel(b.user_id).toLowerCase();
        const conf = confirmationId(b).toLowerCase();
        const spot = String(b.spot || "").toLowerCase();
        return label.includes(q) || conf.includes(q) || spot.includes(q);
      })
      .sort((a, b) => {
        const aIn = a.check_in || "";
        const bIn = b.check_in || "";
        if (aIn !== bIn) return aIn < bIn ? -1 : 1;
        return String(a.created_at || "") < String(b.created_at || "") ? -1 : 1;
      });
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function staffLabel(userId) {
    if (!userId) return "—";
    const profile = profiles.find((p) => p.id === userId);
    if (!profile) return String(userId).slice(0, 8);
    const seat =
      profile.admin_level != null
        ? ` · ${profile.admin_level}${profile.admin_seat || ""}`
        : "";
    return `${profile.full_name || profile.email || "Staff"}${seat}`;
  }

  function renderCheckInSection(booking) {
    AdminCommon.showMessage(checkinResult, "", "");
    if (!booking) {
      if (checkinPending) checkinPending.hidden = true;
      if (checkinDone) checkinDone.hidden = true;
      return;
    }
    const checkedIn =
      booking.status === "active" || Boolean(booking.office_checked_in_at);
    if (checkinPending) checkinPending.hidden = checkedIn;
    if (checkinDone) checkinDone.hidden = !checkedIn;
    if (!checkedIn) {
      const notesEl = document.getElementById("office-check-in-notes");
      const checkInBtn = document.getElementById("admin-office-check-in-btn");
      const earlyEl = document.getElementById("admin-checkin-too-early");
      if (notesEl) notesEl.value = booking.office_check_in_notes || "";
      const allowed = canOfficeCheckIn(booking);
      if (checkInBtn) {
        checkInBtn.disabled = !allowed;
        checkInBtn.title = allowed ? "" : officeCheckInTooEarlyMessage(booking);
      }
      if (earlyEl) {
        earlyEl.hidden = allowed;
        earlyEl.textContent = allowed ? "" : officeCheckInTooEarlyMessage(booking);
      }
      return;
    }
    const byEl = document.getElementById("office-checked-in-by-label");
    const atEl = document.getElementById("office-checked-in-at-label");
    const notesEdit = document.getElementById("office-check-in-notes-edit");
    if (byEl) byEl.textContent = staffLabel(booking.office_checked_in_by);
    if (atEl) atEl.textContent = formatDateTime(booking.office_checked_in_at);
    if (notesEdit) notesEdit.value = booking.office_check_in_notes || "";
  }

  function detailRow(label, value, { span = false } = {}) {
    const text = value == null || value === "" ? "—" : String(value);
    const spanClass = span ? " admin-view-span" : "";
    return `<div class="${spanClass.trim()}">
      <dt>${AdminCommon.escapeHtml(label)}</dt>
      <dd>${AdminCommon.escapeHtml(text)}</dd>
    </div>`;
  }

  function memberProfile(userId) {
    return profiles.find((p) => p.id === userId) || null;
  }

  function closeView() {
    viewingId = null;
    if (viewCard) viewCard.hidden = true;
    if (viewDetails) viewDetails.innerHTML = "";
    if (viewSummary) viewSummary.textContent = "";
    if (viewEditBtn) viewEditBtn.hidden = true;
  }

  function openView(booking) {
    if (!booking) return;
    closeEdit();
    viewingId = booking.id;
    const profile = memberProfile(booking.user_id);
    const displayStatus =
      typeof Auth.bookingDisplayStatus === "function"
        ? Auth.bookingDisplayStatus(booking)
        : booking.status || "—";
    const flag = ruleFlagForBooking(booking);
    const bookedBy =
      booking.booked_by_kind === "admin"
        ? `Admin · ${staffLabel(booking.booked_by_user_id)}`
        : booking.booked_by_kind === "member"
          ? `Member · ${memberLabel(booking.booked_by_user_id || booking.user_id)}`
          : booking.booked_by_kind || "—";

    if (viewSummary) {
      viewSummary.textContent = `${confirmationId(booking)} · ${memberLabel(booking.user_id)} · ${displayStatus}`;
    }

    if (viewDetails) {
      viewDetails.innerHTML = [
        detailRow("Confirmation", confirmationId(booking)),
        detailRow("Status", displayStatus),
        detailRow("Member", profile?.full_name || memberLabel(booking.user_id)),
        detailRow("Member ID", profile?.member_id || "—"),
        detailRow("Email", profile?.email || "—"),
        detailRow("Phone", profile?.phone || "—"),
        detailRow("Type", Auth.reservationTypeLabel(booking.reservation_type) || booking.reservation_type || "—"),
        detailRow("Spot / unit", booking.spot || "—"),
        detailRow("Check in", booking.check_in || "—"),
        detailRow("Check out", booking.check_out || "—"),
        detailRow("Original check in", booking.original_check_in || "—"),
        detailRow("Original check out", booking.original_check_out || "—"),
        detailRow("Booked by", bookedBy),
        detailRow("Created", formatDateTime(booking.created_at)),
        detailRow("Confirmed", formatDateTime(booking.confirmed_at)),
        detailRow("Last edited", formatDateTime(booking.edited_at)),
        detailRow("Last edit summary", booking.last_edit_summary || "—", { span: true }),
        detailRow("Reservation notes", booking.notes || "—", { span: true }),
        detailRow("Office checked in", formatDateTime(booking.office_checked_in_at)),
        detailRow("Checked in by", staffLabel(booking.office_checked_in_by)),
        detailRow("Office check-in notes", booking.office_check_in_notes || "—", { span: true }),
        detailRow(
          "Rule flags",
          flag.ok ? "None" : flag.message || "Flagged",
          { span: true }
        ),
        detailRow("Booking ID", booking.id || "—", { span: true }),
      ].join("");
    }

    if (viewEditBtn) viewEditBtn.hidden = booking.status === "cancelled";
    if (viewCard) {
      viewCard.hidden = false;
      viewCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function closeEdit() {
    editingId = null;
    if (editCard) editCard.hidden = true;
    editForm?.reset();
    AdminCommon.showMessage(editResult, "", "");
    AdminCommon.showMessage(checkinResult, "", "");
    renderCheckInSection(null);
    setRightsNotice(document.getElementById("admin-edit-rights-notice"), {
      ok: true,
      violations: [],
    });
  }

  function openEdit(booking) {
    if (!booking || booking.status === "cancelled") return;
    closeView();
    editingId = booking.id;
    document.getElementById("edit-booking-id").value = booking.id;
    document.getElementById("edit-booking-type").value = uiType(booking.reservation_type);
    document.getElementById("edit-booking-spot").value = booking.spot || "";
    document.getElementById("edit-booking-check-in").value = booking.check_in || "";
    document.getElementById("edit-booking-check-out").value = booking.check_out || "";
    document.getElementById("edit-booking-notes").value = booking.notes || "";
    if (editSummary) {
      const status =
        typeof Auth.bookingDisplayStatus === "function"
          ? Auth.bookingDisplayStatus(booking)
          : booking.status;
      editSummary.textContent = `${confirmationId(booking)} · ${memberLabel(booking.user_id)} · ${status}`;
    }
    renderCheckInSection(booking);
    refreshEditRightsNotice();
    if (editCard) {
      editCard.hidden = false;
      editCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    AdminCommon.showMessage(editResult, "", "");
  }

  function renderBookings() {
    const rows = filteredBookings();
    if (!rows.length) {
      bookingsBody.innerHTML = `<tr><td colspan="7">No bookings match this filter.</td></tr>`;
      return;
    }
    bookingsBody.innerHTML = rows
      .map((b) => {
        const type = Auth.reservationTypeLabel(b.reservation_type) || "—";
        const dates = b.check_in && b.check_out ? `${b.check_in} → ${b.check_out}` : "—";
        const canConfirm = b.status !== "confirmed" && b.status !== "cancelled" && b.status !== "active";
        const canCancel = b.status !== "cancelled";
        const canEdit = b.status !== "cancelled";
        const flag = ruleFlagForBooking(b);
        const rowClass = flag.ok ? "" : " admin-row-class-flag";
        const displayStatus =
          typeof Auth.bookingDisplayStatus === "function"
            ? Auth.bookingDisplayStatus(b)
            : b.status || "—";
        const pillClass =
          displayStatus === "Cancelled"
            ? "booked"
            : displayStatus === "Active"
              ? "available"
              : displayStatus === "Confirmed" || displayStatus === "Edit confirmed"
                ? "available"
                : "partial";
        return `<tr class="${rowClass.trim()}" data-booking-id="${AdminCommon.escapeHtml(b.id)}">
          <td><code>${AdminCommon.escapeHtml(confirmationId(b))}</code>${ruleFlagMarkup(flag)}</td>
          <td>${AdminCommon.escapeHtml(memberLabel(b.user_id))}</td>
          <td>${AdminCommon.escapeHtml(type)}</td>
          <td>${AdminCommon.escapeHtml(b.spot || "—")}</td>
          <td>${AdminCommon.escapeHtml(dates)}</td>
          <td><span class="status-pill ${pillClass}">${AdminCommon.escapeHtml(displayStatus)}</span></td>
          <td class="admin-booking-actions">
            <div class="admin-row-menu">
              <button type="button" class="btn btn-outline btn-small admin-row-menu-toggle" aria-expanded="false" aria-haspopup="menu">Actions</button>
              <div class="admin-row-menu-panel" role="menu" hidden>
                <button type="button" role="menuitem" data-action="view">View</button>
                ${canEdit ? `<button type="button" role="menuitem" data-action="edit">Edit</button>` : ""}
                ${
                  canOfficeCheckIn(b)
                    ? `<button type="button" role="menuitem" data-action="checkin">Check in</button>`
                    : ""
                }
                ${
                  canConfirm
                    ? `<button type="button" role="menuitem" data-action="confirmed">Confirm</button>`
                    : ""
                }
                ${
                  canCancel
                    ? `<button type="button" role="menuitem" class="is-danger" data-action="cancelled">Cancel</button>`
                    : ""
                }
              </div>
            </div>
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
    const flagged = bookings.filter((b) => !ruleFlagForBooking(b).ok).length;
    if (flagged) {
      AdminCommon.showMessage(
        message,
        `${flagged} booking${flagged === 1 ? "" : "s"} flagged for broken reservation rules. Filter: Rule flags.`,
        "error"
      );
    }
    if (editingId) {
      const still = bookings.find((b) => b.id === editingId);
      if (still && still.status !== "cancelled") openEdit(still);
      else closeEdit();
    } else if (viewingId) {
      const still = bookings.find((b) => b.id === viewingId);
      if (still) openView(still);
      else closeView();
    }
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

  function evaluateEditRights(booking) {
    if (typeof MembershipRights === "undefined" || !booking) {
      return { ok: true, violations: [] };
    }
    const profile = profiles.find((p) => p.id === booking.user_id);
    return MembershipRights.validateBooking({
      memberId: profile?.member_id || memberIdForUser(booking.user_id),
      reservationType: document.getElementById("edit-booking-type").value,
      checkIn: document.getElementById("edit-booking-check-in").value,
      checkOut: document.getElementById("edit-booking-check-out").value,
      existingBookings: bookings.filter((b) => b.user_id === booking.user_id),
      excludeBookingId: booking.id,
    });
  }

  function setRightsNotice(el, gate) {
    if (!el) return;
    if (!gate || gate.ok || !(gate.violations || []).length) {
      el.hidden = true;
      el.textContent = "";
      el.classList.remove("stay-length-notice--limit");
      return;
    }
    el.hidden = false;
    el.classList.add("stay-length-notice--limit");
    el.textContent = MembershipRights.formatViolations(gate.violations);
  }

  function refreshCreateRightsNotice() {
    const el = document.getElementById("admin-create-rights-notice");
    const checkIn = document.getElementById("booking-check-in")?.value;
    const checkOut = document.getElementById("booking-check-out")?.value;
    if (!bookingMember?.value || !checkIn || !checkOut || checkOut <= checkIn) {
      setRightsNotice(el, { ok: true, violations: [] });
      return;
    }
    setRightsNotice(el, evaluateSelectedMemberRights());
  }

  function refreshEditRightsNotice() {
    const el = document.getElementById("admin-edit-rights-notice");
    const id = document.getElementById("edit-booking-id")?.value || editingId;
    const booking = bookings.find((b) => b.id === id);
    if (!booking) {
      setRightsNotice(el, { ok: true, violations: [] });
      return;
    }
    const checkIn = document.getElementById("edit-booking-check-in")?.value;
    const checkOut = document.getElementById("edit-booking-check-out")?.value;
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setRightsNotice(el, { ok: true, violations: [] });
      return;
    }
    setRightsNotice(el, evaluateEditRights(booking));
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
          refreshCreateRightsNotice();
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
      refreshCreateRightsNotice();
      await load();
    } catch (err) {
      AdminCommon.showMessage(result, err.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    AdminCommon.showMessage(editResult, "", "");
    const id = document.getElementById("edit-booking-id").value;
    const booking = bookings.find((b) => b.id === id);
    if (!booking) {
      AdminCommon.showMessage(editResult, "Booking not found.", "error");
      return;
    }
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const gate = evaluateEditRights(booking);
      if (!gate.ok) {
        const limitText = MembershipRights.formatViolations(gate.violations);
        const override = await MembershipRights.showOverrideDialog(
          `${limitText} As an admin you may override this class limit, or start over.`
        );
        if (!override) {
          AdminCommon.showMessage(editResult, "Edit cancelled — class limit not overridden.", "");
          return;
        }
      }
      await Auth.updateBookingAsAdmin(id, {
        reservationType: document.getElementById("edit-booking-type").value,
        spot: document.getElementById("edit-booking-spot").value.trim(),
        checkIn: document.getElementById("edit-booking-check-in").value,
        checkOut: document.getElementById("edit-booking-check-out").value,
        notes: document.getElementById("edit-booking-notes").value.trim(),
      });
      AdminCommon.showMessage(editResult, "Reservation updated.", "success");
      AdminCommon.showMessage(message, "Reservation updated.", "success");
      await load();
    } catch (err) {
      AdminCommon.showMessage(editResult, err.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.getElementById("admin-edit-cancel")?.addEventListener("click", () => {
    closeEdit();
  });

  document.getElementById("admin-view-close")?.addEventListener("click", () => {
    closeView();
  });

  document.getElementById("admin-view-edit")?.addEventListener("click", () => {
    const booking = bookings.find((b) => b.id === viewingId);
    if (booking) openEdit(booking);
  });

  document.getElementById("admin-office-check-in-btn")?.addEventListener("click", async () => {
    const id = document.getElementById("edit-booking-id")?.value || editingId;
    if (!id) return;
    const booking = bookings.find((b) => b.id === id);
    if (booking && !canOfficeCheckIn(booking)) {
      AdminCommon.showMessage(checkinResult, officeCheckInTooEarlyMessage(booking), "error");
      return;
    }
    const notes = document.getElementById("office-check-in-notes")?.value.trim() || "";
    const ok = await AdminCommon.confirmAction({
      title: "Confirm action",
      message:
        "Check this member in at the office now?\n\nStatus will change from Confirmed to Active, and it will no longer count toward their max of 2 upcoming stays.",
      confirmLabel: "Check in",
      cancelLabel: "Go back",
    });
    if (!ok) return;
    const btn = document.getElementById("admin-office-check-in-btn");
    if (btn) btn.disabled = true;
    try {
      await Auth.checkInBookingAsAdmin(id, { notes });
      AdminCommon.showMessage(checkinResult, "Member checked in.", "success");
      AdminCommon.showMessage(message, "Office check-in saved.", "success");
      await load();
      const updated = bookings.find((b) => b.id === id);
      if (updated) openEdit(updated);
    } catch (err) {
      AdminCommon.showMessage(checkinResult, err.message, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document
    .getElementById("admin-office-check-in-notes-save")
    ?.addEventListener("click", async () => {
      const id = document.getElementById("edit-booking-id")?.value || editingId;
      if (!id) return;
      const notes = document.getElementById("office-check-in-notes-edit")?.value || "";
      const btn = document.getElementById("admin-office-check-in-notes-save");
      if (btn) btn.disabled = true;
      try {
        await Auth.updateOfficeCheckInNotesAsAdmin(id, notes);
        AdminCommon.showMessage(checkinResult, "Check-in notes saved.", "success");
        await load();
        const updated = bookings.find((b) => b.id === id);
        if (updated) openEdit(updated);
      } catch (err) {
        AdminCommon.showMessage(checkinResult, err.message, "error");
      } finally {
        if (btn) btn.disabled = false;
      }
    });

  filterStatus?.addEventListener("change", renderBookings);
  filterSearch?.addEventListener("input", renderBookings);

  ["booking-member", "booking-type", "booking-check-in", "booking-check-out"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      AdminCommon.showMessage(document.getElementById("admin-create-booking-result"), "", "");
      refreshCreateRightsNotice();
    });
  });
  ["edit-booking-type", "edit-booking-check-in", "edit-booking-check-out"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      AdminCommon.showMessage(editResult, "", "");
      refreshEditRightsNotice();
    });
  });

  function closeAllRowMenus(exceptPanel = null) {
    document.querySelectorAll(".admin-row-menu-panel").forEach((panel) => {
      if (exceptPanel && panel === exceptPanel) return;
      panel.hidden = true;
      const toggle = panel.parentElement?.querySelector(".admin-row-menu-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
  }

  bookingsBody?.addEventListener("click", async (event) => {
    const toggle = event.target.closest(".admin-row-menu-toggle");
    if (toggle && bookingsBody.contains(toggle)) {
      event.stopPropagation();
      const panel = toggle.parentElement?.querySelector(".admin-row-menu-panel");
      const willOpen = Boolean(panel?.hidden);
      closeAllRowMenus(willOpen ? panel : null);
      if (panel) {
        panel.hidden = !willOpen;
        toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      }
      return;
    }

    const button = event.target.closest("button[data-action]");
    if (!button || !bookingsBody.contains(button)) return;
    const row = button.closest("tr[data-booking-id]");
    if (!row) return;
    const id = row.getAttribute("data-booking-id");
    const booking = bookings.find((b) => b.id === id);
    const action = button.getAttribute("data-action");
    closeAllRowMenus();

    if (action === "view") {
      if (booking) openView(booking);
      return;
    }

    if (action === "edit") {
      if (booking) openEdit(booking);
      return;
    }

    if (action === "checkin") {
      if (booking) {
        openEdit(booking);
        document.getElementById("admin-checkin-block")?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
      return;
    }

    if (action === "cancelled") {
      const label = booking
        ? `${confirmationId(booking)} (${memberLabel(booking.user_id)})`
        : "this reservation";
      const ok = await AdminCommon.confirmAction({
        title: "Confirm action",
        message: `Cancel reservation ${label}?\n\nThe member will no longer hold this stay.`,
        confirmLabel: "Cancel reservation",
        cancelLabel: "Go back",
      });
      if (!ok) return;
    }

    button.disabled = true;
    try {
      await Auth.updateBookingStatus(id, action);
      AdminCommon.showMessage(
        message,
        action === "confirmed" ? "Booking confirmed." : "Booking cancelled.",
        "success"
      );
      if (action === "cancelled" && editingId === id) closeEdit();
      await load();
    } catch (err) {
      AdminCommon.showMessage(message, err.message, "error");
      button.disabled = false;
    }
  });

  document.addEventListener("click", () => closeAllRowMenus());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllRowMenus();
  });

  try {
    await load();
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (editId) {
      const booking = bookings.find((b) => b.id === editId);
      if (booking) openEdit(booking);
    }
  } catch (err) {
    AdminCommon.showMessage(message, err.message, "error");
  }
})();
