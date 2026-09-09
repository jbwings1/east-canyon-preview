(async function () {
  const me = await AdminCommon.requireAdmin("passwords");
  if (!me) return;

  const select = document.getElementById("password-member");
  const message = document.getElementById("admin-message");

  async function loadMembers() {
    const profiles = await Auth.listAllProfiles();
    const members = profiles.filter(
      (p) => p.account_kind === "member" && p.account_status !== "closed"
    );
    select.innerHTML = `<option value="">Select member…</option>`;
    members.forEach((m) => {
      const option = document.createElement("option");
      option.value = m.id;
      option.textContent = `${m.full_name || m.email}${m.member_id ? ` · ${m.member_id}` : ""}`;
      select.appendChild(option);
    });
  }

  document.getElementById("admin-reset-password-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const result = document.getElementById("admin-reset-password-result");
    AdminCommon.showMessage(result, "", "");
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const created = await Auth.provisionUser({
        kind: "reset_password",
        user_id: document.getElementById("password-member").value,
        temporary_password: document.getElementById("password-temp").value,
      });
      AdminCommon.showMessage(
        result,
        `Temporary password set for ${created.email}. Member must change it after sign-in.`,
        "success"
      );
      e.target.reset();
      await loadMembers();
    } catch (err) {
      AdminCommon.showMessage(result, err.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  try {
    await loadMembers();
  } catch (err) {
    AdminCommon.showMessage(message, err.message, "error");
  }
})();
