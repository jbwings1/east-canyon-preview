/**
 * Admin Pictures — list, upload, reorder, edit, delete gallery images.
 * Requires website admin task (same as Website alert tool).
 */
(async function () {
  const SECTIONS = [
    "Around the resort",
    "Canyons and seasons",
    "Lodging, courts, and events",
    "From eastcanyon.com",
    "From live-site documents",
  ];

  const me = await AdminCommon.requireAdmin("website");
  if (!me) return;

  const uploadForm = document.getElementById("admin-gallery-upload-form");
  const uploadResult = document.getElementById("admin-gallery-upload-result");
  const listStatus = document.getElementById("admin-gallery-list-status");
  const sectionsEl = document.getElementById("admin-gallery-sections");
  const sectionSelect = document.getElementById("gallery-section");

  sectionSelect.innerHTML = SECTIONS.map(
    (s) => `<option value="${AdminCommon.escapeHtml(s)}">${AdminCommon.escapeHtml(s)}</option>`
  ).join("");

  let rows = [];

  function sectionOptions(selected) {
    return SECTIONS.map(
      (s) =>
        `<option value="${AdminCommon.escapeHtml(s)}"${
          s === selected ? " selected" : ""
        }>${AdminCommon.escapeHtml(s)}</option>`
    ).join("");
  }

  function render() {
    const bySection = new Map();
    SECTIONS.forEach((s) => bySection.set(s, []));
    rows.forEach((row) => {
      if (!bySection.has(row.section)) bySection.set(row.section, []);
      bySection.get(row.section).push(row);
    });

    const blocks = [];
    bySection.forEach((items, section) => {
      if (!items.length && !SECTIONS.includes(section)) return;
      const cards = items
        .map((item, index) => {
          const src = AdminCommon.escapeHtml(item.url);
          const alt = AdminCommon.escapeHtml(item.alt || "");
          return `<article class="admin-gallery-item" data-id="${item.id}">
            <img src="${src}" alt="${alt}" loading="lazy">
            <div class="admin-gallery-item-body">
              <label class="admin-gallery-field">
                <span>Alt</span>
                <input type="text" class="gallery-alt-input" value="${alt}" maxlength="200">
              </label>
              <label class="admin-gallery-field">
                <span>Section</span>
                <select class="gallery-section-input">${sectionOptions(item.section)}</select>
              </label>
              <div class="admin-actions">
                <button type="button" class="btn-link gallery-move-up" ${
                  index === 0 ? "disabled" : ""
                }>Up</button>
                <button type="button" class="btn-link gallery-move-down" ${
                  index === items.length - 1 ? "disabled" : ""
                }>Down</button>
                <button type="button" class="btn-link gallery-save">Save</button>
                <button type="button" class="btn-link gallery-delete">Delete</button>
              </div>
            </div>
          </article>`;
        })
        .join("");

      blocks.push(`<div class="admin-gallery-section">
        <h3 class="admin-subhead">${AdminCommon.escapeHtml(section)}
          <span class="admin-gallery-count">(${items.length})</span>
        </h3>
        <div class="admin-gallery-grid">${cards || "<p class=\"admin-help\">No images in this section.</p>"}</div>
      </div>`);
    });

    sectionsEl.innerHTML = blocks.join("");
    listStatus.textContent = `${rows.length} image${rows.length === 1 ? "" : "s"}`;
    listStatus.className = "form-message";
  }

  async function load() {
    listStatus.textContent = "Loading…";
    listStatus.className = "form-message";
    const { data, error } = await window.ecrSupabase
      .from("gallery_images")
      .select("id,section,url,storage_path,alt,sort_order,created_at")
      .order("section", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    rows = data || [];
    render();
  }

  async function nextSortOrder(section) {
    const inSection = rows.filter((r) => r.section === section);
    if (!inSection.length) return 0;
    return Math.max(...inSection.map((r) => r.sort_order || 0)) + 1;
  }

  function safeFileName(name) {
    return String(name || "image")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
  }

  uploadForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    AdminCommon.showMessage(uploadResult, "", "");
    const fileInput = document.getElementById("gallery-file");
    const file = fileInput?.files?.[0];
    if (!file) {
      AdminCommon.showMessage(uploadResult, "Choose an image file.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      AdminCommon.showMessage(uploadResult, "Image must be 10 MB or smaller.", "error");
      return;
    }

    const section = sectionSelect.value;
    const alt =
      document.getElementById("gallery-alt").value.trim() || "East Canyon Resort";
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const storagePath = `${Date.now()}-${safeFileName(file.name.replace(/\.[^.]+$/, ""))}.${ext}`;

    try {
      const { error: upErr } = await window.ecrSupabase.storage
        .from("gallery")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });
      if (upErr) throw upErr;

      const { data: pub } = window.ecrSupabase.storage
        .from("gallery")
        .getPublicUrl(storagePath);
      const url = pub?.publicUrl;
      if (!url) throw new Error("Could not get public URL for uploaded image.");

      const sort_order = await nextSortOrder(section);
      const { error: insErr } = await window.ecrSupabase.from("gallery_images").insert({
        section,
        url,
        storage_path: storagePath,
        alt,
        sort_order,
      });
      if (insErr) {
        await window.ecrSupabase.storage.from("gallery").remove([storagePath]);
        throw insErr;
      }

      uploadForm.reset();
      document.getElementById("gallery-alt").value = "East Canyon Resort";
      sectionSelect.value = section;
      AdminCommon.showMessage(uploadResult, "Image uploaded.", "success");
      await load();
    } catch (err) {
      AdminCommon.showMessage(uploadResult, err.message || String(err), "error");
    }
  });

  sectionsEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const card = btn.closest(".admin-gallery-item");
    if (!card) return;
    const id = card.dataset.id;
    const row = rows.find((r) => r.id === id);
    if (!row) return;

    try {
      if (btn.classList.contains("gallery-delete")) {
        if (!confirm("Delete this image from the Pictures page?")) return;
        if (row.storage_path) {
          const { error: remErr } = await window.ecrSupabase.storage
            .from("gallery")
            .remove([row.storage_path]);
          if (remErr) throw remErr;
        }
        const { error } = await window.ecrSupabase
          .from("gallery_images")
          .delete()
          .eq("id", id);
        if (error) throw error;
        await load();
        return;
      }

      if (btn.classList.contains("gallery-save")) {
        const alt =
          card.querySelector(".gallery-alt-input")?.value.trim() ||
          "East Canyon Resort";
        const section = card.querySelector(".gallery-section-input")?.value;
        const payload = { alt, section };
        if (section !== row.section) {
          payload.sort_order = await nextSortOrder(section);
        }
        const { error } = await window.ecrSupabase
          .from("gallery_images")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
        await load();
        AdminCommon.showMessage(listStatus, "Saved.", "success");
        return;
      }

      if (
        btn.classList.contains("gallery-move-up") ||
        btn.classList.contains("gallery-move-down")
      ) {
        const siblings = rows
          .filter((r) => r.section === row.section)
          .sort((a, b) => a.sort_order - b.sort_order);
        const index = siblings.findIndex((r) => r.id === id);
        const swapWith =
          btn.classList.contains("gallery-move-up")
            ? siblings[index - 1]
            : siblings[index + 1];
        if (!swapWith) return;
        const aOrder = row.sort_order;
        const bOrder = swapWith.sort_order;
        const { error: e1 } = await window.ecrSupabase
          .from("gallery_images")
          .update({ sort_order: bOrder })
          .eq("id", row.id);
        if (e1) throw e1;
        const { error: e2 } = await window.ecrSupabase
          .from("gallery_images")
          .update({ sort_order: aOrder })
          .eq("id", swapWith.id);
        if (e2) throw e2;
        await load();
      }
    } catch (err) {
      AdminCommon.showMessage(listStatus, err.message || String(err), "error");
    }
  });

  try {
    await load();
  } catch (err) {
    AdminCommon.showMessage(listStatus, err.message || String(err), "error");
  }
})();
