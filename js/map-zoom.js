window.MapZoom = {
  init({
    viewport,
    stage,
    zoomInBtn,
    zoomOutBtn,
    resetBtn,
    min = 1,
    max = 4,
    step = 0.25,
  }) {
    if (!viewport || !stage) return;

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragPanX = 0;
    let dragPanY = 0;
    let dragMoved = false;

    const applyTransform = () => {
      stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      if (resetBtn) {
        resetBtn.textContent = `${Math.round(scale * 100)}%`;
      }
      viewport.classList.toggle("is-zoomed", scale > 1 || panX !== 0 || panY !== 0);
    };

    const isInteractiveTarget = (target, event) => {
      if (target.closest(".map-spot, .map-zoom-controls, button, a, input, select, textarea")) {
        return true;
      }

      const svg = viewport.querySelector(".campground-map-overlay");
      if (svg && window.CampgroundMap?._findUnitAt && window.CampgroundMap._imageReady) {
        const mapped = window.CampgroundMap._svgPointFromEvent(event);
        if (window.CampgroundMap._findUnitAt(mapped.x, mapped.y)) return true;
      }

      return false;
    };

    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      if (isInteractiveTarget(event.target, event)) return;

      dragging = true;
      dragMoved = false;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragPanX = panX;
      dragPanY = panY;
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-dragging");
    };

    const onPointerMove = (event) => {
      if (!dragging) return;

      const dx = event.clientX - dragStartX;
      const dy = event.clientY - dragStartY;

      if (!dragMoved && Math.hypot(dx, dy) > 4) {
        dragMoved = true;
      }

      panX = dragPanX + dx;
      panY = dragPanY + dy;
      applyTransform();
    };

    const endDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove("is-dragging");

      if (dragMoved) {
        viewport.dataset.panning = "true";
        window.setTimeout(() => {
          delete viewport.dataset.panning;
        }, 0);
      }

      if (event.pointerId != null) {
        try {
          viewport.releasePointerCapture(event.pointerId);
        } catch (_) {
          /* ignore */
        }
      }
    };

    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    viewport.addEventListener(
      "click",
      (event) => {
        if (viewport.dataset.panning === "true") {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true
    );

    const clampScale = (value) => Math.min(max, Math.max(min, value));

    const setScale = (nextScale, focalX, focalY) => {
      const oldScale = scale;
      scale = clampScale(nextScale);
      if (oldScale === scale) return;

      if (typeof focalX === "number" && typeof focalY === "number") {
        const ratio = scale / oldScale;
        panX = focalX - ratio * (focalX - panX);
        panY = focalY - ratio * (focalY - panY);
      }

      applyTransform();
    };

    const resetView = () => {
      scale = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    };

    zoomInBtn?.addEventListener("click", () => {
      const rect = viewport.getBoundingClientRect();
      setScale(scale + step, rect.width / 2, rect.height / 2);
    });

    zoomOutBtn?.addEventListener("click", () => {
      const rect = viewport.getBoundingClientRect();
      setScale(scale - step, rect.width / 2, rect.height / 2);
    });

    resetBtn?.addEventListener("click", resetView);

    viewport.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const focalX = event.clientX - rect.left;
        const focalY = event.clientY - rect.top;
        setScale(scale + (event.deltaY < 0 ? step : -step), focalX, focalY);
      },
      { passive: false }
    );

    applyTransform();

    return { resetView, setScale };
  },
};
