(async function () {
  const query = AdminCommon.readProfileQuery();
  const me = await AdminCommon.requireAdmin("staff");
  if (!me) return;

  const form = document.getElementById("admin-edit-staff-form");
  const result = document.getElementById("admin-edit-staff-result");
  const taskList = document.getElementById("edit-staff-task-list");
  if (taskList) taskList.innerHTML = AdminCommon.taskCheckboxHtml("edit-staff-task");

  const taskBoxes = () =>
    Array.from(document.querySelectorAll('input[name="edit-staff-task"]'));

  function syncTaskAvailability() {
    const level = Number(document.getElementById("edit-staff-level").value);
    const note = document.getElementById("edit-staff-tasks-note");
    const disabled = level === 1;
    taskBoxes().forEach((el) => {
      el.disabled = disabled;
      if (disabled) el.checked = true;
    });
    if (note) {
      note.textContent = disabled
        ? "Level 1 has all tasks."
        : "Assign at least one task. You cannot remove your own Staff task.";
    }
  }

  if (!query.hasAny) {
    AdminCommon.showMessage(result, "Missing staff.", "error");
    return;
  }

  let staff = null;
  let listedProfiles = [];
  try {
    listedProfiles = await Auth.listAllProfiles();
    staff = AdminCommon.resolveListedProfile(listedProfiles, query, (p) =>
      AdminCommon.isStaffProfile(p)
    );
  } catch (err) {
    staff = query.remembered?.profile || null;
    if (!staff) {
      AdminCommon.showMessage(result, err.message, "error");
      return;
    }
  }

  if (!staff) {
    AdminCommon.showMessage(result, "Staff not found.", "error");
    return;
  }

  const userId = AdminCommon.profileUserId(staff);

  document.getElementById("edit-staff-code").value = staff.staff_code || "";
  document.getElementById("edit-staff-name").value = staff.full_name || "";
  document.getElementById("edit-staff-email").value = staff.email || "";
  document.getElementById("edit-staff-phone").value = staff.phone || "";
  document.getElementById("edit-staff-level").value = String(staff.admin_level || 2);
  document.getElementById("edit-staff-seat").value = staff.admin_seat || "";
  document.getElementById("edit-staff-status").value = staff.account_status || "active";

  const assigned = new Set(
    staff.admin_level === 1
      ? AdminCommon.ASSIGNABLE_TASKS.map((t) => t.id).concat("staff")
      : Array.isArray(staff.admin_tasks)
        ? staff.admin_tasks
        : []
  );
  taskBoxes().forEach((el) => {
    el.checked = assigned.has(el.value);
  });
  syncTaskAvailability();
  document.getElementById("edit-staff-level").addEventListener("change", syncTaskAvailability);
  form.hidden = false;

  const title = document.getElementById("staff-page-title");
  const summary = document.getElementById("staff-page-summary");
  const displayName = staff.full_name || staff.staff_code || staff.email || "Staff";
  if (title) title.textContent = displayName;
  document.title = `${displayName} | East Canyon Resort`;
  if (summary) {
    const bits = [
      staff.staff_code ? `Staff code ${staff.staff_code}` : null,
      staff.admin_level != null
        ? `Level ${staff.admin_level}${staff.admin_seat || ""}`
        : null,
      staff.member_id ? `Member ID ${staff.member_id}` : null,
      AdminCommon.statusLabel(staff.account_status),
    ].filter(Boolean);
    summary.textContent =
      bits.join(" · ") +
      ". Change the record below, or use Delete next to account status.";
  }

  const hasMembership = AdminCommon.profileHasMembership(staff);
  const isSelf = Boolean(userId && (userId === me.id || staff.id === me.id));
  const lastLevel1 =
    listedProfiles.length > 0 &&
    Number(staff.admin_level) === 1 &&
    !listedProfiles.some((p) => {
      if (Number(p.admin_level) !== 1) return false;
      if ((p.account_status || "active") !== "active") return false;
      return AdminCommon.profileUserId(p) !== userId;
    });

  const deleteBtn = document.getElementById("staff-delete-btn");
  const deleteNote = document.getElementById("staff-delete-note");
  const closePanel = document.getElementById("staff-close-panel");
  const closeNote = document.getElementById("staff-close-note");
  const deleteBlockedReason = isSelf
    ? "You cannot delete your own signed-in account."
    : lastLevel1
      ? "There must be at least one active level 1 staff account."
      : "";

  if (deleteNote) {
    deleteNote.textContent = deleteBlockedReason
      ? deleteBlockedReason
      : hasMembership
        ? "Closed or suspended on this form can also block member sign-in. Delete removes only staff access (staff code, admin level, and tasks). Membership, member login, and reservations stay."
        : "Closed or suspended blocks staff sign-in. Delete permanently removes this staff record and Auth login. It is not kept as a closed leftover.";
  }

  if (deleteBtn) {
    deleteBtn.disabled = Boolean(deleteBlockedReason);
    if (deleteBlockedReason) {
      deleteBtn.setAttribute("aria-disabled", "true");
      deleteBtn.title = deleteBlockedReason;
    }
  }

  if (deleteBlockedReason) {
    AdminCommon.showMessage(result, deleteBlockedReason, "error");
    if (closePanel) {
      closePanel.hidden = false;
      if (closeNote) closeNote.textContent = deleteBlockedReason;
    }
  } else if (closePanel) {
    closePanel.hidden = true;
  }

  async function deleteStaffAccount() {
    if (deleteBlockedReason) {
      AdminCommon.showMessage(result, deleteBlockedReason, "error");
      return;
    }
    const label = staff.full_name || staff.staff_code || staff.email || "this staff account";
    const codeBit = staff.staff_code ? ` (${staff.staff_code})` : "";
    const ok = await AdminCommon.confirmAction({
      title: hasMembership ? "Delete staff access" : "Delete staff",
      message: hasMembership
        ? `Delete staff access for ${label}${codeBit}?\n\nThis removes only the staff part (staff code, admin level, tasks, and admin sign-in). Membership ${staff.member_id || ""}, the member login, and reservations stay. The Auth account is not deleted.`
        : `Permanently delete ${label}${codeBit}?\n\nThis removes the staff record and their Auth login. They will not be kept as a closed leftover. This cannot be undone.`,
      confirmLabel: hasMembership ? "Delete staff access" : "Delete staff",
    });
    if (!ok) return;
    if (deleteBtn) deleteBtn.disabled = true;
    AdminCommon.showMessage(result, "", "");
    try {
      const deleted = await Auth.deleteStaff(userId);
      const flash =
        deleted.action === "removed"
          ? "removed"
          : deleted.action === "deleted"
            ? "deleted"
            : "deleted";
      window.location.replace(`admin-staff.html?ok=${flash}`);
    } catch (err) {
      AdminCommon.showMessage(result, err.message, "error");
      if (deleteBtn && !deleteBlockedReason) deleteBtn.disabled = false;
    }
  }

  deleteBtn?.addEventListener("click", () => {
    deleteStaffAccount();
  });

  const membershipPanel = document.getElementById("staff-membership-panel");
  const existingMembership = document.getElementById("staff-existing-membership");
  const canAttachRoles = Auth.hasAdminTask("account_roles");
  if (AdminCommon.profileHasMembership(staff)) {
    if (existingMembership) {
      existingMembership.hidden = false;
      existingMembership.innerHTML =
        `This account already has membership <strong>${AdminCommon.escapeHtml(
          staff.member_id
        )}</strong>. ` +
          `<a href="${AdminCommon.escapeHtml(AdminCommon.profileEditHref("admin-member-edit.html", staff))}">Open member record</a>.`;
    }
  } else if (canAttachRoles && membershipPanel) {
    membershipPanel.hidden = false;
    document.getElementById("add-member-name").value = staff.full_name || "";
    document.getElementById("add-member-phone").value = staff.phone || "";
    document.getElementById("add-member-address").value = staff.address || "";
    document.getElementById("add-member-city").value = staff.city || "";
    document.getElementById("add-member-state").value = staff.state || "";
    document.getElementById("add-member-zip").value = staff.zip || "";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    AdminCommon.showMessage(result, "", "");
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const level = Number(document.getElementById("edit-staff-level").value);
      const tasks = taskBoxes()
        .filter((el) => el.checked || level === 1)
        .map((el) => el.value);
      await Auth.updateStaff({
        user_id: userId,
        staff_code: document.getElementById("edit-staff-code").value.trim(),
        full_name: document.getElementById("edit-staff-name").value.trim(),
        email: document.getElementById("edit-staff-email").value.trim(),
        phone: document.getElementById("edit-staff-phone").value.trim(),
        admin_level: level,
        admin_seat: document.getElementById("edit-staff-seat").value.trim().toLowerCase(),
        admin_tasks: tasks,
        account_status: document.getElementById("edit-staff-status").value,
      });
      window.location.replace("admin-staff.html?ok=updated");
    } catch (err) {
      AdminCommon.showMessage(result, err.message, "error");
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.getElementById("admin-add-membership-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const addResult = document.getElementById("admin-add-membership-result");
    AdminCommon.showMessage(addResult, "", "");
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      await Auth.attachMembership({
        userId,
        memberId: document.getElementById("add-member-id").value.trim(),
        reservationType: document.getElementById("add-member-reservation-type").value,
        fullName: document.getElementById("add-member-name").value.trim(),
        phone: document.getElementById("add-member-phone").value.trim(),
        address: document.getElementById("add-member-address").value.trim(),
        city: document.getElementById("add-member-city").value.trim(),
        state: document.getElementById("add-member-state").value.trim(),
        zip: document.getElementById("add-member-zip").value.trim(),
      });
      window.location.replace("admin-staff.html?ok=membership");
    } catch (err) {
      AdminCommon.showMessage(addResult, err.message, "error");
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
