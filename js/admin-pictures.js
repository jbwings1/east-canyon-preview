/**
 * Admin Pictures — sections + gallery images.
 * Requires website admin task (same as Website alert tool).
 */
(async function () {
  const me = await AdminCommon.requireAdmin("website");
  if (!me) return;

  const uploadForm = document.getElementById("admin-gallery-upload-form");
  const uploadResult = document.getElementById("admin-gallery-upload-result");
  const listStatus = document.getElementById("admin-gallery-list-status");
  const sectionsEl = document.getElementById("admin-gallery-sections");
  const sectionSelect = document.getElementById("gallery-section");
  const sectionForm = document.getElementById("admin-gallery-section-form");
  const sectionResult = document.getElementById("admin-gallery-section-result");
  const sectionListEl = document.getElementById("admin-gallery-section-list");

  let sections = [];
  let rows = [];

  function sectionNames() {
    return sections.map((s) => s.name);
  }

  function fillSectionSelect(selected) {
    const names = sectionNames();
    const value = selected && names.includes(selected) ? selected : names[0] || "";
    sectionSelect.innerHTML = names
      .map(
        (s) =>
          `<option value="${AdminCommon.escapeHtml(s)}"${
            s === value ? " selected" : ""
          }>${AdminCommon.escapeHtml(s)}</option>`
      )
      .join("");
  }

  function sectionOptions(selected) {
    return sectionNames()
      .map(
        (s) =>
          `<option value="${AdminCommon.escapeHtml(s)}"${
            s === selected ? " selected" : ""
          }>${AdminCommon.escapeHtml(s)}</option>`
      )
      .join("");
  }

  function countInSection(name) {
    return rows.filter((r) => r.section === name).length;
  }

  function renderSectionManager() {
    if (!sectionListEl) return;
    if (!sections.length) {
      sectionListEl.innerHTML =
        '<p class="admin-help">No sections yet. Add one above.</p>';
      return;
    }
    sectionListEl.innerHTML = sections
      .map((sec, index) => {
        const count = countInSection(sec.name);
        return `<article class="admin-gallery-section-row" data-section-id="${sec.id}" data-section-name="${AdminCommon.escapeHtml(sec.name)}">
          <label class="admin-gallery-field">
            <span>Name</span>
            <input type="text" class="gallery-section-name-input" value="${AdminCommon.escapeHtml(sec.name)}" maxlength="80">
          </label>
          <p class="admin-help">${count} photo${count === 1 ? "" : "s"}</p>
          <div class="admin-actions">
            <button type="button" class="btn-link gallery-section-up" ${
              index === 0 ? "disabled" : ""
            }>Up</button>
            <button type="button" class="btn-link gallery-section-down" ${
              index === sections.length - 1 ? "disabled" : ""
            }>Down</button>
            <button type="button" class="btn-link gallery-section-save">Save name</button>
            <button type="button" class="btn-link gallery-section-delete"${
              count > 0 ? " disabled title=\"Move or delete photos first\"" : ""
            }>Delete</button>
          </div>
        </article>`;
      })
      .join("");
  }

  function renderGallery() {
    const bySection = new Map();
    sectionNames().forEach((s) => bySection.set(s, []));
    rows.forEach((row) => {
      if (!bySection.has(row.section)) bySection.set(row.section, []);
      bySection.get(row.section).push(row);
    });

    const ordered = [
      ...sectionNames(),
      ...[...bySection.keys()].filter((s) => !sectionNames().includes(s)),
    ];

    const blocks = [];
    ordered.forEach((section) => {
      const items = bySection.get(section) || [];
      if (!items.length && !sectionNames().includes(section)) return;
      const cards = items
        .map((item, index) => {
          const resolved = window.EcrGalleryUrl
            ? window.EcrGalleryUrl.resolve(item.url)
            : item.url;
          const src = AdminCommon.escapeHtml(resolved);
          const stored = AdminCommon.escapeHtml(item.url || "");
          const alt = AdminCommon.escapeHtml(item.alt || "");
          return `<article class="admin-gallery-item" data-id="${item.id}">
            <img src="${src}" alt="${alt}" loading="lazy">
            <div class="admin-gallery-item-body">
              <p class="admin-gallery-url"><a href="${src}" target="_blank" rel="noopener">Open full image</a>
                <span class="admin-help">${stored}</span></p>
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
        <div class="admin-gallery-grid">${
          cards || '<p class="admin-help">No images in this section.</p>'
        }</div>
      </div>`);
    });

    sectionsEl.innerHTML = blocks.join("");
    listStatus.textContent = `${rows.length} image${rows.length === 1 ? "" : "s"}`;
    listStatus.className = "form-message";
  }

  function renderAll() {
    fillSectionSelect(sectionSelect.value);
    renderSectionManager();
    renderGallery();
  }

  async function loadSections() {
    const { data, error } = await window.ecrSupabase
      .from("gallery_sections")
      .select("id,name,sort_order,created_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    sections = data || [];
  }

  async function loadImages() {
    const { data, error } = await window.ecrSupabase
      .from("gallery_images")
      .select("id,section,url,storage_path,alt,sort_order,created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    rows = data || [];
  }

  async function load() {
    listStatus.textContent = "Loading…";
    listStatus.className = "form-message";
    await loadSections();
    await loadImages();
    renderAll();
  }

  async function nextSortOrder(section) {
    const inSection = rows.filter((r) => r.section === section);
    if (!inSection.length) return 0;
    return Math.max(...inSection.map((r) => r.sort_order || 0)) + 1;
  }

  async function nextSectionSortOrder() {
    if (!sections.length) return 0;
    return Math.max(...sections.map((s) => s.sort_order || 0)) + 1;
  }

  function safeFileName(name) {
    return String(name || "image")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
  }

  sectionForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    AdminCommon.showMessage(sectionResult, "", "");
    const name = document.getElementById("gallery-section-new")?.value.trim();
    if (!name) {
      AdminCommon.showMessage(sectionResult, "Enter a section name.", "error");
      return;
    }
    if (sectionNames().some((s) => s.toLowerCase() === name.toLowerCase())) {
      AdminCommon.showMessage(sectionResult, "That section already exists.", "error");
      return;
    }
    try {
      const sort_order = await nextSectionSortOrder();
      const { error } = await window.ecrSupabase.from("gallery_sections").insert({
        name,
        sort_order,
      });
      if (error) throw error;
      sectionForm.reset();
      AdminCommon.showMessage(sectionResult, "Section added.", "success");
      await load();
    } catch (err) {
      AdminCommon.showMessage(sectionResult, err.message || String(err), "error");
    }
  });

  sectionListEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const rowEl = btn.closest(".admin-gallery-section-row");
    if (!rowEl) return;
    const id = rowEl.dataset.sectionId;
    const sec = sections.find((s) => s.id === id);
    if (!sec) return;

    try {
      if (btn.classList.contains("gallery-section-delete")) {
        const count = countInSection(sec.name);
        if (count > 0) {
          AdminCommon.showMessage(
            sectionResult,
            "Move or delete all photos in this section first.",
            "error"
          );
          return;
        }
        if (!confirm(`Delete section “${sec.name}”?`)) return;
        const { error } = await window.ecrSupabase
          .from("gallery_sections")
          .delete()
          .eq("id", id);
        if (error) throw error;
        AdminCommon.showMessage(sectionResult, "Section deleted.", "success");
        await load();
        return;
      }

      if (btn.classList.contains("gallery-section-save")) {
        const newName = rowEl
          .querySelector(".gallery-section-name-input")
          ?.value.trim();
        if (!newName) {
          AdminCommon.showMessage(sectionResult, "Section name cannot be empty.", "error");
          return;
        }
        if (
          newName !== sec.name &&
          sectionNames().some((s) => s.toLowerCase() === newName.toLowerCase())
        ) {
          AdminCommon.showMessage(sectionResult, "That section already exists.", "error");
          return;
        }
        if (newName === sec.name) {
          AdminCommon.showMessage(sectionResult, "No change.", "success");
          return;
        }
        const { error: secErr } = await window.ecrSupabase
          .from("gallery_sections")
          .update({ name: newName })
          .eq("id", id);
        if (secErr) throw secErr;
        const { error: imgErr } = await window.ecrSupabase
          .from("gallery_images")
          .update({ section: newName })
          .eq("section", sec.name);
        if (imgErr) throw imgErr;
        AdminCommon.showMessage(sectionResult, "Section renamed.", "success");
        await load();
        return;
      }

      if (
        btn.classList.contains("gallery-section-up") ||
        btn.classList.contains("gallery-section-down")
      ) {
        const index = sections.findIndex((s) => s.id === id);
        const swapWith =
          btn.classList.contains("gallery-section-up")
            ? sections[index - 1]
            : sections[index + 1];
        if (!swapWith) return;
        const aOrder = sec.sort_order;
        const bOrder = swapWith.sort_order;
        const { error: e1 } = await window.ecrSupabase
          .from("gallery_sections")
          .update({ sort_order: bOrder })
          .eq("id", sec.id);
        if (e1) throw e1;
        const { error: e2 } = await window.ecrSupabase
          .from("gallery_sections")
          .update({ sort_order: aOrder })
          .eq("id", swapWith.id);
        if (e2) throw e2;
        await load();
      }
    } catch (err) {
      AdminCommon.showMessage(sectionResult, err.message || String(err), "error");
    }
  });

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
    if (!sectionNames().length) {
      AdminCommon.showMessage(uploadResult, "Add a section before uploading.", "error");
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
