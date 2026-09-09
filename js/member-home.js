(async function () {
  const user = Auth.redirectForAuth({ requireMember: true });
  if (!user) return;

  try {
    await Auth.ready();
  } catch {
    /* use cached profile */
  }

  const current = Auth.getCurrentUser() || user;
  const firstName = (current.name || "").trim().split(/\s+/)[0];
  document.getElementById("member-greeting").textContent = firstName
    ? `Welcome, ${firstName}`
    : "Welcome";

  const summary = document.getElementById("member-profile-summary");
  const cityLine = [current.city, current.state, current.zip].filter(Boolean).join(", ");
  const typeLabel = Auth.reservationTypeLabel(current.reservationType || current.accountType);
  const rows = [
    ["Member ID", current.memberId],
    ["Username", current.username],
    ["Name", current.name],
    ["Email", current.profileEmail || current.email],
    ["Phone", current.phone],
    ["Address", current.address],
    ["City, state, zip", cityLine],
    ["RV / rig", current.rv],
    ["Type", typeLabel],
  ].filter(([, value]) => String(value || "").trim());

  summary.innerHTML = rows
    .map(
      ([label, value]) =>
        `<div><dt>${label}</dt><dd>${String(value).replace(/</g, "&lt;")}</dd></div>`
    )
    .join("");

  Auth.showAdminLinks();

  document.getElementById("member-logout").addEventListener("click", () => {
    Auth.logout();
  });
})();
