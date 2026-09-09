/** Populate site dropdown and init map in alignment mode. */
(function () {
  const select = document.getElementById("map-edit-site");
  if (select && select.options.length <= 1) {
    select.innerHTML = Array.from({ length: 81 }, (_, i) => {
      const n = i + 1;
      return `<option value="${n}">${n}</option>`;
    }).join("");
  }

  CampgroundMap.init({
    layerId: "spots-layer",
    detailId: "spot-detail",
    svgId: "campground-map",
    photoId: "campground-map-photo",
    unitFilter: "rv",
  });
})();
