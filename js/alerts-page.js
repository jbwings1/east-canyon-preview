/**
 * Current Alerts page — active alerts with header, details, and photos.
 */
(async function () {
  const root = document.getElementById("alerts-root");
  const status = document.getElementById("alerts-status");
  if (!root) return;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveUrl(url) {
    return window.EcrGalleryUrl ? window.EcrGalleryUrl.resolve(url) : url || "";
  }

  function headerText(alert) {
    return String(alert.header || alert.body || "").trim();
  }

  function detailsText(alert) {
    return String(alert.details || "").trim();
  }

  if (!window.ecrSupabase) {
    if (status) {
      status.hidden = false;
      status.textContent = "Alerts could not be loaded right now.";
    }
    return;
  }

  try {
    const { data, error } = await window.ecrSupabase
      .from("site_alerts")
      .select("id,header,details,body,sort_order,updated_at")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw error;

    const alerts = (data || []).filter(
      (a) => headerText(a) || detailsText(a)
    );
    if (!alerts.length) {
      if (status) {
        status.hidden = false;
        status.textContent = "There are no current alerts.";
      }
      root.innerHTML = "";
      return;
    }

    const ids = alerts.map((a) => a.id);
    const { data: imgs, error: imgErr } = await window.ecrSupabase
      .from("site_alert_images")
      .select("id,alert_id,url,alt,sort_order")
      .in("alert_id", ids)
      .order("sort_order", { ascending: true });
    if (imgErr) throw imgErr;

    const byAlert = new Map();
    (imgs || []).forEach((img) => {
      if (!byAlert.has(img.alert_id)) byAlert.set(img.alert_id, []);
      byAlert.get(img.alert_id).push(img);
    });

    root.innerHTML = `<div class="alerts-page-list">${alerts
      .map((a, i) => {
        const heading = headerText(a) || `Alert ${i + 1}`;
        const details = detailsText(a);
        const photos = byAlert.get(a.id) || [];
        const photoHtml = photos.length
          ? `<div class="alerts-page-photos">${photos
              .map(
                (p) =>
                  `<a href="${escapeHtml(resolveUrl(p.url))}" target="_blank" rel="noopener"><img src="${escapeHtml(resolveUrl(p.url))}" alt="${escapeHtml(p.alt || heading)}" loading="lazy"></a>`
              )
              .join("")}</div>`
          : "";
        const detailsHtml =
          details && details !== heading
            ? `<p>${escapeHtml(details)}</p>`
            : details
              ? `<p>${escapeHtml(details)}</p>`
              : "";
        return `<article class="alerts-page-item">
        <h2 class="alerts-page-heading">${escapeHtml(heading)}</h2>
        ${detailsHtml}
        ${photoHtml}
      </article>`;
      })
      .join("")}</div>`;

    if (status) {
      status.hidden = true;
      status.textContent = "";
    }
  } catch (err) {
    if (status) {
      status.hidden = false;
      status.textContent = "Alerts could not be loaded right now.";
    }
    console.error(err);
  }
})();
