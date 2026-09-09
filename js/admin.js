/**
 * Admin hub — task buttons only.
 */
(async function () {
  const me = await AdminCommon.requireAdmin();
  if (!me) return;
  AdminCommon.renderHubButtons(document.getElementById("admin-task-grid"));
})();
