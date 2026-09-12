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
  ],

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

    const sessionUser = Auth.getCurrentUser();
    if (!sessionUser) {
      window.location.replace("admin-login.html");
      return null;
    }

    try {
      await Auth.ready();
    } catch {
      /* cached profile */
    }

    const isAdmin = await Auth.verifyAdmin();
    const me = Auth.getCurrentUser() || sessionUser;
    if (!isAdmin || me.accountKind !== "admin") {
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
      const needed = task.gate || task.id;
      if (!Auth.hasAdminTask(needed)) return "";
      return `<a class="admin-task-btn" href="${task.href}">
        <span class="admin-task-btn-label">${this.escapeHtml(task.label)}</span>
        <span class="admin-task-btn-blurb">${this.escapeHtml(task.blurb)}</span>
      </a>`;
    }).join("");
  },
};
