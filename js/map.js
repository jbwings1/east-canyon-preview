CampgroundMap.init({
  layerId: "spots-layer",
  detailId: "spot-detail",
  svgId: "campground-map",
  photoId: "campground-map-photo",
});

const params = new URLSearchParams(window.location.search);
const checkIn = params.get("checkIn");
const checkOut = params.get("checkOut");
const highlightSpot = params.get("spot");

if (checkIn && checkOut) {
  CampgroundMap.setDates(checkIn, checkOut);
}

if (highlightSpot) {
  CampgroundMap.selectSpot(highlightSpot);
}
