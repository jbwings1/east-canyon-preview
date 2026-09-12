/**
 * Admin Board Members — add/edit/reorder/delete roster shown on board-information.html.
 * Requires website admin task.
 */
(async function () {
  const me = await AdminCommon.requireAdmin("website");
  if (!me) return;

  const form = document.getElementById("admin-board-form");
  const formResult = document.getElementById("admin-board-form-result");
  const listEl = document.getElementById("admin-board-list");
  const listStatus = document.getElementById("admin-board-list-status");

  let members = [];

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

  function renderList() {
    if (!listEl) return;
    if (!members.length) {
      listEl.innerHTML = '<p class="admin-help">No board members yet. Add one above.</p>';
      listStatus.textContent = "0 members";
      return;
    }
    listEl.innerHTML = members
      .map((m, index) => {
        const src = AdminCommon.escapeHtml(resolveUrl(m.photo_url));
        const photoBlock = m.photo_url
          ? `<img src="${src}" alt="${AdminCommon.escapeHtml(m.full_name)}" loading="lazy">`
          : `<div class="admin-board-photo-placeholder">No photo</div>`;
        return `<article class="admin-board-item" data-id="${m.id}">
          <div class="admin-board-item-photo">
            ${photoBlock}
            <label class="admin-gallery-field">
              <span>Replace photo</span>
              <input type="file" class="board-photo-input" accept="image/jpeg,image/png,image/webp,image/gif">
            </label>
          </div>
          <div class="admin-board-item-body">
            <div class="admin-form-row">
              <label class="admin-gallery-field">
                <span>Name</span>
                <input type="text" class="board-name-input" value="${AdminCommon.escapeHtml(m.full_name)}" maxlength="120" required>
              </label>
              <label class="admin-gallery-field">
                <span>Title / role</span>
                <input type="text" class="board-title-input" value="${AdminCommon.escapeHtml(m.title || "")}" maxlength="120">
              </label>
            </div>
            <div class="admin-form-row">
              <label class="admin-gallery-field">
                <span>Phone</span>
                <input type="text" class="board-phone-input" value="${AdminCommon.escapeHtml(m.phone || "")}" maxlength="40">
              </label>
              <label class="admin-gallery-field">
                <span>Email</span>
                <input type="email" class="board-email-input" value="${AdminCommon.escapeHtml(m.email || "")}" maxlength="120">
              </label>
            </div>
            <label class="admin-gallery-field">
              <span>Committee</span>
              <input type="text" class="board-committee-input" value="${AdminCommon.escapeHtml(m.committee || "")}" maxlength="160">
            </label>
            <div class="admin-actions">
              <button type="button" class="btn-link board-move-up"${index === 0 ? " disabled" : ""}>Up</button>
              <button type="button" class="btn-link board-move-down"${
                index === members.length - 1 ? " disabled" : ""
              }>Down</button>
              <button type="button" class="btn-link board-save">Save</button>
              <button type="button" class="btn-link board-delete">Delete</button>
            </div>
          </div>
        </article>`;
      })
      .join("");
    listStatus.textContent = `${members.length} member${members.length === 1 ? "" : "s"}`;
    listStatus.className = "form-message";
  }

  async function loadMembers() {
    listStatus.textContent = "Loading…";
    const { data, error } = await window.ecrSupabase
      .from("board_members")
      .select(
        "id,full_name,title,phone,email,committee,photo_url,storage_path,sort_order,updated_at"
      )
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true });
    if (error) throw error;
    members = data || [];
    renderList();
  }

  async function nextSortOrder() {
    if (!members.length) return 0;
    return Math.max(...members.map((m) => m.sort_order || 0)) + 1;
  }

  async function uploadPhoto(file) {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Image must be 10 MB or smaller.");
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const storagePath = `${Date.now()}-${safeFileName(
      file.name.replace(/\.[^.]+$/, "")
    )}.${ext}`;
    const { error: upErr } = await window.ecrSupabase.storage
      .from("board")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
    if (upErr) throw upErr;
    const { data: pub } = window.ecrSupabase.storage.from("board").getPublicUrl(storagePath);
    const url = pub?.publicUrl;
    if (!url) {
      await window.ecrSupabase.storage.from("board").remove([storagePath]);
      throw new Error("Could not get public URL for uploaded image.");
    }
    return { url, storagePath };
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    AdminCommon.showMessage(formResult, "", "");
    try {
      const full_name = document.getElementById("board-name").value.trim();
      if (!full_name) {
        AdminCommon.showMessage(formResult, "Enter a name.", "error");
        return;
      }
      let photo_url = "";
      let storage_path = null;
      const file = document.getElementById("board-photo")?.files?.[0];
      if (file) {
        const uploaded = await uploadPhoto(file);
        photo_url = uploaded.url;
        storage_path = uploaded.storagePath;
      }
      const payload = {
        full_name,
        title: document.getElementById("board-title").value.trim(),
        phone: document.getElementById("board-phone").value.trim(),
        email: document.getElementById("board-email").value.trim(),
        committee: document.getElementById("board-committee").value.trim(),
        photo_url,
        storage_path,
        sort_order: await nextSortOrder(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await window.ecrSupabase.from("board_members").insert(payload);
      if (error) {
        if (storage_path) {
          await window.ecrSupabase.storage.from("board").remove([storage_path]);
        }
        throw error;
      }
      form.reset();
      AdminCommon.showMessage(formResult, "Board member added.", "success");
      await loadMembers();
    } catch (err) {
      AdminCommon.showMessage(formResult, err.message || String(err), "error");
    }
  });

  listEl?.addEventListener("change", async (e) => {
    const input = e.target.closest(".board-photo-input");
    if (!input || !input.files?.[0]) return;
    const card = input.closest(".admin-board-item");
    if (!card) return;
    const id = card.dataset.id;
    const row = members.find((m) => m.id === id);
    if (!row) return;
    try {
      const uploaded = await uploadPhoto(input.files[0]);
      const { error } = await window.ecrSupabase
        .from("board_members")
        .update({
          photo_url: uploaded.url,
          storage_path: uploaded.storagePath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) {
        await window.ecrSupabase.storage.from("board").remove([uploaded.storagePath]);
        throw error;
      }
      if (row.storage_path) {
        await window.ecrSupabase.storage.from("board").remove([row.storage_path]);
      }
      AdminCommon.showMessage(listStatus, "Photo updated.", "success");
      await loadMembers();
    } catch (err) {
      AdminCommon.showMessage(listStatus, err.message || String(err), "error");
      input.value = "";
    }
  });

  listEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const card = btn.closest(".admin-board-item");
    if (!card) return;
    const id = card.dataset.id;
    const row = members.find((m) => m.id === id);
    if (!row) return;

    try {
      if (btn.classList.contains("board-delete")) {
        if (!confirm(`Remove ${row.full_name} from the board list?`)) return;
        const { error } = await window.ecrSupabase
          .from("board_members")
          .delete()
          .eq("id", id);
        if (error) throw error;
        if (row.storage_path) {
          await window.ecrSupabase.storage.from("board").remove([row.storage_path]);
        }
        await loadMembers();
        return;
      }

      if (btn.classList.contains("board-save")) {
        const full_name = card.querySelector(".board-name-input")?.value.trim() || "";
        if (!full_name) {
          AdminCommon.showMessage(listStatus, "Name cannot be empty.", "error");
          return;
        }
        const { error } = await window.ecrSupabase
          .from("board_members")
          .update({
            full_name,
            title: card.querySelector(".board-title-input")?.value.trim() || "",
            phone: card.querySelector(".board-phone-input")?.value.trim() || "",
            email: card.querySelector(".board-email-input")?.value.trim() || "",
            committee: card.querySelector(".board-committee-input")?.value.trim() || "",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) throw error;
        AdminCommon.showMessage(listStatus, "Saved.", "success");
        await loadMembers();
        return;
      }

      if (btn.classList.contains("board-move-up") || btn.classList.contains("board-move-down")) {
        const index = members.findIndex((m) => m.id === id);
        const swapWith =
          btn.classList.contains("board-move-up")
            ? members[index - 1]
            : members[index + 1];
        if (!swapWith) return;
        const aOrder = row.sort_order;
        const bOrder = swapWith.sort_order;
        const { error: e1 } = await window.ecrSupabase
          .from("board_members")
          .update({ sort_order: bOrder })
          .eq("id", row.id);
        if (e1) throw e1;
        const { error: e2 } = await window.ecrSupabase
          .from("board_members")
          .update({ sort_order: aOrder })
          .eq("id", swapWith.id);
        if (e2) throw e2;
        await loadMembers();
      }
    } catch (err) {
      AdminCommon.showMessage(listStatus, err.message || String(err), "error");
    }
  });

  try {
    await loadMembers();
  } catch (err) {
    AdminCommon.showMessage(listStatus, err.message || String(err), "error");
  }
})();
