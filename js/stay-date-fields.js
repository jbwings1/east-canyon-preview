/**
 * Month / Day / Year controls for reservation date fields.
 * The original input keeps its id and stores ISO YYYY-MM-DD so existing
 * .value, min, max, required, and change listeners keep working.
 */
(function () {
  const FIELD_IDS = [
    "res-checkin",
    "res-checkout",
    "occupancy-from",
    "occupancy-to",
    "booking-check-in",
    "booking-check-out",
    "edit-booking-check-in",
    "edit-booking-check-out",
    "report-res-from",
    "report-res-to",
    "report-type-from",
    "report-type-to",
  ];

  const MONTHS = [
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
  ];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function parseIso(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || "").trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(year, month - 1, day);
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
      return null;
    }
    return { year, month, day, iso: `${match[1]}-${match[2]}-${match[3]}` };
  }

  function toIso(year, month, day) {
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  function daysInMonth(year, month) {
    const y = Number(year) || 2024;
    return new Date(y, Number(month), 0).getDate();
  }

  function fieldLabel(input) {
    const label = input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
    if (!label) return "Date";
    const clone = label.cloneNode(true);
    clone.querySelectorAll(".label-optional").forEach((el) => el.remove());
    return (clone.textContent || "Date").replace(/\s+/g, " ").trim() || "Date";
  }

  function enhance(input) {
    if (!input || input.dataset.stayDateReady === "1") return;
    if (input.type !== "date") return;
    input.dataset.stayDateReady = "1";

    const valueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    const minDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "min");
    const maxDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "max");
    const name = fieldLabel(input);
    let internalWrite = false;
    let syncing = false;

    const group = document.createElement("div");
    group.className = "stay-date-field";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", `${name}, month day year`);

    function makePart(part, text) {
      const wrap = document.createElement("label");
      wrap.className = `stay-date-part stay-date-part--${part}`;
      const caption = document.createElement("span");
      caption.textContent = text;
      const select = document.createElement("select");
      select.id = `${input.id}-${part}`;
      select.setAttribute("aria-label", `${name} ${text.toLowerCase()}`);
      select.autocomplete = "off";
      wrap.append(caption, select);
      return { wrap, select };
    }

    const monthPart = makePart("month", "Month");
    const dayPart = makePart("day", "Day");
    const yearPart = makePart("year", "Year");
    group.append(monthPart.wrap, dayPart.wrap, yearPart.wrap);

    const monthSel = monthPart.select;
    const daySel = dayPart.select;
    const yearSel = yearPart.select;

    const blankMonth = new Option("Month", "");
    monthSel.add(blankMonth);
    MONTHS.forEach((label, index) => {
      monthSel.add(new Option(label, String(index + 1)));
    });
    daySel.add(new Option("Day", ""));
    yearSel.add(new Option("Year", ""));

    input.classList.add("stay-date-iso");
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    input.after(group);

    const outerLabel = document.querySelector(`label[for="${input.id}"]`);
    if (outerLabel) outerLabel.htmlFor = monthSel.id;

    function readIso() {
      return valueDesc.get.call(input);
    }

    function bounds() {
      return {
        min: minDesc.get.call(input) || "",
        max: maxDesc.get.call(input) || "",
      };
    }

    function inRange(iso) {
      const { min, max } = bounds();
      if (min && iso < min) return false;
      if (max && iso > max) return false;
      return true;
    }

    function yearAllowed(year) {
      const { min, max } = bounds();
      if (min && `${year}-12-31` < min) return false;
      if (max && `${year}-01-01` > max) return false;
      return true;
    }

    function enabledYears() {
      return [...yearSel.options].filter((opt) => opt.value && !opt.disabled).map((opt) => opt.value);
    }

    function monthFitsYear(year, month) {
      const last = daysInMonth(year, month);
      const firstIso = toIso(year, month, 1);
      const lastIso = toIso(year, month, last);
      const { min, max } = bounds();
      if (min && lastIso < min) return false;
      if (max && firstIso > max) return false;
      return true;
    }

    function monthAllowed(year, month) {
      const years = year ? [year] : enabledYears();
      if (!years.length) return true;
      return years.some((y) => monthFitsYear(y, month));
    }

    function dayAllowed(year, month, day) {
      const years = year ? [year] : enabledYears();
      if (!month || !years.length) return day <= 31;
      return years.some((y) => day <= daysInMonth(y, month) && inRange(toIso(y, month, day)));
    }

    function ensureYear(year) {
      const val = String(year);
      if ([...yearSel.options].some((opt) => opt.value === val)) return;
      const opt = new Option(val, val);
      const others = [...yearSel.options].filter((item) => item.value);
      const before = others.find((item) => Number(item.value) > year);
      yearSel.add(opt, before || null);
    }

    function rebuildYears() {
      const prev = yearSel.value;
      const now = new Date().getFullYear();
      const { min, max } = bounds();
      let start = /^\d{4}/.test(min) ? Number(min.slice(0, 4)) : now - 10;
      let end = /^\d{4}/.test(max) ? Number(max.slice(0, 4)) : now + 5;
      if (end < start) end = start;
      const isoYear = parseIso(readIso())?.year;
      if (isoYear) {
        start = Math.min(start, isoYear);
        end = Math.max(end, isoYear);
      }
      yearSel.replaceChildren(new Option("Year", ""));
      for (let year = start; year <= end; year += 1) {
        const opt = new Option(String(year), String(year));
        opt.disabled = !yearAllowed(year);
        yearSel.add(opt);
      }
      if (prev && [...yearSel.options].some((opt) => opt.value === prev)) {
        yearSel.value = prev;
      }
    }

    function rebuildMonths() {
      const year = yearSel.value;
      [...monthSel.options].forEach((opt) => {
        if (!opt.value) return;
        opt.disabled = !monthAllowed(year, Number(opt.value));
      });
      if (monthSel.selectedOptions[0]?.disabled) monthSel.value = "";
    }

    function rebuildDays() {
      const prev = daySel.value;
      const year = yearSel.value;
      const month = monthSel.value;
      const count = month ? daysInMonth(year, month) : 31;
      daySel.replaceChildren(new Option("Day", ""));
      for (let day = 1; day <= count; day += 1) {
        const opt = new Option(String(day), String(day));
        opt.disabled = !dayAllowed(year, month, day);
        daySel.add(opt);
      }
      if (prev && Number(prev) <= count && !daySel.querySelector(`option[value="${prev}"]`)?.disabled) {
        daySel.value = prev;
      }
    }

    function applyIso(raw) {
      const parsed = parseIso(raw);
      if (!parsed) {
        monthSel.value = "";
        daySel.value = "";
        yearSel.value = "";
        input.setCustomValidity("");
        return;
      }
      ensureYear(parsed.year);
      const yearOpt = [...yearSel.options].find((opt) => opt.value === String(parsed.year));
      if (yearOpt) yearOpt.disabled = false;
      yearSel.value = String(parsed.year);
      rebuildMonths();
      const monthOpt = [...monthSel.options].find((opt) => opt.value === String(parsed.month));
      if (monthOpt) monthOpt.disabled = false;
      monthSel.value = String(parsed.month);
      rebuildDays();
      const dayOpt = [...daySel.options].find((opt) => opt.value === String(parsed.day));
      if (dayOpt) dayOpt.disabled = false;
      daySel.value = String(parsed.day);
      input.setCustomValidity("");
    }

    function refreshOptions() {
      syncing = true;
      const current = readIso();
      rebuildYears();
      rebuildMonths();
      rebuildDays();
      if (current) applyIso(current);
      syncing = false;
    }

    function commit(emitChange) {
      if (syncing) return;
      rebuildMonths();
      rebuildDays();
      const year = yearSel.value;
      const month = monthSel.value;
      const day = daySel.value;
      let next = "";
      if (year && month && day) {
        const iso = toIso(year, month, day);
        const parsed = parseIso(iso);
        if (!parsed) {
          input.setCustomValidity("Enter a real month, day, and year.");
        } else if (!inRange(iso)) {
          input.setCustomValidity("That date is outside the allowed stay range.");
        } else {
          input.setCustomValidity("");
          next = iso;
        }
      } else if (year || month || day) {
        input.setCustomValidity("Enter month, day, and year.");
      } else {
        input.setCustomValidity("");
      }
      const prev = readIso();
      if (prev === next) {
        if (emitChange && next) input.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      internalWrite = true;
      valueDesc.set.call(input, next);
      internalWrite = false;
      if (emitChange) input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    Object.defineProperty(input, "value", {
      configurable: true,
      enumerable: true,
      get() {
        return valueDesc.get.call(input);
      },
      set(v) {
        valueDesc.set.call(input, v == null ? "" : String(v));
        if (!internalWrite) {
          syncing = true;
          applyIso(valueDesc.get.call(input));
          syncing = false;
        }
      },
    });

    Object.defineProperty(input, "min", {
      configurable: true,
      enumerable: true,
      get() {
        return minDesc.get.call(input);
      },
      set(v) {
        minDesc.set.call(input, v);
        refreshOptions();
      },
    });

    Object.defineProperty(input, "max", {
      configurable: true,
      enumerable: true,
      get() {
        return maxDesc.get.call(input);
      },
      set(v) {
        maxDesc.set.call(input, v);
        refreshOptions();
      },
    });

    const originalRemove = input.removeAttribute;
    input.removeAttribute = function (attr) {
      originalRemove.call(input, attr);
      if (attr === "min" || attr === "max") refreshOptions();
    };

    [monthSel, daySel, yearSel].forEach((select) => {
      select.addEventListener("change", () => commit(true));
    });

    input.addEventListener("focus", () => {
      monthSel.focus();
    });

    refreshOptions();
    if (readIso()) {
      syncing = true;
      applyIso(readIso());
      syncing = false;
    }
  }

  function enhanceAll() {
    FIELD_IDS.forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      try {
        enhance(input);
      } catch (err) {
        console.error("Stay date field failed:", id, err);
      }
    });
  }

  // Inputs above this script are already parsed, even while readyState is still "loading".
  if (FIELD_IDS.some((id) => document.getElementById(id))) {
    enhanceAll();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceAll);
  } else {
    enhanceAll();
  }
})();
