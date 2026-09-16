(async function () {
  const me = await AdminCommon.requireAdmin("members");
  if (!me) return;

  const membersBody = document.getElementById("admin-members-body");
  const message = document.getElementById("admin-message");
  const searchInput = document.getElementById("member-search");
  const sortSelect = document.getElementById("member-sort");
  const countEl = document.getElementById("admin-members-count");
  let members = [];

  function compareText(a, b) {
    return String(a || "").localeCompare(String(b || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  function filteredMembers() {
    const query = (searchInput?.value || "").trim().toLowerCase();
    const sort = sortSelect?.value || "name-asc";
    let rows = members.slice();
    if (query) {
      rows = rows.filter((p) => {
        const name = String(p.full_name || "").toLowerCase();
        const memberId = String(p.member_id || "").toLowerCase();
        return name.includes(query) || memberId.includes(query);
      });
    }
    rows.sort((a, b) => {
      if (sort.startsWith("member-id")) {
        const emptyA = !String(a.member_id || "").trim();
        const emptyB = !String(b.member_id || "").trim();
        if (emptyA !== emptyB) return emptyA ? 1 : -1;
        const cmp = compareText(a.member_id, b.member_id);
        return sort === "member-id-desc" ? -cmp : cmp;
      }
      const emptyA = !String(a.full_name || "").trim();
      const emptyB = !String(b.full_name || "").trim();
      if (emptyA !== emptyB) return emptyA ? 1 : -1;
      const cmp = compareText(a.full_name, b.full_name);
      return sort === "name-desc" ? -cmp : cmp;
    });
    return rows;
  }

  function persistFilters() {
    const params = new URLSearchParams();
    const query = (searchInput?.value || "").trim();
    const sort = sortSelect?.value || "name-asc";
    if (query) params.set("q", query);
    if (sort && sort !== "name-asc") params.set("sort", sort);
    const next = params.toString();
    const path = "admin-members.html";
    history.replaceState(null, "", next ? `${path}?${next}` : path);
  }

  function renderMembers() {
    const rows = filteredMembers();
    const total = members.length;
    if (countEl) {
      if (!total) {
        countEl.textContent = "";
      } else if (rows.length === total) {
        countEl.textContent = `${total} member${total === 1 ? "" : "s"}`;
      } else {
        countEl.textContent = `Showing ${rows.length} of ${total} members`;
      }
    }
    if (!total) {
      membersBody.innerHTML = `<tr><td colspan="9">No members yet.</td></tr>`;
      return;
    }
    if (!rows.length) {
      membersBody.innerHTML = `<tr><td colspan="9">No members match that search.</td></tr>`;
      return;
    }
    membersBody.innerHTML = rows
      .map((p) => {
        const status = p.account_status || "active";
        const password = p.must_change_password ? "Temp / change required" : "Set";
        const href = AdminCommon.profileEditHref("admin-member-edit.html", p);
        const name = p.full_name || p.email || "Member";
        const memberId = p.member_id || "—";
        const staffCode = p.staff_code || "—";
        const rowKey = AdminCommon.profileRowKey(p);
        return `<tr class="admin-row-link" data-profile-id="${AdminCommon.escapeHtml(rowKey)}" data-href="${AdminCommon.escapeHtml(href)}" tabindex="0">
          <td class="admin-col-member-id"><a href="${AdminCommon.escapeHtml(href)}">${AdminCommon.escapeHtml(memberId)}</a></td>
          <td>${AdminCommon.escapeHtml(staffCode)}</td>
          <td><a href="${AdminCommon.escapeHtml(href)}">${AdminCommon.escapeHtml(name)}</a></td>
          <td>${AdminCommon.escapeHtml(p.username || "—")}</td>
          <td>${AdminCommon.escapeHtml(p.email || "—")}</td>
          <td>${AdminCommon.escapeHtml(p.phone || "—")}</td>
          <td>${AdminCommon.escapeHtml(AdminCommon.statusLabel(status))}</td>
          <td>${AdminCommon.escapeHtml(password)}</td>
          <td class="admin-actions">
            <a class="btn btn-outline btn-small" href="${AdminCommon.escapeHtml(href)}">Open</a>
          </td>
        </tr>`;
      })
      .join("");
  }

  function showFlash() {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get("ok");
    const notice = String(params.get("notice") || "").trim();
    const flashes = {
      created: "Member access created.",
      updated: "Member record updated.",
      staff: "Staff access added to this membership.",
      removed: "Membership removed. Staff access and the same login stay.",
      closed: "Membership closed. Reservation history stays on file for admins.",
      deleted: "Unused member account permanently deleted.",
    };
    if (notice) {
      AdminCommon.showMessage(message, notice, "success");
    } else if (ok && flashes[ok]) {
      AdminCommon.showMessage(message, flashes[ok], "success");
    }
    if (searchInput) searchInput.value = params.get("q") || "";
    if (sortSelect) sortSelect.value = params.get("sort") || "name-asc";
  }

  async function load() {
    try {
      const profiles = await Auth.listAllProfiles();
      members = profiles.filter((p) => AdminCommon.profileHasMembership(p));
      renderMembers();
    } catch (err) {
      AdminCommon.showMessage(message, err.message, "error");
      membersBody.innerHTML = `<tr><td colspan="9">${AdminCommon.escapeHtml(err.message)}</td></tr>`;
    }
  }

  AdminCommon.bindProfileListClicks(membersBody, {
    kind: "member",
    getProfiles: () => members,
  });

  searchInput?.addEventListener("input", () => {
    persistFilters();
    renderMembers();
  });
  sortSelect?.addEventListener("change", () => {
    persistFilters();
    renderMembers();
  });

  showFlash();
  await load();
})();
