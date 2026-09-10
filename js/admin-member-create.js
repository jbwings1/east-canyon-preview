(async function () {
  const me = await AdminCommon.requireAdmin("members");
  if (!me) return;

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
      const detail =
        created.message ||
        (created.email_sent
          ? `Created ${created.email} (ID ${created.member_id}). Welcome email sent.`
          : `Created ${created.email} (ID ${created.member_id}). Welcome email was not sent — give them the temporary password.`);
      window.location.replace(
        `admin-members.html?ok=created&notice=${encodeURIComponent(detail)}`
      );
    } catch (err) {
      AdminCommon.showMessage(result, err.message, "error");
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
