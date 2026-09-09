(async function () {
  const me = await AdminCommon.requireAdmin("members");
  if (!me) return;

  const membersBody = document.getElementById("admin-members-body");
  const message = document.getElementById("admin-message");
  let members = [];

  function renderMembers() {
    if (!members.length) {
      membersBody.innerHTML = `<tr><td colspan="7">No members yet.</td></tr>`;
      return;
    }
    membersBody.innerHTML = members
      .map((p) => {
        const status = p.account_status || "active";
        const password = p.must_change_password ? "Temp / change required" : "Set";
        return `<tr>
          <td>${AdminCommon.escapeHtml(p.member_id || "—")}</td>
          <td>${AdminCommon.escapeHtml(p.full_name || "—")}</td>
          <td>${AdminCommon.escapeHtml(p.username || "—")}</td>
          <td>${AdminCommon.escapeHtml(p.email || "—")}</td>
          <td>${AdminCommon.escapeHtml(p.phone || "—")}</td>
          <td>${AdminCommon.escapeHtml(status)}</td>
          <td>${AdminCommon.escapeHtml(password)}</td>
        </tr>`;
      })
      .join("");
  }

  async function load() {
    try {
      const profiles = await Auth.listAllProfiles();
      members = profiles.filter((p) => p.account_kind === "member");
      renderMembers();
    } catch (err) {
      AdminCommon.showMessage(message, err.message, "error");
      membersBody.innerHTML = `<tr><td colspan="7">${AdminCommon.escapeHtml(err.message)}</td></tr>`;
    }
  }

  document.getElementById("admin-create-member-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const result = document.getElementById("admin-create-member-result");
    AdminCommon.showMessage(result, "", "");
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const created = await Auth.provisionUser({
        kind: "member",
        member_id: document.getElementById("member-id-input").value.trim(),
        full_name: document.getElementById("member-name-input").value.trim(),
        email: document.getElementById("member-email-input").value.trim(),
        phone: document.getElementById("member-phone-input").value.trim(),
        address: document.getElementById("member-address-input").value.trim(),
        city: document.getElementById("member-city-input").value.trim(),
        state: document.getElementById("member-state-input").value.trim(),
        zip: document.getElementById("member-zip-input").value.trim(),
        temporary_password: document.getElementById("member-temp-password").value,
      });
      AdminCommon.showMessage(
        result,
        created.message ||
          (created.email_sent
            ? `Created ${created.email} (ID ${created.member_id}). Welcome email sent.`
            : `Created ${created.email} (ID ${created.member_id}). Welcome email was not sent — give them the temporary password.`),
        created.email_sent === false ? "error" : "success"
      );
      e.target.reset();
      await load();
    } catch (err) {
      AdminCommon.showMessage(result, err.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  await load();
})();
