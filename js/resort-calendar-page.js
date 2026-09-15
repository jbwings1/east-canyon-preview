/**
 * Public ECR resort event calendar.
 */
(async function () {
  const monthLabel = document.getElementById("resort-calendar-month");
  const prevBtn = document.getElementById("resort-calendar-prev");
  const nextBtn = document.getElementById("resort-calendar-next");
  const root = document.getElementById("resort-calendar-root");
  const list = document.getElementById("resort-calendar-list");
  const dayHeading = document.getElementById("resort-calendar-day-heading");
  const pickNote = document.getElementById("resort-calendar-pick-note");
  const status = document.getElementById("resort-calendar-status");
  const back = document.getElementById("resort-cal-back");
  if (!root || !list) return;

  if (back) {
    const ref = document.referrer || "";
    if (/member-home\.html|\/members\.html/i.test(ref)) {
      back.href = "member-home.html";
      back.textContent = "← Members";
    }
  }

  const cal = window.ResortCalendar;
  let year;
  let monthIndex;
  let weekStartKey;
  let events = [];
  let selectedKey = "";
  let autoOpened = true;
  let weekView = cal.isWeekView();

  function showStatus(text, type) {
    if (!status) return;
    status.hidden = !text;
    status.textContent = text || "";
    status.className = type ? `form-message ${type}` : "form-message";
  }

  function showMonth(key) {
    const parts = cal.fromKey(key);
    if (!parts) return;
    year = parts.year;
    monthIndex = parts.monthIndex;
    weekStartKey = cal.weekStartKey(key);
  }

  function updateNavLabels() {
    if (prevBtn) prevBtn.textContent = weekView ? "Previous week" : "Previous month";
    if (nextBtn) nextBtn.textContent = weekView ? "Next week" : "Next month";
    if (!monthLabel) return;
    monthLabel.textContent = weekView
      ? cal.formatWeekRange(weekStartKey)
      : `${cal.MONTHS[monthIndex]} ${year}`;
  }

  function updatePickNote() {
    if (!pickNote) return;
    if (!autoOpened || !selectedKey) {
      pickNote.hidden = true;
      pickNote.textContent = "";
      return;
    }
    const today = cal.todayKey();
    if (selectedKey === today) {
      pickNote.textContent = cal.eventsOnDay(events, today).length
        ? "Opened on today, because there is an event today."
        : "Opened on today.";
    } else {
      pickNote.textContent =
        "Opened on the next scheduled event. Click any other date to look around.";
    }
    pickNote.hidden = false;
  }

  function renderDayDetails() {
    if (!selectedKey) {
      if (dayHeading) dayHeading.textContent = "Event details";
      list.innerHTML = cal.renderEventList(
        [],
        "Click a date on the calendar to see that day’s events."
      );
      return;
    }
    const dayEvents = cal.eventsOnDay(events, selectedKey);
    if (dayHeading) {
      dayHeading.textContent = cal.formatDate(selectedKey);
    }
    list.innerHTML = cal.renderEventList(dayEvents, "No ECR events on this day.");
  }

  function render() {
    updateNavLabels();
    root.innerHTML = cal.renderMonth({
      year,
      monthIndex,
      events,
      interactive: true,
      selectedKey,
      todayKey: cal.todayKey(),
      mode: weekView ? "week" : "month",
      weekStartKey,
    });
    renderDayDetails();
    updatePickNote();
  }

  function step(delta) {
    if (weekView) {
      weekStartKey = cal.addDays(weekStartKey, delta * 7);
      const parts = cal.fromKey(weekStartKey);
      year = parts.year;
      monthIndex = parts.monthIndex;
      const inWeek = [];
      for (let i = 0; i < 7; i += 1) inWeek.push(cal.addDays(weekStartKey, i));
      if (!inWeek.includes(selectedKey)) selectedKey = weekStartKey;
    } else {
      monthIndex += delta;
      if (monthIndex < 0) {
        monthIndex = 11;
        year -= 1;
      } else if (monthIndex > 11) {
        monthIndex = 0;
        year += 1;
      }
      const first = cal.dateKey(year, monthIndex, 1);
      weekStartKey = cal.weekStartKey(first);
      const prefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
      if (!selectedKey.startsWith(prefix)) selectedKey = first;
    }
    autoOpened = false;
    render();
  }

  prevBtn?.addEventListener("click", () => step(-1));
  nextBtn?.addEventListener("click", () => step(1));

  root.addEventListener("click", (e) => {
    const dayBtn = e.target.closest("[data-day]");
    if (!dayBtn) return;
    selectedKey = dayBtn.getAttribute("data-day") || "";
    autoOpened = false;
    showMonth(selectedKey);
    render();
  });

  window.matchMedia("(max-width: 768px)").addEventListener("change", (mq) => {
    weekView = mq.matches;
    if (selectedKey) showMonth(selectedKey);
    render();
  });

  try {
    if (!window.ecrSupabase) {
      throw new Error("Calendar is temporarily unavailable.");
    }
    showStatus("Loading calendar…", "");
    const { data, error } = await window.ecrSupabase
      .from("resort_events")
      .select("id,title,event_date,start_time,end_time,location,description")
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    events = data || [];
    selectedKey = cal.pickUsefulDay(events);
    showMonth(selectedKey);
    showStatus("", "");
    render();
  } catch (err) {
    showStatus(err.message || "Could not load the resort calendar.", "error");
    root.innerHTML = "";
    list.innerHTML = "";
  }
})();
