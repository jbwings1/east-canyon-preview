/**
 * Resolve gallery image URLs for GitHub Pages / local / preview.
 *
 * gallery_images mostly stores relative paths like pix/gallery/foo.jpg.
 * The full gallery lives on the production Pages site (east-canyon-rv-site).
 * Preview/staging forks often omit those large files, so relative pix/ paths
 * always resolve against the canonical asset base. Absolute https URLs
 * (e.g. Supabase Storage) pass through unchanged.
 */
(function (global) {
  var CANONICAL_BASE = "https://jbwings1.github.io/east-canyon-rv-site/";

  function resolveGalleryUrl(url) {
    var value = String(url || "").trim();
    if (!value) return "";
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    try {
      var path = value.replace(/^\//, "").replace(/\\/g, "/");
      if (/^pix\//i.test(path)) {
        return new URL(path, CANONICAL_BASE).href;
      }
      return new URL(path, global.location.href).href;
    } catch (_) {
      return value;
    }
  }

  global.EcrGalleryUrl = { resolve: resolveGalleryUrl };
})(window);
