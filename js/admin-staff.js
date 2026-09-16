(async function () {
  const me = await AdminCommon.requireAdmin("staff");
  if (!me) return;

  const staffBody = document.getElementById("admin-staff-body");
  const message = document.getElementById("admin-message");
  let listedStaff = [];

  function renderStaff(staff) {
    if (!staff.length) {
      staffBody.innerHTML = `<tr><td colspan="6">No staff yet.</td></tr>`;
      return;
    }
    staffBody.innerHTML = staff
      .map((p) => {
        const levelSeat =
          p.admin_level != null ? `${p.admin_level}${p.admin_seat || ""}` : "—";
        const tasks = Array.isArray(p.admin_tasks) ? p.admin_tasks.join(", ") : "—";
        const href = AdminCommon.profileEditHref("admin-staff-edit.html", p);
        const safeHref = AdminCommon.escapeHtml(href);
        const rowKey = AdminCommon.profileRowKey(p);
        const code = p.staff_code || "—";
        const memberId = p.member_id || "—";
        const name = p.full_name || p.email || "Staff";
        const email = p.email || "—";
        return `<tr class="admin-row-link" data-profile-id="${AdminCommon.escapeHtml(rowKey)}" data-href="${safeHref}" tabindex="0">
          <td><a href="${safeHref}">${AdminCommon.escapeHtml(code)}</a></td>
          <td>${AdminCommon.escapeHtml(memberId)}</td>
          <td><a href="${safeHref}">${AdminCommon.escapeHtml(name)}</a></td>
          <td><a href="${safeHref}">${AdminCommon.escapeHtml(email)}</a></td>
          <td>${AdminCommon.escapeHtml(levelSeat)}</td>
          <td>${AdminCommon.escapeHtml(p.admin_level === 1 ? "All tasks" : tasks || "—")}</td>
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
    renderStaff(listedStaff);
  }

  AdminCommon.bindProfileListClicks(staffBody, {
    kind: "staff",
    getProfiles: () => listedStaff,
  });

  const taskList = document.getElementById("staff-task-list");
  if (taskList) taskList.innerHTML = AdminCommon.taskCheckboxHtml("staff-task");

  document.getElementById("admin-create-staff-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const result = document.getElementById("admin-create-staff-result");
    AdminCommon.showMessage(result, "", "");
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const tasks = Array.from(
        document.querySelectorAll('input[name="staff-task"]:checked')
      ).map((el) => el.value);
      const created = await Auth.provisionUser({
        kind: "admin",
        full_name: document.getElementById("staff-name").value.trim(),
        email: document.getElementById("staff-email").value.trim(),
        phone: document.getElementById("staff-phone").value.trim(),
        admin_level: Number(document.getElementById("staff-level").value),
        admin_seat: document.getElementById("staff-seat").value.trim().toLowerCase(),
        staff_code: document.getElementById("staff-code").value.trim(),
        admin_tasks: tasks,
        temporary_password: document.getElementById("staff-temp-password").value,
      });
      AdminCommon.showMessage(
        result,
        `Staff ${created.email} created (${created.staff_code}).`,
        "success"
      );
      e.target.reset();
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
