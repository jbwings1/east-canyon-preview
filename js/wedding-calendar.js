/**
 * Shared year-grid renderer for the public wedding calendar and admin editor.
 */
window.WeddingCalendar = {
  WEEKDAYS: ["S", "M", "T", "W", "T", "F", "S"],
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
  STATUS_LABELS: {
    booked: "Booked",
    hold: "Hold",
    closed: "Closed",
  },

  escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  dateKey(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  },

  parseDayKey(value) {
    const raw = String(value || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
  },

  mapDays(rows) {
    const map = new Map();
    (rows || []).forEach((row) => {
      const key = this.parseDayKey(row.day);
      if (!key) return;
      map.set(key, {
        status: row.status,
        note: row.note || "",
      });
    });
    return map;
  },

  renderLegend() {
    return `<ul class="wedding-cal-legend">
      <li><span class="wedding-cal-swatch is-available"></span> Available</li>
      <li><span class="wedding-cal-swatch is-booked"></span> Booked</li>
      <li><span class="wedding-cal-swatch is-hold"></span> Hold</li>
      <li><span class="wedding-cal-swatch is-closed"></span> Closed</li>
    </ul>`;
  },

  renderYear(options) {
    const year = Number(options.year);
    const days = options.days instanceof Map ? options.days : this.mapDays(options.days);
    const interactive = Boolean(options.interactive);
    const selectedKey = this.parseDayKey(options.selectedKey);
    const tag = interactive ? "button" : "span";
    const months = this.MONTHS.map((name, monthIndex) => {
      const first = new Date(year, monthIndex, 1);
      const startPad = first.getDay();
      const lastDate = new Date(year, monthIndex + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < startPad; i += 1) {
        cells.push('<span class="wedding-cal-pad"></span>');
      }
      for (let day = 1; day <= lastDate; day += 1) {
        const key = this.dateKey(year, monthIndex, day);
        const entry = days.get(key);
        const status = entry?.status || "";
        const note = entry?.note || "";
        const label = status ? this.STATUS_LABELS[status] || status : "Available";
        const classes = [
          "wedding-cal-day",
          status ? `is-${status}` : "is-available",
          selectedKey === key ? "is-selected" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const title = note ? `${label}: ${note}` : label;
        const extra = interactive
          ? ` type="button" data-wedding-day="${key}"`
          : "";
        cells.push(
          `<${tag} class="${classes}" title="${this.escapeHtml(title)}"${extra}>${day}</${tag}>`
        );
      }
      const dow = this.WEEKDAYS.map(
        (d) => `<span class="wedding-cal-dow">${d}</span>`
      ).join("");
      return `<section class="wedding-cal-month">
        <h3>${name}</h3>
        <div class="wedding-cal-grid">${dow}${cells.join("")}</div>
      </section>`;
    }).join("");
    return `<div class="wedding-cal-year">${months}</div>`;
  },
};
