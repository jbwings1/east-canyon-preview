/**
 * Public Pictures page — load gallery_images from Supabase and render by section.
 */
(async function () {
  const root = document.getElementById("pictures-root");
  const status = document.getElementById("pictures-status");
  if (!root) return;

  const SECTION_ORDER = [
    "Around the resort",
    "Canyons and seasons",
    "Lodging, courts, and events",
    "From eastcanyon.com",
    "From live-site documents",
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  try {
    if (!window.ecrSupabase) {
      throw new Error("Gallery is temporarily unavailable.");
    }

    const { data, error } = await window.ecrSupabase
      .from("gallery_images")
      .select("id,section,url,alt,sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = data || [];
    if (!rows.length) {
      if (status) {
        status.hidden = false;
        status.textContent = "No pictures are available right now.";
      }
      root.innerHTML = "";
      return;
    }

    const bySection = new Map();
    rows.forEach((row) => {
      if (!bySection.has(row.section)) bySection.set(row.section, []);
      bySection.get(row.section).push(row);
    });

    const orderedSections = [
      ...SECTION_ORDER.filter((s) => bySection.has(s)),
      ...[...bySection.keys()].filter((s) => !SECTION_ORDER.includes(s)),
    ];

    root.innerHTML = orderedSections
      .map((section) => {
        const imgs = bySection
          .get(section)
          .map(
            (img) =>
              `<img src="${escapeHtml(img.url)}" alt="${escapeHtml(
                img.alt || "East Canyon Resort"
              )}" loading="lazy">`
          )
          .join("");
        return `<section class="picture-group">
          <h2>${escapeHtml(section)}</h2>
          <div class="picture-gallery">${imgs}</div>
        </section>`;
      })
      .join("");

    if (status) {
      status.hidden = true;
      status.textContent = "";
    }
  } catch (err) {
    root.innerHTML = "";
    if (status) {
      status.hidden = false;
      status.textContent =
        "Pictures could not be loaded right now. Please try again later.";
    }
    console.error(err);
  }
})();
