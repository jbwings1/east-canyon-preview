(async function () {
  const query = AdminCommon.readProfileQuery();
  const me = await AdminCommon.requireAdmin("staff");
  if (!me) return;

  const summary = document.getElementById("delete-summary");
  const explain = document.getElementById("delete-explain");
  const message = document.getElementById("delete-message");
  const actions = document.getElementById("delete-actions");
  const confirmBtn = document.getElementById("confirm-delete-btn");
  const backLink = document.getElementById("delete-back-link");
  const keepLink = document.getElementById("keep-staff-link");

  function row(label, value) {
    return `<div><dt>${AdminCommon.escapeHtml(label)}</dt><dd>${AdminCommon.escapeHtml(value || "—")}</dd></div>`;
  }

  if (!query.hasAny) {
    AdminCommon.showMessage(message, "Missing staff.", "error");
    summary.innerHTML = row("Error", "No staff selected.");
    return;
  }

  let staff = null;
  let bookingCount = 0;
  try {
    const [profiles, bookings] = await Promise.all([
      Auth.listAllProfiles(),
      Auth.listAllBookings(),
    ]);
    staff =
      AdminCommon.resolveListedProfile(profiles, query, (p) => AdminCommon.isStaffProfile(p)) ||
      query.remembered?.profile ||
      null;
    const resolvedId = AdminCommon.profileUserId(staff);
    bookingCount = (bookings || []).filter((b) => b.user_id === resolvedId).length;
  } catch (err) {
    staff = query.remembered?.profile || null;
    if (!staff) {
      AdminCommon.showMessage(message, err.message, "error");
      summary.innerHTML = row("Error", err.message);
      return;
    }
  }

  if (!staff) {
    AdminCommon.showMessage(message, "Staff not found.", "error");
    summary.innerHTML = row("Error", "That staff account is not on the list.");
    return;
  }

  const userId = AdminCommon.profileUserId(staff);
  const staffHref = AdminCommon.profileEditHref("admin-staff-edit.html", staff);
  if (backLink) {
    backLink.href = staffHref;
    backLink.textContent = "← Staff";
  }
  if (keepLink) keepLink.href = staffHref;

  if (userId && userId === me.id) {
    AdminCommon.showMessage(message, "You cannot delete your own account from this page.", "error");
    summary.innerHTML = row("Error", "This is the signed-in admin account.");
    return;
  }

  const hasMembership = AdminCommon.profileHasMembership(staff);
  summary.innerHTML = [
    row("Staff code", staff.staff_code),
    row("Name", staff.full_name),
    row("Email", staff.email),
    row("Level / seat", staff.admin_level != null ? `${staff.admin_level}${staff.admin_seat || ""}` : "—"),
    row("Member ID", staff.member_id || "—"),
    row("Status", AdminCommon.statusLabel(staff.account_status)),
    row("Reservations on file", String(bookingCount)),
  ].join("");

  if (hasMembership) {
    explain.textContent =
      "This person is both a member and staff. Delete removes only staff access (staff code, admin level, and tasks). Membership, member login, and reservations stay. The Auth account is not deleted.";
    confirmBtn.textContent = "Delete staff access";
  } else {
    explain.textContent =
      "This is a staff-only account. Delete permanently removes the staff record and Auth login. They will not be kept as a closed leftover.";
    confirmBtn.textContent = "Delete staff";
  }

  actions.hidden = false;
  confirmBtn.addEventListener("click", async () => {
    const label = staff.full_name || staff.email || "this staff account";
    const codeBit = staff.staff_code ? ` (${staff.staff_code})` : "";
    const ok = await AdminCommon.confirmAction({
      title: hasMembership ? "Delete staff access" : "Delete staff",
      message: hasMembership
        ? `Delete staff access for ${label}${codeBit}?\n\nThis removes only the staff part. Membership ${staff.member_id || ""}, the member login, and reservations stay. The Auth account is not deleted.`
        : `Permanently delete ${label}${codeBit}?\n\nThis removes the staff record and their Auth login. They will not be kept as a closed leftover. This cannot be undone.`,
      confirmLabel: confirmBtn.textContent,
    });
    if (!ok) return;
    confirmBtn.disabled = true;
    try {
      const result = await Auth.deleteStaff(userId);
      const flash = result.action === "removed" ? "removed" : "deleted";
      window.location.replace(`admin-staff.html?ok=${flash}`);
    } catch (err) {
      AdminCommon.showMessage(message, err.message, "error");
      confirmBtn.disabled = false;
    }
  });
})();
