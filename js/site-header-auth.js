/**
 * Puts Sign Out in the top header on every page when a user is signed in.
 */
(function () {
  function logoutTarget(user) {
    if (user?.accountKind === "admin") return "admin-login.html";
    return "login.html";
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

  function mount() {
    if (typeof Auth === "undefined") return;

    const target = findMountTarget();
    const existing = document.querySelector("[data-site-sign-out]");
    const user = Auth.getCurrentUser?.();

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
      existing.onclick = () => Auth.logout(logoutTarget(user));
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = target.home ? "header-home-sign-out" : "header-nav-sign-out";
    btn.setAttribute("data-site-sign-out", "");
    btn.id = "site-header-sign-out";
    btn.textContent = "Sign Out";
    btn.addEventListener("click", () => Auth.logout(logoutTarget(user)));
    target.parent.appendChild(btn);
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

  window.SiteHeaderAuth = { mount };
})();
