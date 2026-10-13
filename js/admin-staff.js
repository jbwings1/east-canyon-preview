(async function () {
  const me = await AdminCommon.requireAdmin([
    "create_staff",
    "edit_staff",
    "close_staff",
    "add_staff_access",
    "add_membership",
    "remove_staff_access",
  ]);
  if (!me) return;

  const staffBody = document.getElementById("admin-staff-body");
  const message = document.getElementById("admin-message");
  const statusFilters = document.getElementById("staff-status-filters");
  const STAFF_STATUSES = ["pending_activation", "active", "suspended", "closed"];
  let listedStaff = [];

  function statusBox(value) {
    return statusFilters?.querySelector(`input[data-staff-status="${value}"]`) || null;
  }

  function checkedStatuses() {
    return STAFF_STATUSES.filter((value) => statusBox(value)?.checked);
  }

  function displayedStatus(profile) {
    return AdminCommon.displayedStaffStatus(profile);
  }

  function visibleStaff() {
    const selected = new Set(checkedStatuses());
    if (!selected.size) return [];
    return listedStaff.filter((p) => selected.has(displayedStatus(p)));
  }

  function renderStaff() {
    const selected = checkedStatuses();
    const staff = visibleStaff();
    if (!staff.length) {
      const empty = selected.length ? "There are no staff in that status." : "No status is selected.";
      staffBody.innerHTML = `<tr><td colspan="6">${empty}</td></tr>`;
      return;
    }
    staffBody.innerHTML = staff
      .map((p) => {
        const tasks = AdminCommon.assignmentSummary(p.admin_tasks, p.admin_level, p.staff_code);
        const status = displayedStatus(p);
        const href = AdminCommon.profileEditHref("admin-staff-edit.html", p);
        const safeHref = AdminCommon.escapeHtml(href);
        const rowKey = AdminCommon.profileRowKey(p);
        const code = p.staff_code || "—";
        const memberId = p.member_id || "—";
        const name = p.full_name || p.email || "Staff";
        const email = p.email || "—";
        return `<tr class="admin-row-link" data-profile-id="${AdminCommon.escapeHtml(rowKey)}" data-href="${safeHref}" tabindex="0">
          <td><a href="${safeHref}">${AdminCommon.escapeHtml(code)}</a></td>
          <td class="staff-col-member">${AdminCommon.escapeHtml(memberId)}</td>
          <td><a href="${safeHref}">${AdminCommon.escapeHtml(name)}</a></td>
          <td><a href="${safeHref}">${AdminCommon.escapeHtml(email)}</a></td>
          <td>${AdminCommon.statusPill(status)}</td>
          <td>${AdminCommon.escapeHtml(tasks || "—")}</td>
        </tr>`;
      })
      .join("");
  }

  function showFlash() {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get("ok");
    const flashes = {
      updated: "Staff record updated.",
      membership: "Membership added to this staff account.",
      removed: "Staff access removed. Membership and the same login stay.",
      closed: "Staff account closed. They cannot sign in.",
      deleted: "Staff account permanently deleted.",
    };
    if (ok && flashes[ok]) {
      AdminCommon.showMessage(message, flashes[ok], "success");
    }
  }

  async function load() {
    const profiles = await Auth.listAllProfiles();
    listedStaff = profiles.filter((p) => AdminCommon.isStaffProfile(p));
    renderStaff();
  }

  statusFilters?.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-staff-status]");
    if (!input || !statusFilters.contains(input)) return;
    const value = input.getAttribute("data-staff-status");
    if (value === "all") {
      STAFF_STATUSES.forEach((status) => {
        const box = statusBox(status);
        if (box) box.checked = input.checked;
      });
    } else {
      const all = statusBox("all");
      if (all) all.checked = STAFF_STATUSES.every((status) => statusBox(status)?.checked);
    }
    renderStaff();
  });

  document.getElementById("staff-print-btn")?.addEventListener("click", () => {
    window.print();
  });

  AdminCommon.bindProfileListClicks(staffBody, {
    kind: "staff",
    getProfiles: () => listedStaff,
  });

  const taskList = document.getElementById("staff-task-list");
  const functionList = document.getElementById("staff-function-list");
  const canAssignAdmin = Auth.isTopAdmin(me);
  const canAssignSiteManager = Auth.isAdminCoded(me);
  if (taskList) {
    taskList.innerHTML = AdminCommon.taskCheckboxHtml("staff-task", {
      includeSiteManager: canAssignSiteManager,
      includeAdmin: canAssignAdmin,
    });
  }
  if (functionList) functionList.innerHTML = AdminCommon.functionCheckboxHtml("staff-function");
  const readAssignment = AdminCommon.wireFunctionPicker({
    button: document.getElementById("staff-add-function"),
    fieldset: document.getElementById("staff-function-fieldset"),
    jobName: "staff-task",
    functionName: "staff-function",
    storedTasks: [],
    note: document.getElementById("staff-tasks-note"),
  });
  const canCreate = Auth.hasAdminTask("create_staff");
  const createToggle = document.getElementById("staff-create-toggle");
  const createPanel = document.getElementById("staff-create-panel");

  function setCreateOpen(open) {
    if (createPanel) createPanel.hidden = !open;
    if (createToggle) {
      createToggle.setAttribute("aria-expanded", open ? "true" : "false");
      createToggle.classList.toggle("is-selected", open);
    }
  }

  function resetCreateForm(form) {
    functionList?.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      if (!el.checked) return;
      const wasDisabled = el.disabled;
      el.disabled = false;
      el.checked = false;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.disabled = wasDisabled;
    });
    taskList?.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      if (el.disabled || !el.checked) return;
      el.checked = false;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    form.reset();
    const functionFieldset = document.getElementById("staff-function-fieldset");
    const addFunction = document.getElementById("staff-add-function");
    if (functionFieldset) functionFieldset.hidden = true;
    addFunction?.setAttribute("aria-expanded", "false");
  }

  if (!canCreate) {
    createToggle?.setAttribute("hidden", "");
    createPanel?.setAttribute("hidden", "");
    document.getElementById("staff-create-heading")?.setAttribute("hidden", "");
    document.getElementById("staff-create-help")?.setAttribute("hidden", "");
    document.getElementById("admin-create-staff-form")?.setAttribute("hidden", "");
    document.getElementById("staff-add-function")?.setAttribute("hidden", "");
    document.getElementById("staff-create-close")?.setAttribute("hidden", "");
  } else {
    createToggle?.removeAttribute("hidden");
    setCreateOpen(false);
    createToggle?.addEventListener("click", () => {
      const open = Boolean(createPanel?.hidden);
      setCreateOpen(open);
      if (open) document.getElementById("staff-name")?.focus();
    });
    document.getElementById("staff-create-close")?.addEventListener("click", () => {
      setCreateOpen(false);
      createToggle?.focus();
    });
  }

  document.getElementById("admin-create-staff-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const result = document.getElementById("admin-create-staff-result");
    AdminCommon.showMessage(result, "", "");
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const tasks = readAssignment();
      const created = await Auth.provisionUser({
        kind: "admin",
        full_name: document.getElementById("staff-name").value.trim(),
        email: document.getElementById("staff-email").value.trim(),
        phone: document.getElementById("staff-phone").value.trim(),
        admin_tasks: tasks,
        temporary_password: document.getElementById("staff-temp-password").value,
      });
      AdminCommon.showMessage(
        result,
        `Staff ${created.email} created (${created.staff_code}).`,
        "success"
      );
      resetCreateForm(e.target);
      setCreateOpen(false);
      await load();
    } catch (err) {
      AdminCommon.showMessage(result, err.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  showFlash();
  try {
    await load();
  } catch (err) {
    AdminCommon.showMessage(message, err.message, "error");
  }
})();
