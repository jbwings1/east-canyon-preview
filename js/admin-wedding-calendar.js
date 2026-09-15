/**
 * Admin wedding calendar — mark days booked / hold / closed, edit the public note.
 */
(async function () {
  const me = await AdminCommon.requireAdmin("website");
  if (!me) return;

  const yearLabel = document.getElementById("admin-cal-year");
  const root = document.getElementById("admin-cal-root");
  const statusEl = document.getElementById("admin-cal-status");
  const selectedLabel = document.getElementById("admin-cal-selected-label");
  const statusSelect = document.getElementById("admin-cal-status");
  const noteInput = document.getElementById("admin-cal-note");
  const dayForm = document.getElementById("admin-cal-day-form");
  const rangeForm = document.getElementById("admin-cal-range-form");
  const settingsForm = document.getElementById("admin-cal-settings-form");
  const headingInput = document.getElementById("admin-cal-heading");
  const publicNoteInput = document.getElementById("admin-cal-public-note");
  const displayYearInput = document.getElementById("admin-cal-display-year");
  const dayResult = document.getElementById("admin-cal-day-result");
  const rangeResult = document.getElementById("admin-cal-range-result");
  const settingsResult = document.getElementById("admin-cal-settings-result");

  let year = new Date().getFullYear();
  let selectedKey = "";
  let days = new Map();

  function show(el, text, type) {
    AdminCommon.showMessage(el, text, type);
  }

  function render() {
    if (yearLabel) yearLabel.textContent = String(year);
    if (displayYearInput && !displayYearInput.value) {
      displayYearInput.value = String(year);
    }
    root.innerHTML = window.WeddingCalendar.renderYear({
      year,
      days,
      interactive: true,
      selectedKey,
    });
    if (selectedLabel) {
      selectedLabel.textContent = selectedKey
        ? selectedKey
        : "Click a date on the calendar.";
    }
  }

  async function load() {
    show(statusEl, "Loading…", "");
    const [settingsRes, daysRes] = await Promise.all([
      window.ecrSupabase
        .from("wedding_calendar_settings")
        .select("heading,note,display_year")
        .eq("id", "default")
        .maybeSingle(),
      window.ecrSupabase.from("wedding_calendar_days").select("day,status,note"),
    ]);
    if (settingsRes.error) throw settingsRes.error;
    if (daysRes.error) throw daysRes.error;
    const settings = settingsRes.data || {};
    year = Number(settings.display_year) || year;
    if (headingInput) {
      const stored = (settings.heading || "").trim();
      headingInput.value =
        !stored ||
        stored === "Wedding Calendar" ||
        stored.toLowerCase() === "live wedding calendar"
          ? "Booking calendar"
          : stored;
    }
    if (publicNoteInput) publicNoteInput.value = settings.note || "";
    if (displayYearInput) displayYearInput.value = String(year);
    days = window.WeddingCalendar.mapDays(daysRes.data);
    show(statusEl, "", "");
    render();
  }

  function keysInRange(start, end) {
    const a = window.WeddingCalendar.parseDayKey(start);
    const b = window.WeddingCalendar.parseDayKey(end);
    if (!a || !b) return [];
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const [ys, ms, ds] = lo.split("-").map(Number);
    const [ye, me, de] = hi.split("-").map(Number);
    const cur = new Date(ys, ms - 1, ds);
    const last = new Date(ye, me - 1, de);
    const keys = [];
    while (cur <= last) {
      keys.push(window.WeddingCalendar.dateKey(cur.getFullYear(), cur.getMonth(), cur.getDate()));
      cur.setDate(cur.getDate() + 1);
    }
    return keys;
  }

  async function saveDays(keys, status, note) {
    if (!keys.length) return;
    if (!status || status === "available") {
      const { error } = await window.ecrSupabase
        .from("wedding_calendar_days")
        .delete()
        .in("day", keys);
      if (error) throw error;
      keys.forEach((key) => days.delete(key));
      return;
    }
    const rows = keys.map((key) => ({
      day: key,
      status,
      note: note || null,
      updated_at: new Date().toISOString(),
      updated_by: me.id,
    }));
    const { error } = await window.ecrSupabase
      .from("wedding_calendar_days")
      .upsert(rows, { onConflict: "day" });
    if (error) throw error;
    keys.forEach((key) => days.set(key, { status, note: note || "" }));
  }

  document.getElementById("admin-cal-prev")?.addEventListener("click", () => {
    year -= 1;
    render();
  });
  document.getElementById("admin-cal-next")?.addEventListener("click", () => {
    year += 1;
    render();
  });

  root?.addEventListener("click", (event) => {
    const btn = event.target?.closest?.("[data-wedding-day]");
    if (!btn) return;
    selectedKey = btn.getAttribute("data-wedding-day");
    const entry = days.get(selectedKey);
    if (statusSelect) statusSelect.value = entry?.status || "available";
    if (noteInput) noteInput.value = entry?.note || "";
    const start = document.getElementById("admin-cal-range-start");
    const end = document.getElementById("admin-cal-range-end");
    if (start && !start.value) start.value = selectedKey;
    if (end) end.value = selectedKey;
    render();
  });

  dayForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedKey) {
      show(dayResult, "Click a date first.", "error");
      return;
    }
    try {
      await saveDays(
        [selectedKey],
        statusSelect.value,
        noteInput.value.trim()
      );
      show(dayResult, "Date updated.", "success");
      render();
    } catch (err) {
      show(dayResult, err.message || "Could not save that date.", "error");
    }
  });

  rangeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const start = document.getElementById("admin-cal-range-start")?.value;
    const end = document.getElementById("admin-cal-range-end")?.value;
    const status = document.getElementById("admin-cal-range-status")?.value;
    const note = document.getElementById("admin-cal-range-note")?.value.trim();
    const keys = keysInRange(start, end);
    if (!keys.length) {
      show(rangeResult, "Enter a start and end date.", "error");
      return;
    }
    try {
      await saveDays(keys, status, note);
      show(
        rangeResult,
        `Updated ${keys.length} day${keys.length === 1 ? "" : "s"}.`,
        "success"
      );
      render();
    } catch (err) {
      show(rangeResult, err.message || "Could not update that range.", "error");
    }
  });

  settingsForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const displayYear = Number(displayYearInput.value);
    if (displayYear < 2020 || displayYear > 2100) {
      show(settingsResult, "Enter a year between 2020 and 2100.", "error");
      return;
    }
    try {
      const { error } = await window.ecrSupabase
        .from("wedding_calendar_settings")
        .upsert({
          id: "default",
          heading: headingInput.value.trim() || "Booking calendar",
          note: publicNoteInput.value.trim(),
          display_year: displayYear,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      year = displayYear;
      show(settingsResult, "Public calendar settings saved.", "success");
      render();
    } catch (err) {
      show(settingsResult, err.message || "Could not save settings.", "error");
    }
  });

  try {
    await load();
  } catch (err) {
    show(statusEl, err.message || "Could not load the calendar.", "error");
  }
})();
