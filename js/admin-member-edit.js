(async function () {
  const query = AdminCommon.readProfileQuery();
  const me = await AdminCommon.requireAdmin("members");
  if (!me) return;

  const form = document.getElementById("admin-edit-member-form");
  const result = document.getElementById("admin-edit-member-result");

  if (!query.hasAny) {
    AdminCommon.showMessage(result, "Missing member.", "error");
    return;
  }

  let member = null;
  try {
    const profiles = await Auth.listAllProfiles();
    member = AdminCommon.resolveListedProfile(profiles, query, (p) =>
      AdminCommon.isMemberProfile(p)
    );
  } catch (err) {
    member = query.remembered?.profile || null;
    if (!member) {
      AdminCommon.showMessage(result, err.message, "error");
      return;
    }
  }

  if (!member) {
    AdminCommon.showMessage(result, "Member not found.", "error");
    return;
  }

  const userId = AdminCommon.profileUserId(member);

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

  const title = document.getElementById("member-page-title");
  const summary = document.getElementById("member-page-summary");
  const displayName = member.full_name || member.email || "Member";
  if (title) title.textContent = displayName;
  document.title = `${displayName} | East Canyon Resort`;
  if (summary) {
    const bits = [
      member.member_id ? `Member ID ${member.member_id}` : null,
      member.staff_code ? `Staff ${member.staff_code}` : null,
      AdminCommon.statusLabel(member.account_status),
    ].filter(Boolean);
    summary.textContent =
      bits.join(" · ") +
      ". Change the record below, or close this membership. Password resets stay on the Passwords admin task.";
  }

  const staffPanel = document.getElementById("member-staff-panel");
  const existingStaff = document.getElementById("member-existing-staff");
  const addStaffTasks = document.getElementById("add-staff-task-list");
  if (addStaffTasks) addStaffTasks.innerHTML = AdminCommon.taskCheckboxHtml("add-staff-task");
  if (AdminCommon.profileHasStaffAccess(member)) {
    if (existingStaff) {
      existingStaff.hidden = false;
      existingStaff.innerHTML =
        `This account already has staff access <strong>${AdminCommon.escapeHtml(
          member.staff_code || "assigned"
        )}</strong>. ` +
        `<a href="${AdminCommon.escapeHtml(AdminCommon.profileEditHref("admin-staff-edit.html", member))}">Open staff record</a>.`;
    }
  } else if (Auth.hasAdminTask("account_roles") && staffPanel) {
    staffPanel.hidden = false;
  }

  const closePanel = document.getElementById("member-close-panel");
  const closeLink = document.getElementById("member-close-link");
  if (member.id === me.id) {
    if (closePanel) {
      closePanel.hidden = false;
      closePanel.innerHTML =
        `<h2>Close or delete membership</h2>` +
        `<p class="admin-danger-note">You cannot close or delete your own signed-in account from this page.</p>`;
    }
  } else if (closePanel && closeLink) {
    closeLink.href = AdminCommon.profileEditHref("admin-member-delete.html", member);
    closePanel.hidden = false;
  }

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

  document.getElementById("admin-add-staff-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const addResult = document.getElementById("admin-add-staff-result");
    AdminCommon.showMessage(addResult, "", "");
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const tasks = Array.from(
        document.querySelectorAll('input[name="add-staff-task"]:checked')
      ).map((el) => el.value);
      await Auth.attachStaffAccess({
        userId,
        staffCode: document.getElementById("add-staff-code").value.trim(),
        adminLevel: Number(document.getElementById("add-staff-level").value),
        adminSeat: document.getElementById("add-staff-seat").value.trim().toLowerCase(),
        adminTasks: tasks,
      });
      window.location.replace("admin-members.html?ok=staff");
    } catch (err) {
      AdminCommon.showMessage(addResult, err.message, "error");
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
