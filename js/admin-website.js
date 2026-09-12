/**
 * Admin Website — manage site alerts (header + details + photos).
 */
(async function () {
  const me = await AdminCommon.requireAdmin("website");
  if (!me) return;

  const result = document.getElementById("admin-alert-result");
  const form = document.getElementById("admin-alert-form");
  const listEl = document.getElementById("admin-alert-list");
  const listStatus = document.getElementById("admin-alert-list-status");

  let alerts = [];
  let imagesByAlert = new Map();

  function escapeHtml(value) {
    return AdminCommon.escapeHtml(value);
  }

  function resolveUrl(url) {
    return window.EcrGalleryUrl ? window.EcrGalleryUrl.resolve(url) : url || "";
  }

  function safeFileName(name) {
    return String(name || "photo")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
  }

  function alertImages(alertId) {
    return imagesByAlert.get(alertId) || [];
  }

  function renderList() {
    if (!listEl) return;
    if (!alerts.length) {
      listEl.innerHTML = '<p class="admin-help">No alerts yet. Add one above.</p>';
      listStatus.textContent = "0 alerts";
      return;
    }
    listEl.innerHTML = alerts
      .map((alert, index) => {
        const header = escapeHtml(alert.header || "");
        const details = escapeHtml(alert.details || "");
        const active = alert.active !== false;
        const photos = alertImages(alert.id)
          .map(
            (img) => `<figure class="admin-alert-photo" data-image-id="${img.id}">
              <img src="${escapeHtml(resolveUrl(img.url))}" alt="${escapeHtml(img.alt || "Alert photo")}" loading="lazy">
              <button type="button" class="btn-link alert-photo-delete">Remove photo</button>
            </figure>`
          )
          .join("");
        return `<article class="admin-alert-item" data-id="${alert.id}">
          <label class="admin-gallery-field">
            <span>Banner header (max 50 characters)</span>
            <input type="text" class="alert-header-input" value="${header}" maxlength="50" required>
          </label>
          <label class="admin-gallery-field">
            <span>Details (Alerts page)</span>
            <textarea class="alert-details-input" rows="4">${details}</textarea>
          </label>
          <label class="admin-check">
            <input type="checkbox" class="alert-active-input"${active ? " checked" : ""}>
            Show on site banner
          </label>
          <div class="admin-alert-photos">
            ${photos || '<p class="admin-help">No photos yet.</p>'}
          </div>
          <label class="admin-gallery-field">
            <span>Add photo</span>
            <input type="file" class="alert-photo-input" accept="image/jpeg,image/png,image/webp,image/gif">
          </label>
          <div class="admin-actions">
            <button type="button" class="btn-link alert-move-up"${
              index === 0 ? " disabled" : ""
            }>Up</button>
            <button type="button" class="btn-link alert-move-down"${
              index === alerts.length - 1 ? " disabled" : ""
            }>Down</button>
            <button type="button" class="btn-link alert-save">Save</button>
            <button type="button" class="btn-link alert-delete">Delete</button>
          </div>
        </article>`;
      })
      .join("");
    const activeCount = alerts.filter((a) => a.active !== false).length;
    listStatus.textContent = `${alerts.length} alert${alerts.length === 1 ? "" : "s"} (${activeCount} active on banner)`;
    listStatus.className = "form-message";
  }

  async function loadAlerts() {
    listStatus.textContent = "Loading…";
    const { data, error } = await window.ecrSupabase
      .from("site_alerts")
      .select("id,header,details,body,active,sort_order,updated_at,created_at")
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    alerts = data || [];

    const ids = alerts.map((a) => a.id);
    imagesByAlert = new Map();
    if (ids.length) {
      const { data: imgs, error: imgErr } = await window.ecrSupabase
        .from("site_alert_images")
        .select("id,alert_id,url,storage_path,alt,sort_order")
        .in("alert_id", ids)
        .order("sort_order", { ascending: true });
      if (imgErr) throw imgErr;
      (imgs || []).forEach((img) => {
        if (!imagesByAlert.has(img.alert_id)) imagesByAlert.set(img.alert_id, []);
        imagesByAlert.get(img.alert_id).push(img);
      });
    }
    renderList();
  }

  async function nextSortOrder() {
    if (!alerts.length) return 0;
    return Math.max(...alerts.map((a) => a.sort_order || 0)) + 1;
  }

  async function nextImageSortOrder(alertId) {
    const imgs = alertImages(alertId);
    if (!imgs.length) return 0;
    return Math.max(...imgs.map((i) => i.sort_order || 0)) + 1;
  }

  async function uploadAlertPhoto(file) {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Image must be 10 MB or smaller.");
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const storagePath = `${Date.now()}-${safeFileName(
      file.name.replace(/\.[^.]+$/, "")
    )}.${ext}`;
    const { error: upErr } = await window.ecrSupabase.storage
      .from("alert-images")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
    if (upErr) throw upErr;
    const { data: pub } = window.ecrSupabase.storage
      .from("alert-images")
      .getPublicUrl(storagePath);
    const url = pub?.publicUrl;
    if (!url) {
      await window.ecrSupabase.storage.from("alert-images").remove([storagePath]);
      throw new Error("Could not get public URL for uploaded image.");
    }
    return { url, storagePath };
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    AdminCommon.showMessage(result, "", "");
    try {
      const header = document.getElementById("alert-header").value.trim();
      if (!header) {
        AdminCommon.showMessage(result, "Enter a banner header.", "error");
        return;
      }
      if (header.length > 50) {
        AdminCommon.showMessage(result, "Header must be 50 characters or fewer.", "error");
        return;
      }
      const details = document.getElementById("alert-details").value.trim();
      const payload = {
        header,
        details,
        body: header,
        active: document.getElementById("alert-active").checked,
        sort_order: await nextSortOrder(),
        updated_by: me.id,
        updated_at: new Date().toISOString(),
      };
      const { data: inserted, error } = await window.ecrSupabase
        .from("site_alerts")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      const file = document.getElementById("alert-photo")?.files?.[0];
      if (file && inserted?.id) {
        const uploaded = await uploadAlertPhoto(file);
        const { error: imgErr } = await window.ecrSupabase.from("site_alert_images").insert({
          alert_id: inserted.id,
          url: uploaded.url,
          storage_path: uploaded.storagePath,
          alt: "Alert photo",
          sort_order: 0,
        });
        if (imgErr) {
          await window.ecrSupabase.storage
            .from("alert-images")
            .remove([uploaded.storagePath]);
          throw imgErr;
        }
      }

      form.reset();
      document.getElementById("alert-active").checked = true;
      AdminCommon.showMessage(
        result,
        "Alert added. Banner shows the short header; Details page shows the full text and photos.",
        "success"
      );
      await loadAlerts();
    } catch (err) {
      AdminCommon.showMessage(result, err.message || String(err), "error");
    }
  });

  listEl?.addEventListener("change", async (e) => {
    const input = e.target.closest(".alert-photo-input");
    if (!input || !input.files?.[0]) return;
    const card = input.closest(".admin-alert-item");
    if (!card) return;
    const id = card.dataset.id;
    try {
      const uploaded = await uploadAlertPhoto(input.files[0]);
      const { error } = await window.ecrSupabase.from("site_alert_images").insert({
        alert_id: id,
        url: uploaded.url,
        storage_path: uploaded.storagePath,
        alt: "Alert photo",
        sort_order: await nextImageSortOrder(id),
      });
      if (error) {
        await window.ecrSupabase.storage
          .from("alert-images")
          .remove([uploaded.storagePath]);
        throw error;
      }
      AdminCommon.showMessage(listStatus, "Photo added.", "success");
      await loadAlerts();
    } catch (err) {
      AdminCommon.showMessage(listStatus, err.message || String(err), "error");
      input.value = "";
    }
  });

  listEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const photoFig = btn.closest(".admin-alert-photo");
    if (btn.classList.contains("alert-photo-delete") && photoFig) {
      const imageId = photoFig.dataset.imageId;
      const card = btn.closest(".admin-alert-item");
      const alertId = card?.dataset.id;
      const img = alertImages(alertId).find((i) => i.id === imageId);
      if (!img) return;
      try {
        if (!confirm("Remove this photo from the alert?")) return;
        const { error } = await window.ecrSupabase
          .from("site_alert_images")
          .delete()
          .eq("id", imageId);
        if (error) throw error;
        if (img.storage_path) {
          await window.ecrSupabase.storage
            .from("alert-images")
            .remove([img.storage_path]);
        }
        await loadAlerts();
      } catch (err) {
        AdminCommon.showMessage(listStatus, err.message || String(err), "error");
      }
      return;
    }

    const card = btn.closest(".admin-alert-item");
    if (!card) return;
    const id = card.dataset.id;
    const row = alerts.find((a) => a.id === id);
    if (!row) return;

    try {
      if (btn.classList.contains("alert-delete")) {
        if (!confirm("Delete this alert and its photos?")) return;
        const imgs = alertImages(id);
        const { error } = await window.ecrSupabase.from("site_alerts").delete().eq("id", id);
        if (error) throw error;
        const paths = imgs.map((i) => i.storage_path).filter(Boolean);
        if (paths.length) {
          await window.ecrSupabase.storage.from("alert-images").remove(paths);
        }
        await loadAlerts();
        return;
      }

      if (btn.classList.contains("alert-save")) {
        const header = card.querySelector(".alert-header-input")?.value.trim() || "";
        if (!header) {
          AdminCommon.showMessage(listStatus, "Header cannot be empty.", "error");
          return;
        }
        if (header.length > 50) {
          AdminCommon.showMessage(listStatus, "Header must be 50 characters or fewer.", "error");
          return;
        }
        const details = card.querySelector(".alert-details-input")?.value.trim() || "";
        const active = !!card.querySelector(".alert-active-input")?.checked;
        const { error } = await window.ecrSupabase
          .from("site_alerts")
          .update({
            header,
            details,
            body: header,
            active,
            updated_by: me.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) throw error;
        AdminCommon.showMessage(listStatus, "Alert saved.", "success");
        await loadAlerts();
        return;
      }

      if (btn.classList.contains("alert-move-up") || btn.classList.contains("alert-move-down")) {
        const index = alerts.findIndex((a) => a.id === id);
        const swapWith =
          btn.classList.contains("alert-move-up")
            ? alerts[index - 1]
            : alerts[index + 1];
        if (!swapWith) return;
        const aOrder = row.sort_order;
        const bOrder = swapWith.sort_order;
        const { error: e1 } = await window.ecrSupabase
          .from("site_alerts")
          .update({ sort_order: bOrder })
          .eq("id", row.id);
        if (e1) throw e1;
        const { error: e2 } = await window.ecrSupabase
          .from("site_alerts")
          .update({ sort_order: aOrder })
          .eq("id", swapWith.id);
        if (e2) throw e2;
        await loadAlerts();
      }
    } catch (err) {
      AdminCommon.showMessage(listStatus, err.message || String(err), "error");
    }
  });

  try {
    await loadAlerts();
  } catch (err) {
    AdminCommon.showMessage(listStatus, err.message || String(err), "error");
  }
})();
