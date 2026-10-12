/**
 * Shared admin gate + helpers for hub and task pages.
 */
window.AdminCommon = {
  TASKS: [
    {
      id: "reservations_manage",
      label: "Manage reservations",
      href: "admin-reservations-manage.html",
      blurb:
        "See every reservation and check guests in. Added functions can also book, edit, confirm, cancel, or override a rule.",
      gateAny: [
        "view_reservations",
        "office_check_in",
        "make_reservation",
        "edit_reservation",
        "confirm_reservation",
        "cancel_reservation",
        "override_rule",
      ],
    },
    {
      id: "wedding_calendar",
      label: "Booking calendar",
      href: "admin-wedding-calendar.html",
      blurb: "Mark dates booked, on hold, or closed, or edit the public note.",
      gateAny: ["mark_calendar", "edit_calendar_note", "edit_calendar_heading"],
    },
    {
      id: "website",
      label: "Website",
      href: "admin-website.html",
      blurb: "Add, edit, or turn site alerts on or off, and add or remove alert photos.",
      gateAny: ["manage_alerts", "alert_photos", "delete_alert"],
    },
    {
      id: "pictures",
      label: "Pictures",
      href: "admin-pictures.html",
      blurb: "Upload, reorder, or remove gallery pictures, and edit gallery sections.",
      gate: "gallery",
    },
    {
      id: "resort_calendar",
      label: "Resort Calendar",
      href: "admin-resort-calendar.html",
      blurb: "Add, edit, or remove events on the public resort calendar.",
      gate: "resort_calendar",
    },
    {
      id: "board",
      label: "Board Members",
      href: "admin-board.html",
      blurb: "Add, edit, reorder, or remove board member names, photos, and committees.",
      gate: "board_members",
    },
    {
      id: "members",
      label: "Members",
      href: "admin-members.html",
      blurb: "Search, create, edit, close, or delete member accounts.",
      gate: "member_accounts",
    },
    {
      id: "passwords",
      label: "Passwords",
      href: "admin-passwords.html",
      blurb: "Set a temporary password so a member can sign in and choose a new one.",
      gate: "member_password",
    },
    {
      id: "invoices",
      label: "Member accounts",
      href: "admin-invoices.html",
      blurb: "Create a charge and view member accounts, including overdue accounts.",
      gate: "member_charges",
    },
    {
      id: "reports",
      label: "Reports",
      href: "admin-reports.html",
      blurb: "Reservations, current members, stay counts, and booking overrides.",
      gate: "run_reports",
    },
    {
      id: "staff",
      label: "Staff",
      href: "admin-staff.html",
      blurb: "Create staff logins, edit jobs, and close, suspend, or delete a staff account.",
      gateAny: [
        "create_staff",
        "edit_staff",
        "close_staff",
        "add_staff_access",
        "add_membership",
        "remove_staff_access",
      ],
    },
  ],

  EXTRA_FUNCTIONS: [
    { id: "view_reservations", label: "View every reservation and open the details", group: "Reservations" },
    { id: "office_check_in", label: "Office check-in", group: "Reservations" },
    { id: "occupancy_names", label: "See member names on occupied sites", group: "Reservations" },
    { id: "make_reservation", label: "Make a reservation", group: "Reservations" },
    { id: "edit_reservation", label: "Edit a reservation", group: "Reservations" },
    { id: "confirm_reservation", label: "Confirm a reservation", group: "Reservations" },
    { id: "cancel_reservation", label: "Cancel a reservation", group: "Reservations" },
    { id: "override_rule", label: "Override a booking rule", group: "Reservations" },
    { id: "mark_calendar", label: "Mark dates booked, on hold, or closed", group: "Booking calendar" },
    { id: "edit_calendar_note", label: "Edit the public booking-calendar note", group: "Booking calendar" },
    { id: "edit_calendar_heading", label: "Change the booking calendar heading and the year it shows", group: "Booking calendar" },
    { id: "manage_alerts", label: "Add, edit, or turn site alerts on or off", group: "Website" },
    { id: "alert_photos", label: "Add or remove alert photos", group: "Website" },
    { id: "delete_alert", label: "Delete a site alert", group: "Website" },
    { id: "resort_calendar", label: "Add, edit, or remove resort calendar events", group: "Website" },
    { id: "gallery", label: "Upload, reorder, or remove gallery pictures, and edit gallery sections", group: "Website" },
    { id: "board_members", label: "Add, edit, reorder, or remove board members", group: "Website" },
    { id: "member_accounts", label: "Search, create, edit, close, or delete member accounts", group: "Accounts" },
    { id: "member_password", label: "Set a temporary member password", group: "Accounts" },
    { id: "member_charges", label: "Create a charge and view member accounts, including overdue accounts", group: "Accounts" },
    { id: "run_reports", label: "Run the reports", group: "Accounts" },
    { id: "create_staff", label: "Create a staff login", group: "Staff" },
    { id: "edit_staff", label: "Edit a staff record", group: "Staff" },
    { id: "close_staff", label: "Close, suspend, or delete a staff account", group: "Staff" },
    { id: "add_staff_access", label: "Add staff access to a member", group: "Staff" },
    { id: "add_membership", label: "Add a membership to a staff account", group: "Staff" },
    { id: "remove_staff_access", label: "Remove staff access from a dual account", group: "Staff" },
  ],

  ASSIGNABLE_TASKS: [
    { id: "front_desk", label: "Front desk" },
    { id: "reservation_agent", label: "Reservation agent" },
    { id: "special_events", label: "Special events agent" },
    { id: "website_editor", label: "Website editor" },
    { id: "accounts_manager", label: "Accounts manager" },
    { id: "site_manager", label: "Site manager" },
  ],

  profileHasMembership(profile) {
    return Boolean(String(profile?.member_id || "").trim());
  },

  canViewReports() {
    return Auth.hasAdminTask("run_reports");
  },

  storedExtraIds(adminTasks) {
    const ids = new Set(this.EXTRA_FUNCTIONS.map((item) => item.id));
    return (Array.isArray(adminTasks) ? adminTasks : []).filter((id) => ids.has(id));
  },

  assignmentSummary(adminTasks, adminLevel) {
    if (Number(adminLevel) === 1) return "All jobs";
    const stored = Array.isArray(adminTasks) ? adminTasks : [];
    const jobIds = stored.filter((id) => this.ASSIGNABLE_TASKS.some((job) => job.id === id));
    const jobs = this.jobLabels(stored, adminLevel);
    const extraLabels = this.EXTRA_FUNCTIONS.filter(
      (item) => stored.includes(item.id) && !Auth.impliesAdminTask(item.id, null, jobIds)
    ).map((item) => item.label);
    return [...jobs, ...extraLabels].join(", ");
  },

  jobsFromStored(adminTasks, adminLevel) {
    return this.ASSIGNABLE_TASKS.map((task) => task.id).filter((id) =>
      Auth.impliesAdminTask(id, adminLevel, adminTasks)
    );
  },

  jobLabels(adminTasks, adminLevel) {
    const ids = this.jobsFromStored(adminTasks, adminLevel);
    return this.ASSIGNABLE_TASKS.filter((task) => ids.includes(task.id)).map((task) => task.label);
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

  functionCheckboxHtml(name = "staff-function") {
    let html = "";
    let group = "";
    this.EXTRA_FUNCTIONS.forEach((item) => {
      if (item.group !== group) {
        group = item.group;
        html += `<h3 class="admin-subhead">${this.escapeHtml(group)}</h3>`;
      }
      html += `<label><input type="checkbox" name="${name}" value="${this.escapeHtml(
        item.id
      )}"> ${this.escapeHtml(item.label)}</label>`;
    });
    return html;
  },

  wireFunctionPicker({
    button,
    fieldset,
    jobName,
    functionName,
    levelInput,
    storedTasks,
    note,
  }) {
    const jobBoxes = () => Array.from(document.querySelectorAll(`input[name="${jobName}"]`));
    const functionBoxes = () =>
      Array.from(document.querySelectorAll(`input[name="${functionName}"]`));
    const storedExtras = new Set(this.storedExtraIds(storedTasks));
    const chosenExtras = new Set(storedExtras);

    const sync = () => {
      const level = Number(levelInput?.value);
      const level1 = level === 1;
      const selectedJobs = jobBoxes()
        .filter((el) => level1 || el.checked)
        .map((el) => el.value);
      jobBoxes().forEach((el) => {
        el.disabled = level1;
        if (level1) el.checked = true;
      });
      functionBoxes().forEach((el) => {
        const included =
          level1 || Auth.impliesAdminTask(el.value, null, selectedJobs);
        if (included) {
          el.checked = true;
          el.disabled = true;
        } else {
          el.disabled = false;
          el.checked = chosenExtras.has(el.value);
        }
      });
      if (note) {
        note.textContent = level1
          ? "Level 1 has every job and every function."
          : "Assign at least one job or function. Add a function gives only that function. A site manager cannot remove their own Site manager job.";
      }
    };

    functionBoxes().forEach((el) => {
      el.addEventListener("change", () => {
        if (el.disabled) return;
        if (el.checked) chosenExtras.add(el.value);
        else chosenExtras.delete(el.value);
      });
    });
    jobBoxes().forEach((el) => el.addEventListener("change", sync));
    levelInput?.addEventListener("change", sync);
    if (button && fieldset) {
      const open = storedExtras.size > 0;
      fieldset.hidden = !open;
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.addEventListener("click", () => {
        fieldset.hidden = !fieldset.hidden;
        button.setAttribute("aria-expanded", fieldset.hidden ? "false" : "true");
      });
    }
    sync();

    return () => {
      const level = Number(levelInput?.value);
      if (level === 1) return this.ASSIGNABLE_TASKS.map((task) => task.id);
      const jobs = jobBoxes()
        .filter((el) => el.checked)
        .map((el) => el.value);
      const extras = functionBoxes()
        .filter((el) => el.checked && !el.disabled)
        .map((el) => el.value);
      return [...jobs, ...extras];
    };
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

    const required = Array.isArray(requiredTask)
      ? requiredTask.filter(Boolean)
      : requiredTask
        ? [requiredTask]
        : [];
    if (required.length && !required.some((task) => Auth.hasAdminTask(task))) {
      if (denied) {
        denied.hidden = false;
        denied.innerHTML =
          `You are not assigned this. <a href="admin.html">Back to Admin</a>`;
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
      const needed = task.gateAny || [task.gate || task.id];
      if (!needed.some((id) => Auth.hasAdminTask(id))) return "";
      return `<a class="admin-task-btn" href="${task.href}">
        <span class="admin-task-btn-label">${this.escapeHtml(task.label)}</span>
        <span class="admin-task-btn-blurb">${this.escapeHtml(task.blurb)}</span>
      </a>`;
    }).join("");
  },
};
