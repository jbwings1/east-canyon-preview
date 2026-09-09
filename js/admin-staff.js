(async function () {
  const me = await AdminCommon.requireAdmin("staff");
  if (!me) return;

  const staffBody = document.getElementById("admin-staff-body");
  const message = document.getElementById("admin-message");

  function renderStaff(staff) {
    if (!staff.length) {
      staffBody.innerHTML = `<tr><td colspan="5">No staff yet.</td></tr>`;
      return;
    }
    staffBody.innerHTML = staff
      .map((p) => {
        const levelSeat =
          p.admin_level != null ? `${p.admin_level}${p.admin_seat || ""}` : "—";
        const tasks = Array.isArray(p.admin_tasks) ? p.admin_tasks.join(", ") : "—";
        return `<tr>
          <td>${AdminCommon.escapeHtml(p.staff_code || "—")}</td>
          <td>${AdminCommon.escapeHtml(p.full_name || "—")}</td>
          <td>${AdminCommon.escapeHtml(p.email || "—")}</td>
          <td>${AdminCommon.escapeHtml(levelSeat)}</td>
          <td>${AdminCommon.escapeHtml(p.admin_level === 1 ? "All tasks" : tasks || "—")}</td>
        </tr>`;
      })
      .join("");
  }

  async function load() {
    const profiles = await Auth.listAllProfiles();
    renderStaff(profiles.filter((p) => p.account_kind === "admin"));
  }

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

  try {
    await load();
  } catch (err) {
    AdminCommon.showMessage(message, err.message, "error");
  }
})();
