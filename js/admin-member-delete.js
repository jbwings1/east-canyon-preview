(async function () {
  const me = await AdminCommon.requireAdmin("members");
  if (!me) return;

  const summary = document.getElementById("delete-summary");
  const explain = document.getElementById("delete-explain");
  const message = document.getElementById("delete-message");
  const actions = document.getElementById("delete-actions");
  const confirmBtn = document.getElementById("confirm-delete-btn");
  const userId = new URLSearchParams(window.location.search).get("id");

  function row(label, value) {
    return `<div><dt>${AdminCommon.escapeHtml(label)}</dt><dd>${AdminCommon.escapeHtml(value || "—")}</dd></div>`;
  }

  if (!userId) {
    AdminCommon.showMessage(message, "Missing member.", "error");
    summary.innerHTML = row("Error", "No member selected.");
    return;
  }

  if (userId === me.id) {
    AdminCommon.showMessage(message, "You cannot delete your own account from this page.", "error");
    summary.innerHTML = row("Error", "This is the signed-in admin account.");
    return;
  }

  let member = null;
  let bookingCount = 0;
  try {
    const [profiles, bookings] = await Promise.all([
      Auth.listMemberProfiles(),
      Auth.listAllBookings(),
    ]);
    member = profiles.find((p) => p.id === userId) || null;
    bookingCount = (bookings || []).filter((b) => b.user_id === userId).length;
  } catch (err) {
    AdminCommon.showMessage(message, err.message, "error");
    summary.innerHTML = row("Error", err.message);
    return;
  }

  if (!member) {
    AdminCommon.showMessage(message, "Member not found.", "error");
    summary.innerHTML = row("Error", "That member is not on the list.");
    return;
  }

  const hardDelete = bookingCount === 0;
  summary.innerHTML = [
    row("Member ID", member.member_id),
    row("Name", member.full_name),
    row("Username", member.username),
    row("Email", member.email),
    row("Status", AdminCommon.statusLabel(member.account_status)),
    row("Reservations on file", String(bookingCount)),
  ].join("");

  if (hardDelete) {
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
    const prompt = hardDelete
      ? `Permanently delete ${member.full_name || member.email || "this unused account"}? This cannot be undone.`
      : `Close membership for ${member.full_name || member.email || "this member"}? They will not be able to sign in. Reservation history stays visible to admins.`;
    if (!window.confirm(prompt)) return;
    confirmBtn.disabled = true;
    try {
      const result = await Auth.deleteMember(userId);
      const ok = result.action === "deleted" ? "deleted" : "closed";
      window.location.replace(`admin-members.html?ok=${ok}`);
    } catch (err) {
      AdminCommon.showMessage(message, err.message, "error");
      confirmBtn.disabled = false;
    }
  });
})();
