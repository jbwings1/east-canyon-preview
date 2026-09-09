(function () {
  const STORAGE_KEY = "ecr-map-align-progress";

  const ALIGN_MODES = {
    rv: {
      filter: "rv",
      unitLabel: "Site",
      downloadName: "rv-spot-coordinates.json",
      prompt:
        "Pick an RV site, then drag each <strong>blue corner</strong> to match the yellow pad. Drag inside the shape to move the whole spot.",
      sort(a, b) {
        return Number(a.id) - Number(b.id);
      },
      optionLabel(unit) {
        return `Site ${unit.label}`;
      },
      outputLabel(unit) {
        return `Site ${unit.id}`;
      },
    },
    condo: {
      filter: "condo",
      unitLabel: "Condo",
      downloadName: "condo-coordinates.json",
      prompt:
        "Pick a condo unit, then drag each <strong>blue corner</strong> to match the brown box on the map. <strong>Scroll right</strong> — condos are on the east side near buildings 10–16.",
      sort(a, b) {
        return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
      },
      optionLabel(unit) {
        return unit.label;
      },
      outputLabel(unit) {
        return `Condo ${unit.label}`;
      },
    },
    reunion: {
      filter: "reunion",
      unitLabel: "Family site",
      downloadName: "reunion-coordinates.json",
      prompt:
        "Pick a family reunion site, then drag each <strong>blue corner</strong> to outline the group area on the map. Drag inside the shape to move the whole site.",
      sort(a, b) {
        return Number(a.label) - Number(b.label);
      },
      optionLabel(unit) {
        return `Family site ${unit.label}`;
      },
      outputLabel(unit) {
        return unit.name || `Family site ${unit.label}`;
      },
    },
  };

  let currentMode = "rv";

  const select = document.getElementById("map-edit-site");
  const promptEl = document.getElementById("align-prompt");
  const unitLabelEl = document.getElementById("align-unit-label");
  const applyCommandEl = document.getElementById("apply-command");

  CampgroundMap.init({
    layerId: "spots-layer",
    handlesLayerId: "handles-layer",
    detailId: null,
    svgId: "campground-map",
    photoId: "campground-map-photo",
    unitFilter: "rv",
    onAlignChange: (siteId, unit) => {
      if (siteId && select) select.value = siteId;
      if (unit) saveUnitCoords(unit);
      updateOutput(unit || getSelectedUnit());
    },
  });

  function getModeConfig(mode = currentMode) {
    return ALIGN_MODES[mode] || ALIGN_MODES.rv;
  }

  function getUnitsForMode(mode = currentMode) {
    const filter = getModeConfig(mode).filter;
    return (window.MAP_UNITS || [])
      .filter((u) => u.category === filter)
      .sort(getModeConfig(mode).sort);
  }

  function getSelectedUnit() {
    const id = select?.value || CampgroundMap.getAlignSelected();
    return window.SpotAvailability?.findUnit(String(id));
  }

  function ensurePoints(unit) {
    if (!unit) return;
    if (!unit.points || unit.points.length !== 4) {
      unit.points = CampgroundMap.getUnitPoints(unit).map((p) => [p[0], p[1]]);
    }
  }

  function populateSelect(mode = currentMode) {
    const units = getUnitsForMode(mode);
    const cfg = getModeConfig(mode);
    if (!select) return;
    select.innerHTML = units
      .map((unit) => `<option value="${unit.id}">${cfg.optionLabel(unit)}</option>`)
      .join("");
    if (unitLabelEl) unitLabelEl.textContent = cfg.unitLabel;
    if (promptEl) promptEl.innerHTML = cfg.prompt;
    if (applyCommandEl) applyCommandEl.textContent = `node scripts/apply-coordinates.js ${cfg.downloadName}`;
  }

  function isValidSavedPoints(points) {
    if (!points || points.length !== 4) return false;
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    if (w < 4 || h < 4) return false;
    if (Math.min(...xs) < -20 || Math.min(...ys) < -20) return false;
    if (Math.max(...xs) > 1050 || Math.max(...ys) > 820) return false;
    return true;
  }

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      Object.entries(saved).forEach(([id, coords]) => {
        const unit = window.SpotAvailability?.findUnit(id);
        if (!unit || !coords) return;
        if (coords.x != null) unit.x = coords.x;
        if (coords.y != null) unit.y = coords.y;
        if (coords.w != null) unit.w = coords.w;
        if (coords.h != null) unit.h = coords.h;
        if (coords.points && isValidSavedPoints(coords.points)) {
          unit.points = coords.points.map((p) => [p[0], p[1]]);
        } else {
          delete unit.points;
        }
        CampgroundMap.syncRectFromPoints(unit);
      });
      CampgroundMap.render();
    } catch (_) {
      /* ignore */
    }
  }

  function saveUnitCoords(unit) {
    ensurePoints(unit);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    saved[unit.id] = {
      x: unit.x,
      y: unit.y,
      w: unit.w,
      h: unit.h,
      points: unit.points.map((p) => [p[0], p[1]]),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }

  function updateOutput(unit) {
    const output = document.getElementById("map-edit-output");
    if (!output || !unit) return;
    ensurePoints(unit);
    const cfg = getModeConfig();
    output.textContent = `${cfg.outputLabel(unit)} — drag each corner:\n${JSON.stringify(unit.points, null, 2)}`;
  }

  function selectUnit(id) {
    const unit = window.SpotAvailability?.findUnit(String(id));
    if (!unit) return;
    ensurePoints(unit);
    if (select) select.value = String(id);
    CampgroundMap.setAlignSelected(String(id));
    updateOutput(unit);
    window.requestAnimationFrame(() => CampgroundMap.scrollUnitIntoView(unit));
  }

  function selectByIndex(index) {
    const units = getUnitsForMode();
    if (!units.length) return;
    const clamped = Math.max(0, Math.min(units.length - 1, index));
    selectUnit(units[clamped].id);
  }

  function setMode(mode) {
    if (!ALIGN_MODES[mode]) return;
    currentMode = mode;
    document.querySelectorAll(".map-align-mode-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.mode === mode);
    });
    document.body.dataset.alignMode = mode;
    populateSelect(mode);
    CampgroundMap.setUnitFilter(getModeConfig(mode).filter);
    const units = getUnitsForMode(mode);
    if (units.length) {
      const current = getSelectedUnit();
      const keepCurrent = current && current.category === getModeConfig(mode).filter;
      selectUnit(keepCurrent ? current.id : units[0].id);
    } else {
      CampgroundMap.setAlignSelected(null);
    }
  }

  select?.addEventListener("change", () => {
    selectUnit(select.value);
  });

  document.getElementById("align-prev")?.addEventListener("click", () => {
    const units = getUnitsForMode();
    const idx = units.findIndex((u) => u.id === select?.value);
    selectByIndex(idx <= 0 ? 0 : idx - 1);
  });

  document.getElementById("align-next")?.addEventListener("click", () => {
    const units = getUnitsForMode();
    const idx = units.findIndex((u) => u.id === select?.value);
    selectByIndex(idx < 0 ? 0 : idx + 1);
  });

  document.getElementById("align-reset-box")?.addEventListener("click", () => {
    const unit = getSelectedUnit();
    if (!unit) return;
    delete unit.points;
    unit.points = CampgroundMap.getUnitPoints(unit).map((p) => [p[0], p[1]]);
    CampgroundMap.syncRectFromPoints(unit);
    saveUnitCoords(unit);
    CampgroundMap.render();
    updateOutput(unit);
  });

  document.getElementById("map-copy-coords")?.addEventListener("click", () => {
    const unit = getSelectedUnit();
    if (!unit) return;
    ensurePoints(unit);
    navigator.clipboard?.writeText(JSON.stringify(unit.points, null, 2));
  });

  document.getElementById("map-download-json")?.addEventListener("click", () => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const cfg = getModeConfig();
    const payload = getUnitsForMode().map((u) => {
      const c = saved[u.id];
      const points =
        c?.points ||
        CampgroundMap.getUnitPoints(u)?.map((p) => [Math.round(p[0]), Math.round(p[1])]);
      return {
        id: u.id,
        x: c?.x ?? u.x,
        y: c?.y ?? u.y,
        w: c?.w ?? u.w,
        h: c?.h ?? u.h,
        points,
      };
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = cfg.downloadName;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.querySelectorAll(".map-align-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  document.getElementById("map-apply-help")?.addEventListener("click", () => {
    const el = document.getElementById("apply-help");
    if (el) el.hidden = !el.hidden;
  });

  function setupPanelDrag() {
    const panel = document.getElementById("map-edit-toolbar");
    const handle = document.getElementById("map-align-drag-handle");
    if (!panel || !handle) return;

    const STORAGE_PANEL_KEY = "ecr-map-align-panel-pos";

    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_PANEL_KEY) || "null");
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
        panel.style.left = `${saved.left}px`;
        panel.style.top = `${saved.top}px`;
        panel.style.right = "auto";
        panel.style.bottom = "auto";
      }
    } catch (_) {
      /* ignore */
    }

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const clampPosition = (left, top) => {
      const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
      return {
        left: Math.min(maxLeft, Math.max(8, left)),
        top: Math.min(maxTop, Math.max(8, top)),
      };
    };

    const savePosition = () => {
      localStorage.setItem(
        STORAGE_PANEL_KEY,
        JSON.stringify({
          left: parseInt(panel.style.left, 10),
          top: parseInt(panel.style.top, 10),
        })
      );
    };

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      dragging = true;
      panel.classList.add("is-dragging");

      const rect = panel.getBoundingClientRect();
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";

      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const next = clampPosition(startLeft + (event.clientX - startX), startTop + (event.clientY - startY));
      panel.style.left = `${next.left}px`;
      panel.style.top = `${next.top}px`;
    });

    const endDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove("is-dragging");
      savePosition();
      if (event.pointerId != null) {
        try {
          handle.releasePointerCapture(event.pointerId);
        } catch (_) {
          /* ignore */
        }
      }
    };

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }

  setupPanelDrag();
  loadProgress();
  setMode("rv");
})();
