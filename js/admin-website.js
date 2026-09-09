(async function () {
  const me = await AdminCommon.requireAdmin("website");
  if (!me) return;

  const result = document.getElementById("admin-alert-result");
  const form = document.getElementById("admin-alert-form");

  async function loadAlert() {
    const { data, error } = await window.ecrSupabase
      .from("site_alerts")
      .select("id,body,active")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const alert = data?.[0];
    if (!alert) return;
    document.getElementById("alert-body").value = alert.body || "";
    document.getElementById("alert-active").checked = alert.active !== false;
    form.dataset.alertId = alert.id;
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    AdminCommon.showMessage(result, "", "");
    try {
      const id = form.dataset.alertId;
      const payload = {
        body: document.getElementById("alert-body").value.trim(),
        active: document.getElementById("alert-active").checked,
        updated_by: me.id,
        updated_at: new Date().toISOString(),
      };
      let error;
      if (id) {
        ({ error } = await window.ecrSupabase.from("site_alerts").update(payload).eq("id", id));
      } else {
        ({ error } = await window.ecrSupabase.from("site_alerts").insert(payload));
      }
      if (error) throw error;
      AdminCommon.showMessage(
        result,
        "Alert saved. (Static banners on pages still need a later wire-up to this table.)",
        "success"
      );
      await loadAlert();
    } catch (err) {
      AdminCommon.showMessage(result, err.message || String(err), "error");
    }
  });

  try {
    await loadAlert();
  } catch (err) {
    AdminCommon.showMessage(result, err.message, "error");
  }
})();
