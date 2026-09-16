/**
 * Shared admin gate + helpers for hub and task pages.
 */
window.AdminCommon = {
  TASKS: [
    {
      id: "members",
      label: "Members",
      href: "admin-members.html",
      blurb: "Search, edit, or close member website access.",
    },
    {
      id: "passwords",
      label: "Passwords",
      href: "admin-passwords.html",
      blurb: "Issue a temporary password so a member can sign in and set a new one.",
    },
    {
      id: "reservations_view",
      label: "View reservations",
      href: "admin-reservations-view.html",
      blurb: "See all bookings. Edit or cancel if you also have Manage reservations.",
    },
    {
      id: "reservations_manage",
      label: "Manage reservations",
      href: "admin-reservations-manage.html",
      blurb: "Book for a member, edit dates/spot, confirm, or cancel.",
    },
    {
      id: "website",
      label: "Website",
      href: "admin-website.html",
      blurb: "Update site alerts (banner header, details, and photos).",
    },
    {
      id: "pictures",
      label: "Pictures",
      href: "admin-pictures.html",
      blurb: "Upload, reorder, or remove Pictures page gallery images.",
      gate: "website",
    },
    {
      id: "wedding_calendar",
      label: "Booking calendar",
      href: "admin-wedding-calendar.html",
      blurb: "Mark wedding dates booked, on hold, or closed for the public calendar.",
      gate: "website",
    },
    {
      id: "resort_calendar",
      label: "Resort Calendar",
      href: "admin-resort-calendar.html",
      blurb: "Add, edit, or remove ECR-planned events on the public resort calendar.",
      gate: "website",
    },
    {
      id: "board",
      label: "Board Members",
      href: "admin-board.html",
      blurb: "Edit Board of Directors names, photos, phone, email, and committees.",
      gate: "website",
    },
    {
      id: "staff",
      label: "Staff",
      href: "admin-staff.html",
      blurb: "Create lower-level admin accounts and assign tasks.",
    },
    {
      id: "account_roles",
      label: "Account roles",
      href: "admin-staff.html",
      blurb: "Attach staff access to a member, or membership to a staff account.",
      hub: false,
    },
  ],

  ASSIGNABLE_TASKS: [
    { id: "members", label: "Members" },
    { id: "passwords", label: "Passwords" },
    { id: "reservations_view", label: "Reservations view" },
    { id: "reservations_manage", label: "Reservations manage" },
    { id: "website", label: "Website" },
    { id: "account_roles", label: "Account roles" },
  ],

  profileHasMembership(profile) {
    return Boolean(String(profile?.member_id || "").trim());
  },

  profileHasStaffAccess(profile) {
    return profile?.is_admin === true || Boolean(String(profile?.staff_code || "").trim());
  },

  isStaffProfile(profile) {
    const kind = String(profile?.account_kind || "").trim().toLowerCase();
    return (
      kind === "admin" ||
      kind === "both" ||
      profile?.is_admin === true ||
      Boolean(String(profile?.staff_code || "").trim())
    );
  },

  isMemberProfile(profile) {
    return this.profileHasMembership(profile);
  },

  SELECTED_PROFILE_KEY: "eastCanyonAdminSelectedProfile",

  pageSearch() {
    return String(window.__ecrPageSearch || window.location.search || "");
  },

  restorePageSearch() {
    const snap = String(window.__ecrPageSearch || "");
    if (!snap || snap === "?" || snap === String(window.location.search || "")) return;
    const file = String(window.location.pathname.split("/").pop() || "").replace(
      /[^a-zA-Z0-9._-]/g,
      ""
    );
    if (!file || !window.history?.replaceState) return;
    try {
      window.history.replaceState(null, "", file + (snap.startsWith("?") ? snap : `?${snap}`));
    } catch {
      /* ignore */
    }
  },

  rememberProfile(profile, kind) {
    if (!profile) return null;
    const payload = {
      id: this.profileRowKey(profile),
      user_id: this.profileUserId(profile),
      kind: kind || null,
      member_id: String(profile.member_id || "").trim(),
      staff_code: String(profile.staff_code || "").trim(),
      email: String(profile.email || "").trim(),
      profile,
      at: Date.now(),
    };
    try {
      sessionStorage.setItem(this.SELECTED_PROFILE_KEY, JSON.stringify(payload));
    } catch {
      /* storage blocked */
    }
    return payload;
  },

  readRememberedProfile() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(this.SELECTED_PROFILE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  },

  readProfileQuery(search) {
    this.restorePageSearch();
    const params = new URLSearchParams(search || this.pageSearch());
    const current = new URLSearchParams(window.location.search || "");
    const remembered = this.readRememberedProfile();
    const rememberedProfile = remembered?.profile || null;
    const get = (name) => String(params.get(name) || current.get(name) || "").trim();
    const query = {
      id:
        get("id") ||
        get("user_id") ||
        get("profile") ||
        String(remembered?.user_id || remembered?.id || "").trim(),
      member_id:
        get("member_id") ||
        get("member") ||
        String(remembered?.member_id || rememberedProfile?.member_id || "").trim(),
      staff_code:
        get("staff") ||
        get("staff_code") ||
        String(remembered?.staff_code || rememberedProfile?.staff_code || "").trim(),
      email: get("email") || String(remembered?.email || rememberedProfile?.email || "").trim(),
      remembered,
    };
    query.hasAny = Boolean(
      query.id || query.member_id || query.staff_code || query.email || rememberedProfile
    );
    return query;
  },

  profileUserId(profile) {
    return String(profile?.id || profile?.user_id || "").trim();
  },

  profileRowKey(profile) {
    return (
      this.profileUserId(profile) ||
      String(profile?.member_id || "").trim() ||
      String(profile?.staff_code || "").trim() ||
      String(profile?.email || "").trim()
    );
  },

  profileMatchesQuery(profile, query) {
    if (!profile || !query) return false;
    const id = this.profileUserId(profile);
    const memberId = String(profile.member_id || "").trim();
    const staffCode = String(profile.staff_code || "").trim();
    const email = String(profile.email || "").trim();
    const needles = [query.id, query.user_id, query.member_id, query.staff_code, query.email]
      .map((v) => String(v || "").trim())
      .filter(Boolean);
    return needles.some((raw) => {
      const low = raw.toLowerCase();
      return (
        (id && (id === raw || id.toLowerCase() === low)) ||
        (memberId && memberId.toLowerCase() === low) ||
        (staffCode && staffCode.toLowerCase() === low) ||
        (email && email.toLowerCase() === low)
      );
    });
  },

  findProfile(profiles, query, predicate) {
    const rows = Array.isArray(profiles) ? profiles : [];
    const matched = rows.filter((p) => this.profileMatchesQuery(p, query));
    if (typeof predicate === "function") {
      return matched.find(predicate) || matched[0] || null;
    }
    return matched[0] || null;
  },

  resolveListedProfile(profiles, query, predicate) {
    return (
      this.findProfile(profiles, query, predicate) ||
      this.findProfile(profiles, query) ||
      query?.remembered?.profile ||
      null
    );
  },

  profileEditHref(page, profile) {
    const id = this.profileRowKey(profile);
    return id ? `${page}?id=${encodeURIComponent(id)}` : page;
  },

  bindProfileListClicks(container, { kind, getProfiles } = {}) {
    if (!container) return;
    const rememberRow = (row) => {
      const key = String(row?.getAttribute("data-profile-id") || "").trim();
      const list = typeof getProfiles === "function" ? getProfiles() || [] : [];
      const profile =
        list.find((p) => this.profileRowKey(p) === key) ||
        list.find((p) => this.profileUserId(p) === key) ||
        (key ? { id: key } : null);
      if (profile) this.rememberProfile(profile, kind);
    };
    container.addEventListener("click", (event) => {
      const row = event.target.closest("tr[data-profile-id], tr[data-href]");
      if (!row) return;
      rememberRow(row);
      if (event.target.closest("a, button, input, select, label")) return;
      const href = row.getAttribute("data-href");
      if (href) window.location.href = href;
    });
    container.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest("tr[data-profile-id], tr[data-href]");
      if (!row) return;
      event.preventDefault();
      rememberRow(row);
      const href = row.getAttribute("data-href");
      if (href) window.location.href = href;
    });
  },

  currentAdminReturnPath() {
    const file = String(window.location.pathname.split("/").pop() || "admin.html").replace(
      /[^a-zA-Z0-9._-]/g,
      ""
    );
    const search = window.location.search || window.__ecrPageSearch || "";
    return `${file || "admin.html"}${search}`;
  },

  adminLoginHref() {
    return `admin-login.html?next=${encodeURIComponent(this.currentAdminReturnPath())}`;
  },

  safeAdminNext(raw) {
    const next = String(
      raw || new URLSearchParams(window.location.search).get("next") || ""
    ).trim();
    if (!next || next.startsWith("/") || next.includes("://") || next.startsWith("//")) {
      return "admin.html";
    }
    const [path, query = ""] = next.split("?");
    if (!/^admin(?:-[a-z0-9]+)*\.html$/i.test(path)) return "admin.html";
    if (query && !/^[A-Za-z0-9._~=&%+,-]*$/.test(query)) return path;
    return query ? `${path}?${query}` : path;
  },

  taskCheckboxHtml(name = "staff-task") {
    return this.ASSIGNABLE_TASKS.map(
      (task) =>
        `<label><input type="checkbox" name="${name}" value="${this.escapeHtml(
          task.id
        )}"> ${this.escapeHtml(task.label)}</label>`
    ).join("");
  },

  escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = type ? `form-message ${type}` : "form-message";
  },

  statusLabel(status) {
    const labels = {
      pending_activation: "Pending activation",
      active: "Active",
      suspended: "Suspended",
      closed: "Closed",
    };
    return labels[status] || status || "Active";
  },

  memberLabel(profiles, userId) {
    const profile = (profiles || []).find((p) => p.id === userId);
    if (!profile) return userId ? userId.slice(0, 8) : "—";
    const id = profile.member_id ? ` (${profile.member_id})` : "";
    return `${profile.full_name || profile.email || userId.slice(0, 8)}${id}`;
  },

  async requireAdmin(requiredTask) {
    const denied = document.getElementById("admin-denied");
    const app = document.getElementById("admin-app");

    this.restorePageSearch();

    try {
      await Auth.ready();
    } catch {
      /* cached profile */
    }

    const sessionUser = Auth.getCurrentUser();
    if (!sessionUser) {
      window.location.replace(this.adminLoginHref());
      return null;
    }

    const isAdmin = await Auth.verifyAdmin();
    const me = Auth.getCurrentUser() || sessionUser;
    if (!isAdmin) {
      if (denied) denied.hidden = false;
      if (app) app.hidden = true;
      return null;
    }

    if (requiredTask && !Auth.hasAdminTask(requiredTask)) {
      if (denied) {
        denied.hidden = false;
        denied.innerHTML =
          `You are not assigned this task. <a href="admin.html">Back to Admin</a>`;
      }
      if (app) app.hidden = true;
      return null;
    }

    if (denied) denied.hidden = true;
    if (app) app.hidden = false;
    Auth.showAdminLinks();

    const who = document.getElementById("admin-whoami");
    if (who) {
      const seat = me.adminSeat
        ? `${me.adminLevel}${me.adminSeat}`
        : `Level ${me.adminLevel || 1}`;
      who.textContent = `${me.name || me.email} · ${seat}${
        me.staffCode ? ` · ${me.staffCode}` : ""
      }. `;
    }

    if (typeof SiteHeaderAuth?.mount === "function") {
      SiteHeaderAuth.mount();
    }

    return me;
  },

  /**
   * Theme-matched confirm dialog. Resolves true if the user confirms.
   * @param {{ title?: string, message?: string, confirmLabel?: string, cancelLabel?: string }} [options]
   */
  confirmAction(options = {}) {
    const title = options.title || "Confirm action";
    const message = options.message || "Do you want to continue?";
    const confirmLabel = options.confirmLabel || "Confirm";
    const cancelLabel = options.cancelLabel || "Go back";

    let root = document.getElementById("admin-confirm-dialog");
    if (!root) {
      root = document.createElement("div");
      root.id = "admin-confirm-dialog";
      root.className = "admin-confirm-dialog";
      root.hidden = true;
      root.innerHTML = `
        <div class="admin-confirm-backdrop" data-confirm-choice="cancel"></div>
        <div class="admin-confirm-panel" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
          <h2 id="admin-confirm-title"></h2>
          <p id="admin-confirm-message" class="admin-confirm-message"></p>
          <div class="admin-confirm-actions">
            <button type="button" class="btn btn-primary" data-confirm-choice="confirm"></button>
            <button type="button" class="btn btn-outline" data-confirm-choice="cancel"></button>
          </div>
        </div>
      `;
      document.body.appendChild(root);
    }

    const titleEl = root.querySelector("#admin-confirm-title");
    const messageEl = root.querySelector("#admin-confirm-message");
    const confirmBtn = root.querySelector('[data-confirm-choice="confirm"]');
    const cancelBtn = root.querySelector('[data-confirm-choice="cancel"].btn');
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (confirmBtn) confirmBtn.textContent = confirmLabel;
    if (cancelBtn) cancelBtn.textContent = cancelLabel;

    root.hidden = false;
    document.body.classList.add("admin-confirm-open");

    return new Promise((resolve) => {
      const finish = (confirmed) => {
        root.hidden = true;
        document.body.classList.remove("admin-confirm-open");
        root.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKey);
        resolve(Boolean(confirmed));
      };
      const onClick = (event) => {
        const choice = event.target?.closest?.("[data-confirm-choice]");
        if (!choice) return;
        finish(choice.getAttribute("data-confirm-choice") === "confirm");
      };
      const onKey = (event) => {
        if (event.key === "Escape") finish(false);
      };
      root.addEventListener("click", onClick);
      document.addEventListener("keydown", onKey);
      confirmBtn?.focus();
    });
  },

  renderHubButtons(container) {
    if (!container) return;
    container.innerHTML = this.TASKS.map((task) => {
      if (task.hub === false) return "";
      const needed = task.gate || task.id;
      if (!Auth.hasAdminTask(needed)) return "";
      return `<a class="admin-task-btn" href="${task.href}">
        <span class="admin-task-btn-label">${this.escapeHtml(task.label)}</span>
        <span class="admin-task-btn-blurb">${this.escapeHtml(task.blurb)}</span>
      </a>`;
    }).join("");
  },
};
