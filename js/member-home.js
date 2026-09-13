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

  if (typeof MembershipRights?.parseClassFromMemberId === "function") {
    const classCode = MembershipRights.parseClassFromMemberId(current.memberId);
    if (classCode) {
      rows.splice(1, 0, [
        "Class",
        `${classCode} · <a href="membership-use-rights.html">Class information sheet</a>`,
      ]);
    }
  }

  summary.innerHTML = rows
    .map(([label, value]) => {
      const safeLabel = String(label).replace(/</g, "&lt;");
      const raw = String(value || "");
      const safeValue = /<a href=/.test(raw)
        ? raw
        : raw.replace(/</g, "&lt;");
      return `<div><dt>${safeLabel}</dt><dd>${safeValue}</dd></div>`;
    })
    .join("");

  if (typeof MembershipRights?.renderClassRules === "function") {
    MembershipRights.renderClassRules(document.getElementById("member-class-rules"), {
      memberId: current.memberId,
    });
  }

  Auth.showAdminLinks();
  if (typeof SiteHeaderAuth?.mount === "function") SiteHeaderAuth.mount();
})();
