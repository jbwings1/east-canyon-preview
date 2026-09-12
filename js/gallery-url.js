/**
 * Resolve gallery image URLs for GitHub Pages / local file viewing.
 * Relative paths like pix/gallery/foo.jpg must be based on the current page,
 * not the site root (otherwise open-in-new-tab 404s on project Pages).
 */
(function (global) {
  function resolveGalleryUrl(url) {
    const value = String(url || "").trim();
    if (!value) return "";
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    try {
      return new URL(value.replace(/^\//, ""), global.location.href).href;
    } catch (_) {
      return value;
    }
  }

  global.EcrGalleryUrl = { resolve: resolveGalleryUrl };
})(window);
