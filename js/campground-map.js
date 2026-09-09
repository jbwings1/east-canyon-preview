const STATUS_COLORS = {
  available: { fill: "#4a9b6e", stroke: "#3d8060" },
  partial: { fill: "#e6b800", stroke: "#b89200" },
  booked: { fill: "#c0392b", stroke: "#922b21" },
  tooShort: { fill: "#1a1a1a", stroke: "#000000" },
  member: { fill: "#4a7a9b", stroke: "#3d6580" },
  maintenance: { fill: "#c45c26", stroke: "#9a4518" },
  unknown: { fill: "#c8c4be", stroke: "#a8a4a0" },
};

window.CampgroundMap = {
  _selectedId: null,
  _focusedId: null,
  _checkIn: "",
  _checkOut: "",
  _availabilityExclude: {},
  _rigLength: null,
  _unitFilter: "all",
  _layer: null,
  _svg: null,
  _photo: null,
  _detailPanel: null,
  _legendRoot: null,
  _onSpotSelect: null,
  _onUnitFocus: null,
  _viewWidth: window.MAP_CONFIG?.baseWidth || 1013,
  _viewHeight: window.MAP_CONFIG?.baseHeight || 782,
  _imageReady: false,
  _requireDatesForSpots: false,
  _lookupOnly: false,
  _hoveredId: null,
  _hoveredStatus: null,
  _overlayShell: null,
  _overlayBound: false,

  init({
    layerId,
    detailId,
    svgId,
    photoId,
    legendId,
    handlesLayerId,
    onSpotSelect,
    onUnitFocus,
    onAlignChange,
    canBookSelect,
    requireDatesForSpots = false,
    lookupOnly = false,
    unitFilter = "all",
  }) {
    this._layer = document.getElementById(layerId);
    this._handlesLayer = handlesLayerId ? document.getElementById(handlesLayerId) : null;
    this._svg = document.getElementById(svgId || "campground-map");
    this._photo = document.getElementById(photoId || "campground-map-photo");
    this._detailPanel = detailId ? document.getElementById(detailId) : null;
    this._overlayShell = this._detailPanel?.closest(".map-site-overlay-shell") || null;
    this._legendRoot = legendId
      ? document.getElementById(legendId)
      : this._svg?.closest(".map-panel")?.querySelector(".map-legend") || null;
    this._onSpotSelect = onSpotSelect || null;
    this._onUnitFocus = onUnitFocus || null;
    this._onAlignChange = onAlignChange || null;
    this._canBookSelect = canBookSelect || null;
    this._alignSelectedId = null;
    this._requireDatesForSpots = requireDatesForSpots;
    this._lookupOnly = !!lookupOnly;
    this._unitFilter = unitFilter;

    if (this._lookupOnly && this._legendRoot) {
      this._legendRoot.querySelectorAll('.legend-item[data-status="partial"]').forEach((el) => {
        el.hidden = true;
      });
    }

    if (!this._layer || !this._svg) return;

    this._setupMapImage();
    this._setupEditMode();
    this._setupMapClickFallback();
    this._bindOverlayChrome();
    this.clearSelection();
  },

  _usesDetailOverlay() {
    return Boolean(
      this._detailPanel?.classList.contains("map-site-overlay") ||
        this._detailPanel?.closest(".map-site-overlay-shell") ||
        this._overlayShell
    );
  },

  _bindOverlayChrome() {
    if (this._overlayBound || !this._usesDetailOverlay()) return;
    this._overlayBound = true;
    this._overlayShell =
      this._overlayShell || this._detailPanel?.closest(".map-site-overlay-shell") || null;

    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (!this._isDetailOverlayOpen()) return;
      e.preventDefault();
      this.closeDetailOverlay({ clearSelection: this._lookupOnly });
    };
    document.addEventListener("keydown", onKey);

    const backdrop = this._overlayShell?.querySelector(".map-site-overlay-backdrop");
    backdrop?.addEventListener("click", () => {
      this.closeDetailOverlay({ clearSelection: this._lookupOnly });
    });

    this._detailPanel?.addEventListener("click", (e) => {
      if (e.target.closest("[data-map-detail-close]")) {
        e.preventDefault();
        this.closeDetailOverlay({ clearSelection: this._lookupOnly });
      }
    });
  },

  _detailOverlayShell() {
    return (
      this._overlayShell ||
      this._detailPanel?.closest(".map-site-overlay-shell") ||
      null
    );
  },

  _isDetailOverlayOpen() {
    const shell = this._detailOverlayShell();
    if (shell) return !shell.hidden;
    return Boolean(this._detailPanel && !this._detailPanel.hidden);
  },

  openDetailOverlay() {
    if (!this._detailPanel) return;
    const shell = this._detailOverlayShell();
    if (shell) shell.hidden = false;
    this._detailPanel.hidden = false;
    const closeBtn = this._detailPanel.querySelector("[data-map-detail-close]");
    if (closeBtn && typeof closeBtn.focus === "function") {
      try {
        closeBtn.focus({ preventScroll: true });
      } catch {
        closeBtn.focus();
      }
    }
  },

  closeDetailOverlay({ clearSelection = false } = {}) {
    const shell = this._detailOverlayShell();
    if (shell) shell.hidden = true;
    if (this._detailPanel) {
      this._detailPanel.hidden = true;
      this._detailPanel.innerHTML = "";
    }
    if (clearSelection) {
      this._selectedId = null;
      this._focusedId = null;
      document.querySelectorAll(".map-spot").forEach((el) => {
        el.classList.remove("selected", "focused");
      });
    }
  },

  _overlayCloseHtml() {
    if (!this._usesDetailOverlay()) return "";
    return `<div class="map-site-overlay-head">
      <button type="button" class="map-site-overlay-close" data-map-detail-close>Close</button>
    </div>`;
  },

  _setupMapImage() {
    const cfg = window.MAP_CONFIG;
    const frame = this._svg.closest(".campground-map-frame") || this._svg.closest(".map-scroll");
    const fallback = frame?.querySelector(".map-image-fallback");

    if (this._photo) {
      const onReady = () => {
        this._viewWidth = this._photo.naturalWidth || cfg?.baseWidth || 1013;
        this._viewHeight = this._photo.naturalHeight || cfg?.baseHeight || 782;
        this._imageReady = true;
        if (fallback) fallback.hidden = true;
        this._applyViewBox();
        this.render();
      };

      if (this._photo.complete && this._photo.naturalWidth) {
        onReady();
      } else {
        this._photo.addEventListener("load", onReady, { once: true });
        this._photo.addEventListener(
          "error",
          () => {
            this._imageReady = true;
            if (fallback) fallback.hidden = false;
            this._applyViewBox();
            this.render();
          },
          { once: true }
        );
      }
      return;
    }

    if (!cfg?.image) {
      this._imageReady = true;
      this._applyViewBox();
      this.render();
      return;
    }

    const probe = new Image();
    probe.onload = () => {
      this._viewWidth = probe.naturalWidth;
      this._viewHeight = probe.naturalHeight;
      this._imageReady = true;

      const imageEl = document.createElementNS("http://www.w3.org/2000/svg", "image");
      imageEl.setAttributeNS("http://www.w3.org/1999/xlink", "href", cfg.image);
      imageEl.setAttribute("href", cfg.image);
      imageEl.setAttribute("x", "0");
      imageEl.setAttribute("y", "0");
      imageEl.setAttribute("width", String(this._viewWidth));
      imageEl.setAttribute("height", String(this._viewHeight));

      const bgLayer = this._svg.querySelector("#map-image-layer");
      if (bgLayer) {
        bgLayer.innerHTML = "";
        bgLayer.appendChild(imageEl);
      }

      if (fallback) fallback.hidden = true;
      this._applyViewBox();
      this.render();
    };

    probe.onerror = () => {
      this._imageReady = true;
      if (fallback) fallback.hidden = false;
      this._applyViewBox();
      this.render();
    };

    probe.src = cfg.image;
  },

  _applyViewBox() {
    this._svg.setAttribute("viewBox", `0 0 ${this._viewWidth} ${this._viewHeight}`);
    this._svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  },

  _baseDimensions() {
    const cfg = window.MAP_CONFIG;
    return {
      baseW: cfg?.baseWidth || this._viewWidth,
      baseH: cfg?.baseHeight || this._viewHeight,
    };
  },

  _scaleFactors() {
    const { baseW, baseH } = this._baseDimensions();
    return {
      scaleX: this._viewWidth / baseW,
      scaleY: this._viewHeight / baseH,
    };
  },

  _scaleUnit(unit) {
    const { scaleX, scaleY } = this._scaleFactors();
    return {
      ...unit,
      x: unit.x * scaleX,
      y: unit.y * scaleY,
      w: unit.w * scaleX,
      h: unit.h * scaleY,
    };
  },

  _unscalePoint(x, y) {
    const { baseW, baseH } = this._baseDimensions();
    return {
      x: Math.round(x * (baseW / this._viewWidth)),
      y: Math.round(y * (baseH / this._viewHeight)),
    };
  },

  _rectToPoints(unit) {
    return [
      [unit.x, unit.y],
      [unit.x + unit.w, unit.y],
      [unit.x + unit.w, unit.y + unit.h],
      [unit.x, unit.y + unit.h],
    ];
  },

  getUnitPoints(unit) {
    if (unit.points && unit.points.length === 4) {
      return unit.points.map((p) => [p[0], p[1]]);
    }
    if (unit.x != null && unit.y != null && unit.w != null && unit.h != null) {
      return this._rectToPoints(unit);
    }
    return null;
  },

  _scalePoints(points) {
    const { scaleX, scaleY } = this._scaleFactors();
    return points.map(([x, y]) => [x * scaleX, y * scaleY]);
  },

  syncRectFromPoints(unit) {
    const points = this.getUnitPoints(unit);
    if (!points) return;
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    unit.x = Math.min(...xs);
    unit.y = Math.min(...ys);
    unit.w = Math.max(...xs) - unit.x;
    unit.h = Math.max(...ys) - unit.y;
  },

  _pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  },

  _unitBounds(points) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return { minX, minY, maxX: Math.max(...xs), maxY: Math.max(...ys), w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
  },

  getUnitScreenBounds(unit) {
    const points = this.getUnitPoints(unit);
    if (!points || !this._svg) return null;
    const scaled = this._scalePoints(points);
    const bounds = this._unitBounds(scaled);
    const frame = this._svg.closest(".campground-map-frame");
    if (!frame) return null;

    const vb = this._svg.viewBox.baseVal;
    const scaleX = frame.clientWidth / (vb.width || this._viewWidth);
    const scaleY = frame.clientHeight / (vb.height || this._viewHeight);

    return {
      left: bounds.minX * scaleX,
      top: bounds.minY * scaleY,
      width: bounds.w * scaleX,
      height: bounds.h * scaleY,
      centerX: (bounds.minX + bounds.w / 2) * scaleX,
      centerY: (bounds.minY + bounds.h / 2) * scaleY,
    };
  },

  scrollUnitIntoView(unitOrId) {
    const unit =
      typeof unitOrId === "string" ? window.SpotAvailability?.findUnit(unitOrId) : unitOrId;
    if (!unit) return;

    const bounds = this.getUnitScreenBounds(unit);
    if (!bounds) return;

    const stage =
      this._svg.closest(".map-align-stage") ||
      this._svg.closest(".reservation-map-viewport") ||
      this._svg.closest(".map-scroll");
    if (!stage) return;

    const targetLeft = Math.max(0, bounds.centerX - stage.clientWidth / 2);
    const targetTop = Math.max(0, bounds.centerY - stage.clientHeight / 2);
    stage.scrollTo({ left: targetLeft, top: targetTop, behavior: "smooth" });
  },

  _isAlignCornerMode() {
    return document.body.classList.contains("page-map-align");
  },

  setAlignSelected(id) {
    this._alignSelectedId = id ? String(id) : null;
    this.render();
    if (this._onAlignChange) this._onAlignChange(this._alignSelectedId);
  },

  getAlignSelected() {
    return this._alignSelectedId || null;
  },

  _hasValidDates() {
    return Boolean(this._checkIn && this._checkOut && this._checkOut > this._checkIn);
  },

  _getUnits() {
    const all = window.MAP_UNITS || window.CAMPGROUND_SPOTS || [];
    if (this._unitFilter === "all") return all;
    return all.filter((u) => u.category === this._unitFilter);
  },

  _isEditMode() {
    if (document.body.classList.contains("page-map-edit")) return true;
    if (document.body.classList.contains("page-map-align")) return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mapEdit") === "1") return true;
    return window.location.hash === "#mapEdit";
  },

  _setupEditMode() {
    if (!this._isEditMode()) return;

    const panel = this._svg.closest(".map-panel") || this._svg.closest(".map-align-stage") || document.body;

    const clickTarget = this._photo || this._svg;
    clickTarget.style.cursor = this._isAlignCornerMode() ? "default" : "crosshair";

    if (!document.getElementById("map-edit-toolbar")) {
      const toolbar = document.createElement("div");
      toolbar.className = "map-edit-toolbar";
      toolbar.id = "map-edit-toolbar";
      toolbar.innerHTML = `
        <p class="map-edit-hint"><strong>Map alignment mode</strong> — pick a site, click the center of that yellow pad on the map.</p>
        <div class="map-edit-controls">
          <label>Site <select id="map-edit-site">${Array.from({ length: 81 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("")}</select></label>
          <label>W <input type="number" id="map-edit-w" value="22" min="8" max="80"></label>
          <label>H <input type="number" id="map-edit-h" value="26" min="8" max="80"></label>
          <label class="map-edit-check"><input type="checkbox" id="map-edit-show-boxes" checked> Show click boxes</label>
        </div>
        <pre class="map-edit-output" id="map-edit-output">Click a yellow RV pad…</pre>
      `;
      panel.prepend(toolbar);
    }

    const select = document.getElementById("map-edit-site");
    if (select && select.options.length <= 1) {
      select.innerHTML = Array.from({ length: 81 }, (_, i) => {
        const n = i + 1;
        return `<option value="${n}">${n}</option>`;
      }).join("");
    }

    this._editShowBoxes = document.getElementById("map-edit-show-boxes")?.checked !== false;
    document.getElementById("map-edit-show-boxes")?.addEventListener("change", (e) => {
      this._editShowBoxes = e.target.checked;
      this.render();
    });

    if (!this._isAlignCornerMode()) {
      clickTarget.addEventListener("click", (event) => {
        if (!this._imageReady || this._editDragging) return;
        if (event.target.closest(".map-spot")) return;
        const mapped = this._svgPointFromEvent(event);
        this._placeEditSite(mapped.x, mapped.y);
      });
    }

    this._setupEditDrag();
    if (this._isAlignCornerMode()) this._setupCornerAlign();
    this.render();
  },

  _placeEditSite(centerX, centerY) {
    const siteId = document.getElementById("map-edit-site")?.value || "1";
    const w = Number(document.getElementById("map-edit-w")?.value || 22);
    const h = Number(document.getElementById("map-edit-h")?.value || 26);
    const x = Math.round(centerX - w / 2);
    const y = Math.round(centerY - h / 2);
    const snippet = `"x": ${x}, "y": ${y}, "w": ${w}, "h": ${h}`;
    const line = `Site ${siteId}: { ${snippet} }`;
    console.log(line);

    const output = document.getElementById("map-edit-output");
    if (output) {
      output.textContent = `${line}\n\nUpdate js/map-units-generated.js for id "${siteId}".`;
    }

    const unit = window.SpotAvailability?.findUnit(String(siteId));
    if (unit) {
      unit.x = x;
      unit.y = y;
      unit.w = w;
      unit.h = h;
      this.render();
    }
  },

  _setupEditDrag() {
    if (this._editDragReady) return;
    this._editDragReady = true;
    this._editDragging = false;

    if (this._isAlignCornerMode()) return;

    this._layer?.addEventListener("mousedown", (event) => {
      const spot = event.target.closest(".map-spot");
      if (!spot || !this._isEditMode()) return;
      event.preventDefault();
      event.stopPropagation();

      const unit = window.SpotAvailability?.findUnit(spot.dataset.id);
      if (!unit) return;

      this._editDragging = true;
      const start = this._svgPointFromEvent(event);
      const origX = unit.x;
      const origY = unit.y;

      const onMove = (moveEvent) => {
        const pt = this._svgPointFromEvent(moveEvent);
        unit.x = Math.round(origX + (pt.x - start.x));
        unit.y = Math.round(origY + (pt.y - start.y));
        this.render();

        const output = document.getElementById("map-edit-output");
        if (output) {
          output.textContent = `Site ${unit.id}: { "x": ${unit.x}, "y": ${unit.y}, "w": ${unit.w}, "h": ${unit.h} }`;
        }
        const siteSelect = document.getElementById("map-edit-site");
        if (siteSelect) siteSelect.value = unit.id;
      };

      const onUp = () => {
        this._editDragging = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  },

  _setupCornerAlign() {
    if (this._cornerAlignReady) return;
    this._cornerAlignReady = true;

    this._layer?.addEventListener("mousedown", (event) => {
      if (!this._isEditMode() || !this._isAlignCornerMode()) return;
      if (event.target.closest(".map-corner-handle")) return;

      const spot = event.target.closest(".map-spot");
      if (!spot) return;

      event.preventDefault();
      event.stopPropagation();

      const unit = window.SpotAvailability?.findUnit(spot.dataset.id);
      if (!unit) return;

      this.setAlignSelected(unit.id);
      const siteSelect = document.getElementById("map-edit-site");
      if (siteSelect) siteSelect.value = unit.id;

      this._editDragging = true;
      const start = this._svgPointFromEvent(event);
      const startBase = this._unscalePoint(start.x, start.y);
      const origPoints = this.getUnitPoints(unit).map((p) => [p[0], p[1]]);

      const onMove = (moveEvent) => {
        const pt = this._svgPointFromEvent(moveEvent);
        const base = this._unscalePoint(pt.x, pt.y);
        const dx = base.x - startBase.x;
        const dy = base.y - startBase.y;
        unit.points = origPoints.map(([x, y]) => [x + dx, y + dy]);
        this.syncRectFromPoints(unit);
        this.render();
        this._notifyAlignChange(unit);
      };

      const onUp = () => {
        this._editDragging = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });

    const handlesTarget = this._handlesLayer || this._svg;
    handlesTarget.addEventListener("mousedown", (event) => {
      const handle = event.target.closest(".map-corner-handle");
      if (!handle || !this._isEditMode()) return;

      event.preventDefault();
      event.stopPropagation();

      const unit = window.SpotAvailability?.findUnit(handle.dataset.unitId);
      if (!unit) return;

      const cornerIndex = Number(handle.dataset.corner);
      this._editDragging = true;

      const onMove = (moveEvent) => {
        const pt = this._svgPointFromEvent(moveEvent);
        const base = this._unscalePoint(pt.x, pt.y);
        if (!unit.points) {
          unit.points = this.getUnitPoints(unit).map((p) => [p[0], p[1]]);
        }
        unit.points[cornerIndex] = [base.x, base.y];
        this.syncRectFromPoints(unit);
        this.render();
        this._notifyAlignChange(unit);
      };

      const onUp = () => {
        this._editDragging = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  },

  _notifyAlignChange(unit) {
    if (this._onAlignChange) this._onAlignChange(unit.id, unit);
    const output = document.getElementById("map-edit-output");
    if (output && unit.points) {
      output.textContent = `Site ${unit.id} corners:\n${JSON.stringify(unit.points)}`;
    }
  },

  _renderAlignHandles() {
    const layer = this._handlesLayer;
    if (!layer || !this._isAlignCornerMode() || !this._editShowBoxes) {
      if (layer) layer.innerHTML = "";
      return;
    }

    layer.innerHTML = "";
    const unit = window.SpotAvailability?.findUnit(this._alignSelectedId);
    if (!unit) return;

    const points = this.getUnitPoints(unit);
    if (!points) return;

    const scaled = this._scalePoints(points);
    scaled.forEach(([x, y], index) => {
      const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      handle.classList.add("map-corner-handle");
      handle.dataset.corner = String(index);
      handle.dataset.unitId = unit.id;
      handle.setAttribute("cx", String(x));
      handle.setAttribute("cy", String(y));
      handle.setAttribute("r", "5");
      handle.setAttribute("fill", "#ffffff");
      handle.setAttribute("stroke", "#0066cc");
      handle.setAttribute("stroke-width", "2");
      layer.appendChild(handle);
    });
  },

  _svgPointFromEvent(event) {
    const point = this._svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(this._svg.getScreenCTM().inverse());
  },

  _findUnitAt(x, y) {
    const units = this._getUnits().filter((u) => this.getUnitPoints(u));
    let hit = units.find((unit) => {
      const scaled = this._scalePoints(this.getUnitPoints(unit));
      return this._pointInPolygon(x, y, scaled);
    });
    if (hit) return hit;

    let nearest = null;
    let nearestDist = 28;
    units.forEach((unit) => {
      const scaled = this._scalePoints(this.getUnitPoints(unit));
      const bounds = this._unitBounds(scaled);
      const cx = bounds.minX + bounds.w / 2;
      const cy = bounds.minY + bounds.h / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = unit;
      }
    });
    return nearest;
  },

  _setupMapClickFallback() {
    if (!this._svg || this._clickFallbackReady) return;
    this._clickFallbackReady = true;

    const activateAtEvent = (event) => {
      if (this._isEditMode()) return;
      if (!this._imageReady) return;
      const mapped = this._svgPointFromEvent(event);
      const unit = this._findUnitAt(mapped.x, mapped.y);
      if (unit) this.focusUnit(unit.id);
    };

    this._svg.addEventListener("click", (event) => {
      if (event.target.closest(".map-spot")) return;
      activateAtEvent(event);
    });
  },

  setDates(checkIn, checkOut) {
    this._checkIn = checkIn || "";
    this._checkOut = checkOut || "";
    this.render();
    if (this._selectedId) this.selectUnit(this._selectedId, { force: true });
    else if (this._focusedId) this.focusUnit(this._focusedId);
  },

  /** While editing a reservation, ignore that stay for map availability/detail. */
  setAvailabilityExclude(options = {}, { render = true } = {}) {
    this._availabilityExclude = options && typeof options === "object" ? options : {};
    if (!render) return;
    this.render();
    if (this._selectedId) this.selectUnit(this._selectedId, { force: true });
    else if (this._focusedId) this.focusUnit(this._focusedId);
  },

  /**
   * Selected RV length in feet. Sites with sizeFeet below this render as tooShort (black).
   * Pass null/"" to clear. Condo/reunion maps should clear this.
   */
  setRigLength(feet, { render = true } = {}) {
    const n = feet === "" || feet == null ? null : Number(feet);
    this._rigLength = Number.isFinite(n) && n > 0 ? n : null;
    if (!render) return;
    this.render();
    if (this._selectedId) this.selectUnit(this._selectedId, { force: true });
    else if (this._focusedId) this.focusUnit(this._focusedId);
  },

  setUnitFilter(filter) {
    this._unitFilter = filter || "all";
    if (this._selectedId) {
      const unit = window.SpotAvailability.findUnit(this._selectedId);
      if (!unit || (filter !== "all" && unit.category !== filter)) {
        this._selectedId = null;
      }
    }
    this.render();
    if (this._selectedId) this.selectUnit(this._selectedId, { force: true });
    else if (!this._isAlignCornerMode()) this.clearSelection();
  },

  getUnitStatus(unit) {
    const status = window.SpotAvailability.getStatusForDates(
      unit,
      this._checkIn,
      this._checkOut,
      {
        ...this._availabilityExclude,
        rigLength: this._rigLength,
      }
    );
    // Hub Check bookings: binary occupancy only (any overlap → booked).
    if (this._lookupOnly && status !== "tooShort" && status !== "unknown") {
      return status === "available" ? "available" : "booked";
    }
    return status;
  },

  _setHover(id, status) {
    this._hoveredId = id;
    this._hoveredStatus = status;

    document.querySelectorAll(".map-spot").forEach((el) => {
      el.classList.toggle("hovered", el.dataset.id === id);
    });

    if (this._legendRoot) {
      this._legendRoot.querySelectorAll(".legend-item[data-status]").forEach((el) => {
        el.classList.toggle("legend-item--active", el.dataset.status === status);
      });
    }

    const viewport = this._svg?.closest(".reservation-map-viewport");
    viewport?.classList.add("is-spot-hover");
  },

  _alignEditColors(unit, isSelected) {
    if (isSelected) {
      return { fill: "rgba(0, 102, 204, 0.2)", stroke: "#0066cc", label: "#0066cc", width: "2.5" };
    }
    if (unit.category === "condo") {
      return { fill: "rgba(139, 69, 19, 0.28)", stroke: "#8B4513", label: "#8B4513", width: "2" };
    }
    if (unit.category === "reunion") {
      return { fill: "rgba(107, 76, 154, 0.28)", stroke: "#6b4c9a", label: "#6b4c9a", width: "2" };
    }
    return { fill: "rgba(255, 0, 0, 0.12)", stroke: "#cc0000", label: "#cc0000", width: "1.5" };
  },

  _unitKindLabel(unit) {
    if (unit.category === "condo") return "Condo";
    if (unit.category === "reunion") return "Family site";
    return "Site";
  },

  _clearHover() {
    this._hoveredId = null;
    this._hoveredStatus = null;

    document.querySelectorAll(".map-spot.hovered").forEach((el) => el.classList.remove("hovered"));

    if (this._legendRoot) {
      this._legendRoot.querySelectorAll(".legend-item--active").forEach((el) => {
        el.classList.remove("legend-item--active");
      });
    }

    const viewport = this._svg?.closest(".reservation-map-viewport");
    viewport?.classList.remove("is-spot-hover");
  },

  render() {
    if (!this._layer || !this._imageReady) return;
    this._clearHover();
    this._layer.innerHTML = "";

    const onPhoto = Boolean(this._photo || window.MAP_CONFIG?.image);
    const hasDates = this._hasValidDates();

    this._getUnits().forEach((unit) => {
      const unitPoints = this.getUnitPoints(unit);
      if (!unitPoints) return;

      const scaledPoints = this._scalePoints(unitPoints);
      const bounds = this._unitBounds(scaledPoints);
      const lengthBlocked =
        Boolean(this._rigLength) &&
        unit.category === "rv" &&
        !window.SpotAvailability.unitFitsRigLength(unit, this._rigLength);
      const status = lengthBlocked
        ? "tooShort"
        : hasDates
          ? this.getUnitStatus(unit)
          : "unknown";
      const colors = STATUS_COLORS[status] || STATUS_COLORS.unknown;
      const isCondo = unit.category === "condo";
      const isReunion = unit.category === "reunion";
      const isSelectedAlign =
        this._isAlignCornerMode() && this._alignSelectedId === String(unit.id);
      const alignColors = this._alignEditColors(unit, isSelectedAlign);
      const showStatusFill = status === "tooShort" || (hasDates && status !== "unknown");

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.classList.add("map-spot");
      if (onPhoto) g.classList.add("map-spot--on-photo");
      if (isCondo) g.classList.add("map-spot--condo");
      else if (isReunion) g.classList.add("map-spot--reunion");
      else g.classList.add("map-spot--rv");
      if (status === "available") g.classList.add("map-spot--available");
      if (status === "tooShort") g.classList.add("map-spot--too-short");
      if (showStatusFill) {
        g.classList.add("map-spot--dated");
      }
      if (isSelectedAlign) g.classList.add("map-spot--align-selected");
      g.dataset.id = unit.id;
      g.dataset.status = status;
      g.dataset.category = unit.category;
      g.setAttribute("role", "button");
      g.setAttribute("tabindex", status === "tooShort" ? "-1" : "0");
      g.setAttribute("aria-disabled", status === "tooShort" ? "true" : "false");
      g.setAttribute(
        "aria-label",
        `${this._unitKindLabel(unit)} ${unit.label}, ${window.STATUS_LABELS[status] || status}`
      );

      const shape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      shape.setAttribute("points", scaledPoints.map(([px, py]) => `${px},${py}`).join(" "));

      if (onPhoto) {
        if (this._isEditMode() && this._editShowBoxes) {
          shape.setAttribute("fill", alignColors.fill);
          shape.setAttribute("stroke", alignColors.stroke);
          shape.setAttribute("stroke-width", alignColors.width || (isSelectedAlign ? "2" : "1"));
        } else if (showStatusFill) {
          shape.setAttribute("fill", colors.fill);
          shape.setAttribute("stroke", colors.stroke);
          shape.setAttribute("stroke-width", "1.5");
          shape.setAttribute(
            "fill-opacity",
            status === "tooShort" ? "0.88" : isCondo || isReunion ? "0.72" : "0.68"
          );
        } else {
          // Nearly invisible fill so SVG hit-testing works (fill="none" ignores clicks).
          shape.setAttribute("fill", "rgba(0, 0, 0, 0.01)");
          shape.setAttribute("stroke", "none");
        }
      } else {
        shape.setAttribute("fill", colors.fill);
        shape.setAttribute("stroke", colors.stroke);
        shape.setAttribute("stroke-width", "1.5");
        shape.setAttribute(
          "fill-opacity",
          status === "tooShort" ? "0.9" : isCondo || isReunion ? "0.82" : "0.78"
        );
      }

      g.appendChild(shape);

      if (this._isEditMode() && this._editShowBoxes) {
        const labelSize = Math.max(9, Math.min(bounds.w, bounds.h) * 0.45);
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", bounds.minX + bounds.w / 2);
        label.setAttribute("y", bounds.minY + bounds.h / 2 + labelSize * 0.32);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("fill", alignColors.label);
        label.setAttribute("font-family", "Figtree, Source Sans 3, sans-serif");
        label.setAttribute("font-size", String(labelSize));
        label.setAttribute("font-weight", "700");
        label.textContent = unit.label;
        g.appendChild(label);
      }

      if (!this._isEditMode()) {
        const activate = (e) => {
          e.stopPropagation();
          this.focusUnit(unit.id);
        };

        g.addEventListener("click", activate);
        g.addEventListener("mouseenter", () => this._setHover(unit.id, status));
        g.addEventListener("mouseleave", (event) => {
          if (event.relatedTarget?.closest?.(".map-spot")) return;
          this._clearHover();
        });
        g.addEventListener("focus", () => this._setHover(unit.id, status));
        g.addEventListener("blur", (event) => {
          if (event.relatedTarget?.closest?.(".map-spot")) return;
          this._clearHover();
        });
        g.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate(e);
          }
        });
      }

      this._layer.appendChild(g);
    });

    document.querySelectorAll(".map-spot").forEach((el) => {
      el.classList.toggle("selected", el.dataset.id === this._selectedId);
      el.classList.toggle("focused", el.dataset.id === this._focusedId && el.dataset.id !== this._selectedId);
      el.classList.toggle("hovered", el.dataset.id === this._hoveredId);
    });

    if (this._hoveredId && this._hoveredStatus) {
      if (this._legendRoot) {
        this._legendRoot.querySelectorAll(".legend-item[data-status]").forEach((el) => {
          el.classList.toggle("legend-item--active", el.dataset.status === this._hoveredStatus);
        });
      }
    }

    this._renderAlignHandles();
  },

  focusUnit(id) {
    const unit = window.SpotAvailability.findUnit(id);
    if (!unit) return;

    const status = this.getUnitStatus(unit);
    this._focusedId = id;

    document.querySelectorAll(".map-spot").forEach((el) => {
      el.classList.toggle("focused", el.dataset.id === id && el.dataset.id !== this._selectedId);
    });

    // Lookup mode: any site is inspectable (booked or available); keep status binary via getUnitStatus.
    if (this._lookupOnly) {
      if (this._onSpotSelect) this._onSpotSelect(unit, status);
      else this._renderDetail(unit, status);
      if (this._onUnitFocus) this._onUnitFocus(unit, status);
      this._selectedId = id;
      document.querySelectorAll(".map-spot").forEach((el) => {
        el.classList.toggle("selected", el.dataset.id === id);
        el.classList.toggle("focused", false);
      });
      return;
    }

    this._renderDetail(unit, status);

    if (this._onUnitFocus) {
      this._onUnitFocus(unit, status);
    }

    if (status === "available" && (!this._canBookSelect || this._canBookSelect(unit))) {
      this.selectUnit(id, { force: true });
    }
  },

  selectUnit(id, { force = false } = {}) {
    const unit = window.SpotAvailability.findUnit(id);
    if (!unit) return;

    const status = this.getUnitStatus(unit);
    if (status !== "available") {
      if (!force) return;
      if (this._selectedId === id) {
        this._selectedId = null;
        document.querySelectorAll(".map-spot").forEach((el) => {
          el.classList.remove("selected");
        });
      }
      this._renderDetail(unit, status);
      return;
    }

    this._selectedId = id;
    document.querySelectorAll(".map-spot").forEach((el) => {
      el.classList.toggle("selected", el.dataset.id === id);
      el.classList.toggle("focused", false);
    });

    if (this._onSpotSelect) {
      this._onSpotSelect(unit, status);
    }

    this._renderDetail(unit, status);
  },

  /** @deprecated use selectUnit */
  selectSpot(id) {
    this.focusUnit(id);
  },

  _detailNoun(unit) {
    if (unit.category === "condo") return "condo";
    if (unit.category === "reunion") return "family site";
    return "spot";
  },

  _detailNounAnother(unit) {
    if (unit.category === "condo") return "another condo";
    if (unit.category === "reunion") return "another family site";
    return "another spot";
  },

  _renderDetail(unit, status) {
    if (!this._detailPanel) return;

    const isCondo = unit.category === "condo";
    const isReunion = unit.category === "reunion";
    const typeLabel = isCondo
      ? `Building ${unit.building}, unit ${unit.unit}`
      : isReunion
        ? unit.name || `Family reunion site ${unit.label}`
        : window.SPOT_TYPE_LABELS[unit.type] || unit.type;

    const hasDates = this._hasValidDates();
    const bookings = hasDates
      ? window.SpotAvailability.getBookingsForUnit(
          unit.id,
          this._checkIn,
          this._checkOut,
          this._availabilityExclude
        )
      : window.SpotAvailability.applyExcludeOptions(
          window.SpotAvailability.getUpcomingBookingsForUnit(unit.id, 90),
          this._availabilityExclude
        ).map((b) => ({ checkIn: b.checkIn, checkOut: b.checkOut }));

    let displayStatus = status;
    let statusLabel = window.STATUS_LABELS[status] || status;

    if (!hasDates && status !== "tooShort") {
      if (bookings.length === 0) {
        displayStatus = "available";
        statusLabel = window.STATUS_LABELS.previewOpen;
      } else if (this._lookupOnly) {
        displayStatus = "booked";
        statusLabel = window.STATUS_LABELS.booked;
      } else {
        displayStatus = "partial";
        statusLabel = window.STATUS_LABELS.previewBooked;
      }
    } else if (this._lookupOnly && hasDates && status !== "tooShort") {
      displayStatus = status === "available" ? "available" : "booked";
      statusLabel =
        displayStatus === "available"
          ? window.STATUS_LABELS.available
          : window.STATUS_LABELS.booked;
    }

    const noun = this._detailNoun(unit);
    const nounAnother = this._detailNounAnother(unit);
    const maxLength = window.SpotAvailability.getUnitMaxLength(unit);

    const canBook = status === "available";
    const statusNote =
      status === "tooShort"
        ? maxLength != null && this._rigLength
          ? `This site allows up to ${maxLength}'. Your RV is ${this._rigLength}', so this site cannot be selected.`
          : `This site is too short for your RV and cannot be selected.`
        : hasDates
          ? {
              available: canBook
                ? `This ${noun} is open for your entire stay. It has been added to your booking.`
                : "",
              partial: bookings.length
                ? `This ${noun} is booked for part of your requested days. See the booked dates above and choose different dates or ${nounAnother}.`
                : `This ${noun} is partially booked for your selected dates.`,
              booked: bookings.length
                ? `This ${noun} is booked for all of your selected dates. See the booked dates above.`
                : `This ${noun} is booked for your entire stay.`,
              unknown: "",
            }[status]
          : bookings.length
            ? `Reservations scheduled in the next 90 days are listed above. Pick your dates above to see if this ${noun} is open for your stay.`
            : `Nothing is booked for this ${noun} in the next 90 days. Pick your dates above to check availability and book.`;

    const extraRows = [];
    if (maxLength != null) {
      extraRows.push(`<div><dt>Length</dt><dd>${maxLength}′</dd></div>`);
    }
    if (isCondo && unit.bedrooms) {
      extraRows.push(`<div><dt>Bedrooms</dt><dd>${unit.bedrooms}</dd></div>`);
    }
    if (hasDates) {
      extraRows.push(
        `<div><dt>Your dates</dt><dd>${window.SpotAvailability.formatDateRange(this._checkIn, this._checkOut)}</dd></div>`
      );
    } else {
      const today = window.SpotAvailability.getToday();
      const windowEnd = window.SpotAvailability.addDays(today, 90);
      extraRows.push(
        `<div><dt>Schedule window</dt><dd>${window.SpotAvailability.formatDateRange(today, windowEnd)}</dd></div>`
      );
    }
    if (bookings.length) {
      const datesHtml = bookings
        .map(
          (b) =>
            `<li>${window.SpotAvailability.formatDateRange(b.checkIn, b.checkOut)}</li>`
        )
        .join("");
      extraRows.push(
        `<div><dt>${hasDates ? "Booked dates" : "Booked (next 90 days)"}</dt><dd><ul class="booking-dates-list">${datesHtml}</ul></dd></div>`
      );
    } else if (!hasDates) {
      extraRows.push(`<div><dt>Booked (next 90 days)</dt><dd>None scheduled</dd></div>`);
    }

    this._detailPanel.hidden = false;
    // Hub occupancy lookup omits the booking CTA / guidance note; book/edit keep it.
    const noteHtml = this._lookupOnly
      ? ""
      : `<p class="detail-note">${statusNote}</p>`;
    this._detailPanel.innerHTML = `
      ${this._overlayCloseHtml()}
      <p class="map-detail-label">${this._unitKindLabel(unit)} ${unit.label}</p>
      <h3 class="map-detail-title">${typeLabel}</h3>
      <dl class="detail-list">
        <div>
          <dt>Status</dt>
          <dd><span class="status-pill ${displayStatus}">${statusLabel}</span></dd>
        </div>
        ${extraRows.join("")}
      </dl>
      ${noteHtml}
    `;
    this.openDetailOverlay();
  },

  clearSelection() {
    this._selectedId = null;
    this._focusedId = null;
    this._clearHover();
    document.querySelectorAll(".map-spot").forEach((el) => {
      el.classList.remove("selected", "focused");
    });

    if (!this._detailPanel) return;

    if (this._usesDetailOverlay()) {
      this.closeDetailOverlay();
      return;
    }

    const filterHint =
      this._unitFilter === "condo"
        ? "click any brown condo box to see if it is available."
        : this._unitFilter === "reunion"
          ? "click a family reunion site on the map to see if it is available."
          : this._unitFilter === "rv"
            ? "click any green RV site to see if it is available."
            : "click any RV site, condo, or family reunion site on the map to see upcoming bookings.";

    const msg = this._requireDatesForSpots
      ? this._lookupOnly
        ? `Pick dates above, then ${filterHint} Green is available; red is booked.`
        : `Pick dates above, then ${filterHint} Green is available; yellow is partially booked; red is fully booked.`
      : this._unitFilter === "all"
        ? "Click any RV site, condo, or family reunion site to see bookings for the next 90 days."
        : filterHint.charAt(0).toUpperCase() + filterHint.slice(1);

    this._detailPanel.hidden = false;
    this._detailPanel.innerHTML = `<p class="spot-detail-placeholder">${msg}</p>`;
  },
};
