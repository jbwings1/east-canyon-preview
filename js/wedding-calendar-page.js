/**
 * Public wedding calendar — load settings and marked days from Supabase.
 */
(async function () {
  const root = document.getElementById("wedding-calendar-root");
  const status = document.getElementById("wedding-calendar-status");
  const heading = document.getElementById("wedding-calendar-heading");
  const note = document.getElementById("wedding-calendar-note");
  const yearLabel = document.getElementById("wedding-calendar-year");
  const prevBtn = document.getElementById("wedding-calendar-prev");
  const nextBtn = document.getElementById("wedding-calendar-next");
  if (!root || !window.WeddingCalendar) return;

  function showStatus(text, isError) {
    if (!status) return;
    status.hidden = !text;
    status.textContent = text || "";
    status.className = isError ? "form-message error" : "form-message";
  }

  function yearFromQuery() {
    const raw = new URLSearchParams(window.location.search).get("year");
    const year = Number(raw);
    return year >= 2020 && year <= 2100 ? year : null;
  }

  let year = yearFromQuery();
  let settings = null;
  let days = new Map();

  function render() {
    if (yearLabel) yearLabel.textContent = String(year);
    root.innerHTML = window.WeddingCalendar.renderYear({ year, days });
  }

  function setYear(next) {
    year = next;
    const url = new URL(window.location.href);
    url.searchParams.set("year", String(year));
    window.history.replaceState({}, "", url);
    render();
  }

  prevBtn?.addEventListener("click", () => setYear(year - 1));
  nextBtn?.addEventListener("click", () => setYear(year + 1));

  try {
    if (!window.ecrSupabase) {
      throw new Error("Calendar is temporarily unavailable.");
    }
    const [settingsRes, daysRes] = await Promise.all([
      window.ecrSupabase
        .from("wedding_calendar_settings")
        .select("heading,note,display_year")
        .eq("id", "default")
        .maybeSingle(),
      window.ecrSupabase
        .from("wedding_calendar_days")
        .select("day,status,note"),
    ]);
    if (settingsRes.error) throw settingsRes.error;
    if (daysRes.error) throw daysRes.error;

    settings = settingsRes.data || {};
    if (!year) {
      year = Number(settings.display_year) || new Date().getFullYear();
    }
    if (heading) {
      const stored = (settings.heading || "").trim();
      heading.textContent =
        !stored ||
        stored === "Wedding Calendar" ||
        stored.toLowerCase() === "live wedding calendar"
          ? "Booking calendar"
          : stored;
    }
    if (note) {
      note.textContent =
        settings.note ||
        "Dates marked booked or on hold are not available. Contact Special Events to confirm.";
    }
    days = window.WeddingCalendar.mapDays(daysRes.data);
    showStatus("");
    render();
  } catch (err) {
    console.error("Wedding calendar:", err);
    showStatus(err.message || "Could not load the booking calendar.", true);
    root.innerHTML = "";
  }
})();
