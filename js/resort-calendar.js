/**
 * Shared helpers for the public and admin ECR resort event calendar.
 */
window.ResortCalendar = {
  WEEKDAYS: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  MONTHS: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],

  escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  dateKey(year, monthIndex, day) {
    const m = String(monthIndex + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  },

  fromKey(key) {
    const parsed = this.parseDayKey(key);
    if (!parsed) return null;
    const [year, month, day] = parsed.split("-").map(Number);
    return { year, monthIndex: month - 1, day };
  },

  todayKey() {
    const n = new Date();
    return this.dateKey(n.getFullYear(), n.getMonth(), n.getDate());
  },

  addDays(key, delta) {
    const parts = this.fromKey(key);
    if (!parts) return key;
    const dt = new Date(parts.year, parts.monthIndex, parts.day + delta);
    return this.dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
  },

  weekStartKey(key) {
    const parts = this.fromKey(key);
    if (!parts) return key;
    const dt = new Date(parts.year, parts.monthIndex, parts.day);
    dt.setDate(dt.getDate() - dt.getDay());
    return this.dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
  },

  isWeekView() {
    return window.matchMedia("(max-width: 768px)").matches;
  },

  pickUsefulDay(events) {
    const today = this.todayKey();
    if (this.eventsOnDay(events, today).length) return today;
    const next = (events || [])
      .map((ev) => ev.event_date)
      .filter((day) => day && day >= today)
      .sort()[0];
    return next || today;
  },

  formatWeekRange(startKey) {
    const endKey = this.addDays(startKey, 6);
    const start = this.fromKey(startKey);
    const end = this.fromKey(endKey);
    if (!start || !end) return "";
    const startLabel = new Date(
      start.year,
      start.monthIndex,
      start.day
    ).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endLabel = new Date(end.year, end.monthIndex, end.day).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", year: "numeric" }
    );
    return `${startLabel} – ${endLabel}`;
  },

  parseDayKey(key) {
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    return key;
  },

  formatDate(key) {
    const [y, m, d] = String(key || "").split("-").map(Number);
    if (!y || !m || !d) return key || "";
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  },

  formatTime(value) {
    if (!value) return "";
    const part = String(value).slice(0, 5);
    const [hStr, min] = part.split(":");
    let h = Number(hStr);
    if (Number.isNaN(h)) return "";
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${min} ${suffix}`;
  },

  formatTimeRange(event) {
    const start = this.formatTime(event.start_time);
    const end = this.formatTime(event.end_time);
    if (start && end) return `${start} – ${end}`;
    if (start) return start;
    return "All day";
  },

  eventsOnDay(events, key) {
    return (events || []).filter((ev) => ev.event_date === key);
  },

  eventsInMonth(events, year, monthIndex) {
    const prefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
    return (events || [])
      .filter((ev) => String(ev.event_date || "").startsWith(prefix))
      .sort((a, b) => {
        const day = String(a.event_date).localeCompare(String(b.event_date));
        if (day) return day;
        return String(a.start_time || "").localeCompare(String(b.start_time || ""));
      });
  },

  renderMonth({
    year,
    monthIndex,
    events,
    interactive,
    selectedKey,
    todayKey,
    mode,
    weekStartKey,
  }) {
    const today = todayKey || this.todayKey();
    const weekMode = mode === "week";
    const cells = [];
    this.WEEKDAYS.forEach((name) => {
      cells.push(`<span class="resort-cal-dow">${name}</span>`);
    });

    const pushDay = (key, outside) => {
      const parts = this.fromKey(key);
      const dayEvents = this.eventsOnDay(events, key);
      const has = dayEvents.length > 0;
      const selected = selectedKey === key ? " is-selected" : "";
      const marked = has ? " has-event" : "";
      const todayClass = key === today ? " is-today" : "";
      const outsideClass = outside ? " is-outside" : "";
      const titles = dayEvents
        .map((ev) => `<li>${this.escapeHtml(ev.title)}</li>`)
        .join("");
      const todayMark =
        key === today ? `<span class="resort-cal-today-mark">Today</span>` : "";
      const inner = `<span class="resort-cal-numrow"><span class="resort-cal-num">${
        parts ? parts.day : ""
      }</span></span>${todayMark}${
        has ? `<ul class="resort-cal-titles">${titles}</ul>` : ""
      }`;
      const labelParts = [];
      if (key === today) labelParts.push("Today");
      if (has) labelParts.push(dayEvents.map((ev) => ev.title).join(", "));
      else labelParts.push(`Select ${this.formatDate(key)}`);
      const tag = interactive !== false ? "button" : "div";
      const type = tag === "button" ? ` type="button"` : "";
      cells.push(
        `<${tag}${type} class="resort-cal-day${marked}${selected}${todayClass}${outsideClass}" data-day="${key}" aria-label="${this.escapeHtml(
          labelParts.join(". ")
        )}">${inner}</${tag}>`
      );
    };

    if (weekMode) {
      let key = weekStartKey || this.weekStartKey(selectedKey || today);
      for (let i = 0; i < 7; i += 1) {
        const parts = this.fromKey(key);
        const outside = parts && parts.monthIndex !== monthIndex;
        pushDay(key, Boolean(outside));
        key = this.addDays(key, 1);
      }
    } else {
      const first = new Date(year, monthIndex, 1);
      const startPad = first.getDay();
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      for (let i = 0; i < startPad; i += 1) {
        const dt = new Date(year, monthIndex, 1 - (startPad - i));
        pushDay(
          this.dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate()),
          true
        );
      }
      for (let day = 1; day <= daysInMonth; day += 1) {
        pushDay(this.dateKey(year, monthIndex, day), false);
      }
      const filled = startPad + daysInMonth;
      const trailing = (7 - (filled % 7)) % 7;
      for (let i = 1; i <= trailing; i += 1) {
        const dt = new Date(year, monthIndex, daysInMonth + i);
        pushDay(
          this.dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate()),
          true
        );
      }
    }

    return `<div class="resort-cal-frame"><div class="resort-cal-grid">${cells.join(
      ""
    )}</div></div>`;
  },

  renderEventList(events, emptyMessage) {
    if (!events.length) {
      return `<p class="resort-cal-empty">${this.escapeHtml(
        emptyMessage || "Click a date to see event details."
      )}</p>`;
    }
    return `<ul class="resort-cal-list">${events
      .map((ev) => {
        const loc = ev.location
          ? `<p class="resort-cal-meta">${this.escapeHtml(ev.location)}</p>`
          : "";
        const desc = ev.description
          ? `<p>${this.escapeHtml(ev.description)}</p>`
          : "";
        return `<li>
          <h3>${this.escapeHtml(ev.title)}</h3>
          <p class="resort-cal-meta">${this.escapeHtml(this.formatDate(ev.event_date))} · ${this.escapeHtml(
            this.formatTimeRange(ev)
          )}</p>
          ${loc}
          ${desc}
        </li>`;
      })
      .join("")}</ul>`;
  },
};
