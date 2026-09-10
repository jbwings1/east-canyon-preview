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
      blurb: "See all current and upcoming bookings.",
    },
    {
      id: "reservations_manage",
      label: "Manage reservations",
      href: "admin-reservations-manage.html",
      blurb: "Book for a member, confirm, or cancel reservations.",
    },
    {
      id: "website",
      label: "Website",
      href: "admin-website.html",
      blurb: "Update the site alert notice.",
    },
    {
      id: "pictures",
      label: "Pictures",
      href: "admin-pictures.html",
      blurb: "Upload, reorder, or remove Pictures page gallery images.",
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

    document.getElementById("admin-logout")?.addEventListener("click", () =>
      Auth.logout("admin-login.html")
    );

    return me;
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
