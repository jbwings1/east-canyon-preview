(async function () {
  const me = await AdminCommon.requireAdmin("members");
  if (!me) return;

  const form = document.getElementById("admin-edit-member-form");
  const result = document.getElementById("admin-edit-member-result");
  const userId = new URLSearchParams(window.location.search).get("id");

  if (!userId) {
    AdminCommon.showMessage(result, "Missing member.", "error");
    return;
  }

  let member = null;
  try {
    const profiles = await Auth.listMemberProfiles();
    member = profiles.find((p) => p.id === userId) || null;
  } catch (err) {
    AdminCommon.showMessage(result, err.message, "error");
    return;
  }

  if (!member) {
    AdminCommon.showMessage(result, "Member not found.", "error");
    return;
  }

  document.getElementById("edit-member-id").value = member.member_id || "";
  document.getElementById("edit-full-name").value = member.full_name || "";
  document.getElementById("edit-email").value = member.email || "";
  document.getElementById("edit-username").value = member.username || "";
  document.getElementById("edit-phone").value = member.phone || "";
  document.getElementById("edit-address").value = member.address || "";
  document.getElementById("edit-city").value = member.city || "";
  document.getElementById("edit-state").value = member.state || "";
  document.getElementById("edit-zip").value = member.zip || "";
  document.getElementById("edit-status").value = member.account_status || "active";
  form.hidden = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    AdminCommon.showMessage(result, "", "");
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const username = document.getElementById("edit-username").value.trim();
      if (username && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,29}$/.test(username)) {
        throw new Error(
          "Username must be 3–30 characters and use only letters, numbers, underscore, or hyphen."
        );
      }
      await Auth.updateMember({
        user_id: userId,
        member_id: document.getElementById("edit-member-id").value.trim(),
        full_name: document.getElementById("edit-full-name").value.trim(),
        email: document.getElementById("edit-email").value.trim(),
        username,
        phone: document.getElementById("edit-phone").value.trim(),
        address: document.getElementById("edit-address").value.trim(),
        city: document.getElementById("edit-city").value.trim(),
        state: document.getElementById("edit-state").value.trim(),
        zip: document.getElementById("edit-zip").value.trim(),
        account_status: document.getElementById("edit-status").value,
      });
      window.location.replace("admin-members.html?ok=updated");
    } catch (err) {
      AdminCommon.showMessage(result, err.message, "error");
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
