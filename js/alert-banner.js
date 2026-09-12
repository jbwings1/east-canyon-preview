/**
 * Site-wide alert banner — loads active site_alerts headers and rotates every 10s.
 */
(function () {
  const ROTATE_MS = 10000;
  const banner = document.querySelector(".home-alert-banner");
  if (!banner || !window.ecrSupabase) return;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bannerText(alert) {
    return String(alert.header || alert.body || "").trim();
  }

  function render(alerts, index) {
    if (!alerts.length) {
      banner.hidden = true;
      banner.innerHTML = "";
      return;
    }
    banner.hidden = false;
    const alert = alerts[index % alerts.length];
    const label =
      alerts.length > 1
        ? `Alert ${ (index % alerts.length) + 1 } of ${alerts.length}`
        : "Alert";
    banner.setAttribute("aria-label", label);
    banner.innerHTML = `<p>
      <strong>${escapeHtml(label)}</strong>
      ${escapeHtml(bannerText(alert))}
      <a href="alerts.html" class="home-alert-link">Details</a>
    </p>`;
  }

  (async function init() {
    try {
      const { data, error } = await window.ecrSupabase
        .from("site_alerts")
        .select("id,header,body,sort_order,updated_at")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const alerts = (data || []).filter((a) => bannerText(a));
      if (!alerts.length) {
        banner.hidden = true;
        return;
      }
      let index = 0;
      render(alerts, index);
      if (alerts.length > 1) {
        setInterval(() => {
          index = (index + 1) % alerts.length;
          render(alerts, index);
        }, ROTATE_MS);
      }
    } catch (err) {
      console.error("Alert banner:", err);
      // Keep static fallback HTML already in the page.
    }
  })();
})();
