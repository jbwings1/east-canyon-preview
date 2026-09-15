/**
 * Admin ECR resort event calendar — add, edit, and remove planned events.
 */
(async function () {
  const me = await AdminCommon.requireAdmin("website");
  if (!me) return;

  const monthLabel = document.getElementById("admin-resort-month");
  const root = document.getElementById("admin-resort-root");
  const listEl = document.getElementById("admin-resort-list");
  const statusEl = document.getElementById("admin-resort-status");
  const form = document.getElementById("admin-resort-form");
  const formResult = document.getElementById("admin-resort-form-result");
  const idInput = document.getElementById("admin-resort-id");
  const titleInput = document.getElementById("admin-resort-title");
  const dateInput = document.getElementById("admin-resort-date");
  const startInput = document.getElementById("admin-resort-start");
  const endInput = document.getElementById("admin-resort-end");
  const locationInput = document.getElementById("admin-resort-location");
  const descInput = document.getElementById("admin-resort-description");
  const formHeading = document.getElementById("admin-resort-form-heading");
  const cancelBtn = document.getElementById("admin-resort-cancel");

  const now = new Date();
  let year = now.getFullYear();
  let monthIndex = now.getMonth();
  let events = [];
  let weekView = window.ResortCalendar.isWeekView();
  let weekStartKey = window.ResortCalendar.weekStartKey(
    window.ResortCalendar.todayKey()
  );
  const prevBtn = document.getElementById("admin-resort-prev");
  const nextBtn = document.getElementById("admin-resort-next");

  function show(el, text, type) {
    AdminCommon.showMessage(el, text, type);
  }

  function clearForm() {
    form.reset();
    if (idInput) idInput.value = "";
    if (formHeading) formHeading.textContent = "Add an event";
    if (cancelBtn) cancelBtn.hidden = true;
  }

  function fillForm(event) {
    idInput.value = event.id;
    titleInput.value = event.title || "";
    dateInput.value = event.event_date || "";
    startInput.value = event.start_time ? String(event.start_time).slice(0, 5) : "";
    endInput.value = event.end_time ? String(event.end_time).slice(0, 5) : "";
    locationInput.value = event.location || "";
    descInput.value = event.description || "";
    if (formHeading) formHeading.textContent = "Edit event";
    if (cancelBtn) cancelBtn.hidden = false;
    titleInput.focus();
  }

  function render() {
    const selectedKey = dateInput?.value || "";
    if (weekView) {
      if (monthLabel) {
        monthLabel.textContent = window.ResortCalendar.formatWeekRange(weekStartKey);
      }
      if (prevBtn) prevBtn.textContent = "Previous week";
      if (nextBtn) nextBtn.textContent = "Next week";
    } else {
      if (monthLabel) {
        monthLabel.textContent = `${window.ResortCalendar.MONTHS[monthIndex]} ${year}`;
      }
      if (prevBtn) prevBtn.textContent = "Previous month";
      if (nextBtn) nextBtn.textContent = "Next month";
    }
    root.innerHTML = window.ResortCalendar.renderMonth({
      year,
      monthIndex,
      events,
      interactive: true,
      selectedKey,
      todayKey: window.ResortCalendar.todayKey(),
      mode: weekView ? "week" : "month",
      weekStartKey,
    });
    const dayEvents = selectedKey
      ? window.ResortCalendar.eventsOnDay(events, selectedKey)
      : [];
    if (!selectedKey) {
      listEl.innerHTML = `<p class="admin-help">Click a date to see or edit that day’s events.</p>`;
      return;
    }
    if (!dayEvents.length) {
      listEl.innerHTML = `<p class="admin-help">No events on this day yet.</p>`;
      return;
    }
    listEl.innerHTML = dayEvents
      .map((ev) => {
        const when = `${window.ResortCalendar.formatDate(ev.event_date)} · ${window.ResortCalendar.formatTimeRange(
          ev
        )}`;
        const loc = ev.location
          ? `<p class="admin-help">${AdminCommon.escapeHtml(ev.location)}</p>`
          : "";
        return `<article class="admin-resort-event" data-id="${AdminCommon.escapeHtml(ev.id)}">
          <h3>${AdminCommon.escapeHtml(ev.title)}</h3>
          <p class="admin-help">${AdminCommon.escapeHtml(when)}</p>
          ${loc}
          <p>
            <button type="button" class="btn-link" data-edit>Edit</button>
            <button type="button" class="btn-link" data-delete>Delete</button>
          </p>
        </article>`;
      })
      .join("");
  }

  async function load() {
    show(statusEl, "Loading…", "");
    const { data, error } = await window.ecrSupabase
      .from("resort_events")
      .select("id,title,event_date,start_time,end_time,location,description")
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    events = data || [];
    if (!dateInput.value) {
      dateInput.value = window.ResortCalendar.pickUsefulDay(events);
    }
    const parts = window.ResortCalendar.fromKey(dateInput.value);
    if (parts) {
      year = parts.year;
      monthIndex = parts.monthIndex;
      weekStartKey = window.ResortCalendar.weekStartKey(dateInput.value);
    }
    show(statusEl, "", "");
    render();
  }

  function step(delta) {
    if (weekView) {
      weekStartKey = window.ResortCalendar.addDays(weekStartKey, delta * 7);
      const parts = window.ResortCalendar.fromKey(weekStartKey);
      year = parts.year;
      monthIndex = parts.monthIndex;
    } else {
      monthIndex += delta;
      if (monthIndex < 0) {
        monthIndex = 11;
        year -= 1;
      } else if (monthIndex > 11) {
        monthIndex = 0;
        year += 1;
      }
      weekStartKey = window.ResortCalendar.weekStartKey(
        window.ResortCalendar.dateKey(year, monthIndex, 1)
      );
    }
    render();
  }

  prevBtn?.addEventListener("click", () => step(-1));
  nextBtn?.addEventListener("click", () => step(1));

  root?.addEventListener("click", (e) => {
    const dayBtn = e.target.closest("[data-day]");
    if (!dayBtn) return;
    dateInput.value = dayBtn.getAttribute("data-day");
    const parts = window.ResortCalendar.fromKey(dateInput.value);
    if (parts) {
      year = parts.year;
      monthIndex = parts.monthIndex;
      weekStartKey = window.ResortCalendar.weekStartKey(dateInput.value);
    }
    render();
  });

  listEl?.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const event = events.find((ev) => ev.id === card.getAttribute("data-id"));
    if (!event) return;
    if (e.target.closest("[data-edit]")) {
      fillForm(event);
      return;
    }
    if (e.target.closest("[data-delete]")) {
      const ok = await AdminCommon.confirmAction({
        title: "Delete event",
        message: `Delete “${event.title}” on ${window.ResortCalendar.formatDate(event.event_date)}?`,
        confirmLabel: "Delete",
      });
      if (!ok) return;
      try {
        const { error } = await window.ecrSupabase
          .from("resort_events")
          .delete()
          .eq("id", event.id);
        if (error) throw error;
        show(formResult, "Event deleted.", "success");
        clearForm();
        await load();
      } catch (err) {
        show(formResult, err.message || String(err), "error");
      }
    }
  });

  cancelBtn?.addEventListener("click", () => {
    clearForm();
    show(formResult, "", "");
    render();
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const event_date = dateInput.value;
    if (!title || !event_date) {
      show(formResult, "Title and date are required.", "error");
      return;
    }
    const row = {
      title,
      event_date,
      start_time: startInput.value || null,
      end_time: endInput.value || null,
      location: locationInput.value.trim() || null,
      description: descInput.value.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: me.id,
    };
    try {
      if (idInput.value) {
        const { error } = await window.ecrSupabase
          .from("resort_events")
          .update(row)
          .eq("id", idInput.value);
        if (error) throw error;
        show(formResult, "Event updated.", "success");
      } else {
        const { error } = await window.ecrSupabase.from("resort_events").insert(row);
        if (error) throw error;
        show(formResult, "Event added.", "success");
      }
      const [y, m] = event_date.split("-").map(Number);
      year = y;
      monthIndex = m - 1;
      clearForm();
      await load();
    } catch (err) {
      show(formResult, err.message || String(err), "error");
    }
  });

  window.matchMedia("(max-width: 768px)").addEventListener("change", (mq) => {
    weekView = mq.matches;
    if (dateInput.value) {
      weekStartKey = window.ResortCalendar.weekStartKey(dateInput.value);
    }
    render();
  });

  try {
    await load();
  } catch (err) {
    show(statusEl, err.message || String(err), "error");
  }
})();
