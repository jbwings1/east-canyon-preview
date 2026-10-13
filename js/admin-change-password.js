(async function () {
  const me = await AdminCommon.requireAdmin();
  if (!me) return;
  if (!Auth.needsPasswordChange(me)) {
    window.location.replace("admin.html");
    return;
  }

  const form = document.getElementById("staff-password-form");
  const message = document.getElementById("staff-password-message");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    AdminCommon.showMessage(message, "", "");
    const next = document.getElementById("staff-new-password").value;
    const confirm = document.getElementById("staff-confirm-password").value;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      if (next !== confirm) {
        throw new Error("Passwords do not match.");
      }
      await Auth.updatePassword(next);
      await Auth.refreshProfile();
      window.location.replace("admin.html");
    } catch (err) {
      AdminCommon.showMessage(message, err.message, "error");
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
