(async function () {
  const query = AdminCommon.readProfileQuery();
  const me = await AdminCommon.requireAdmin("members");
  if (!me) return;

  const summary = document.getElementById("delete-summary");
  const explain = document.getElementById("delete-explain");
  const message = document.getElementById("delete-message");
  const actions = document.getElementById("delete-actions");
  const confirmBtn = document.getElementById("confirm-delete-btn");
  const backLink = document.getElementById("delete-back-link");
  const keepLink = document.getElementById("keep-membership-link");

  function row(label, value) {
    return `<div><dt>${AdminCommon.escapeHtml(label)}</dt><dd>${AdminCommon.escapeHtml(value || "—")}</dd></div>`;
  }

  if (!query.hasAny) {
    AdminCommon.showMessage(message, "Missing member.", "error");
    summary.innerHTML = row("Error", "No member selected.");
    return;
  }

  let member = null;
  let bookingCount = 0;
  try {
    const [profiles, bookings] = await Promise.all([
      Auth.listAllProfiles(),
      Auth.listAllBookings(),
    ]);
    member =
      AdminCommon.resolveListedProfile(profiles, query, (p) => AdminCommon.isMemberProfile(p)) ||
      query.remembered?.profile ||
      null;
    const resolvedId = AdminCommon.profileUserId(member);
    bookingCount = (bookings || []).filter((b) => b.user_id === resolvedId).length;
  } catch (err) {
    member = query.remembered?.profile || null;
    if (!member) {
      AdminCommon.showMessage(message, err.message, "error");
      summary.innerHTML = row("Error", err.message);
      return;
    }
  }

  if (!member) {
    AdminCommon.showMessage(message, "Member not found.", "error");
    summary.innerHTML = row("Error", "That member is not on the list.");
    return;
  }

  const userId = AdminCommon.profileUserId(member);
  const memberHref = AdminCommon.profileEditHref("admin-member-edit.html", member);
  if (backLink) {
    backLink.href = memberHref;
    backLink.textContent = "← Member";
  }
  if (keepLink) keepLink.href = memberHref;

  if (userId && userId === me.id) {
    AdminCommon.showMessage(message, "You cannot delete your own account from this page.", "error");
    summary.innerHTML = row("Error", "This is the signed-in admin account.");
    return;
  }

  const hasStaff = AdminCommon.profileHasStaffAccess(member);
  const hardDelete = bookingCount === 0 && !hasStaff;
  summary.innerHTML = [
    row("Member ID", member.member_id),
    row("Name", member.full_name),
    row("Username", member.username),
    row("Email", member.email),
    row("Staff code", member.staff_code || "—"),
    row("Status", AdminCommon.statusLabel(member.account_status)),
    row("Reservations on file", String(bookingCount)),
  ].join("");

  if (hasStaff) {
    explain.textContent =
      "This account also has staff access. Removing membership keeps the same Auth login for Admin Sign In. Reservation history stays on file.";
    confirmBtn.textContent = "Remove membership";
  } else if (hardDelete) {
    explain.textContent =
      "This unused account has no reservations. Deleting it permanently removes the Auth user and profile so they cannot sign in.";
    confirmBtn.textContent = "Delete unused account";
  } else {
    explain.textContent =
      "This membership has reservation history. Closing it blocks sign-in and bans the Auth user. Bookings stay on file so admins can still read them.";
    confirmBtn.textContent = "Close membership";
  }

  actions.hidden = false;
  confirmBtn.addEventListener("click", async () => {
    const label = member.full_name || member.email || "this member";
    const prompt = hasStaff
      ? `Remove membership for ${label}? Their staff login stays.`
      : hardDelete
        ? `Permanently delete ${label}? This cannot be undone.`
        : `Close membership for ${label}? They will not be able to sign in. Reservation history stays visible to admins.`;
    const ok = await AdminCommon.confirmAction({
      title: hasStaff ? "Remove membership" : hardDelete ? "Delete member" : "Close membership",
      message: prompt,
      confirmLabel: confirmBtn.textContent,
    });
    if (!ok) return;
    confirmBtn.disabled = true;
    try {
      const result = await Auth.deleteMember(userId);
      const flash =
        result.action === "deleted"
          ? "deleted"
          : result.action === "removed"
            ? "removed"
            : "closed";
      window.location.replace(`admin-members.html?ok=${flash}`);
    } catch (err) {
      AdminCommon.showMessage(message, err.message, "error");
      confirmBtn.disabled = false;
    }
  });
})();
