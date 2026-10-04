/**
 * Puts Sign Out in the top header when signed in, and points section
 * "← Visitors / ← Members" return links at the signed-in home.
 */
(function () {
  const HUB_HREFS = new Set(["visitors.html", "member-home.html", "members.html"]);

  function currentPage() {
    return String(window.location.pathname.split("/").pop() || "");
  }

  function sectionHome(user) {
    if (typeof Auth === "undefined") return null;
    if (Auth.isAdmin?.(user)) {
      return { href: "admin.html", label: "← Admin" };
    }
    if (Auth.canAccessMembers?.(user)) {
      return { href: "member-home.html", label: "← Members" };
    }
    return null;
  }

  function applySectionBack(user) {
    const dest = sectionHome(user);
    if (!dest) return;

    const page = currentPage();
    document.querySelectorAll(".admin-back a").forEach((a) => {
      if (a.getAttribute("data-section-back") === "off") return;
      const href = String(a.getAttribute("href") || "")
        .split("?")[0]
        .split("#")[0];
      if (!HUB_HREFS.has(href)) return;

      // Already on the admin hub — send admins to the main page instead.
      if (dest.href === "admin.html" && page === "admin.html") {
        a.href = "index.html";
        a.textContent = "← Main Page";
        return;
      }

      a.href = dest.href;
      a.textContent = dest.label;
    });
  }

  function findMountTarget() {
    const headerNav = document.querySelector("nav.header-nav");
    if (headerNav) return { parent: headerNav, home: false };

    const homeRow = document.querySelector(".page-home .header-links-row");
    if (homeRow) return { parent: homeRow, home: true };

    const homeLinks = document.querySelector(".page-home .header-links");
    if (homeLinks) return { parent: homeLinks, home: true };

    return null;
  }

  function mountSignOut(user) {
    const target = findMountTarget();
    const existing = document.querySelector("[data-site-sign-out]");

    if (!user) {
      existing?.remove();
      return;
    }

    if (!target) return;

    if (existing) {
      if (existing.parentElement !== target.parent) {
        target.parent.appendChild(existing);
      }
      existing.className = target.home ? "header-home-sign-out" : "header-nav-sign-out";
      existing.onclick = () => Auth.logout("index.html");
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = target.home ? "header-home-sign-out" : "header-nav-sign-out";
    btn.setAttribute("data-site-sign-out", "");
    btn.id = "site-header-sign-out";
    btn.textContent = "Sign Out";
    btn.addEventListener("click", () => Auth.logout("index.html"));
    target.parent.appendChild(btn);
  }

  function mount() {
    if (typeof Auth === "undefined") return;
    const user = Auth.getCurrentUser?.();
    mountSignOut(user);
    applySectionBack(user);
  }

  function run() {
    mount();
    if (typeof Auth?.ready === "function") {
      Auth.ready()
        .then(mount)
        .catch(() => mount());
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  window.SiteHeaderAuth = { mount, applySectionBack };
})();
