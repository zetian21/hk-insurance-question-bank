(function () {
  const totalPages = 61;
  const storageKey = "insurance-lecture-ebook-page";
  const pagePath = (page) => `ebook-pages/page-${String(page).padStart(3, "0")}.jpg`;

  const els = {
    frame: document.querySelector("#pageFrame"),
    image: document.querySelector("#pageImage"),
    label: document.querySelector("#pageLabel"),
    input: document.querySelector("#pageInput"),
    slider: document.querySelector("#pageSlider"),
    prev: document.querySelector("#prevPage"),
    next: document.querySelector("#nextPage"),
    stagePrev: document.querySelector("#stagePrev"),
    stageNext: document.querySelector("#stageNext"),
    zoomOut: document.querySelector("#zoomOut"),
    zoomIn: document.querySelector("#zoomIn"),
    fitPage: document.querySelector("#fitPage"),
    thumbStrip: document.querySelector("#thumbStrip"),
  };

  const state = {
    page: clamp(Number(localStorage.getItem(storageKey)) || 1, 1, totalPages),
    zoom: 1,
    touchStartX: 0,
    touchStartY: 0,
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function render(direction = "none") {
    const page = state.page;
    els.image.src = pagePath(page);
    els.image.alt = `保險試題精講第 ${page} 頁`;
    els.label.textContent = `第 ${page} / ${totalPages} 頁`;
    els.input.value = page;
    els.slider.value = page;
    els.prev.disabled = page === 1;
    els.next.disabled = page === totalPages;
    document.title = `保險試題精講電子書 - 第 ${page} 頁`;
    localStorage.setItem(storageKey, String(page));
    updateZoom();
    updateThumbs();
    animatePage(direction);
    preload(page - 1);
    preload(page + 1);
  }

  function animatePage(direction) {
    els.frame.classList.remove("turn-next", "turn-prev");
    if (direction === "none") return;
    requestAnimationFrame(() => {
      els.frame.classList.add(direction === "next" ? "turn-next" : "turn-prev");
    });
  }

  function goTo(page, direction = page > state.page ? "next" : "prev") {
    const nextPage = clamp(Number(page) || state.page, 1, totalPages);
    if (nextPage === state.page) {
      render("none");
      return;
    }
    state.page = nextPage;
    render(direction);
  }

  function updateZoom() {
    els.frame.style.transform = `scale(${state.zoom})`;
  }

  function changeZoom(delta) {
    state.zoom = clamp(Number((state.zoom + delta).toFixed(2)), 0.75, 1.8);
    updateZoom();
  }

  function preload(page) {
    if (page < 1 || page > totalPages) return;
    const image = new Image();
    image.src = pagePath(page);
  }

  function buildThumbs() {
    const fragment = document.createDocumentFragment();
    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement("button");
      button.className = "thumb";
      button.type = "button";
      button.title = `第 ${page} 頁`;
      button.setAttribute("aria-label", `第 ${page} 頁`);
      button.dataset.page = String(page);

      const image = document.createElement("img");
      image.loading = "lazy";
      image.src = pagePath(page);
      image.alt = "";
      button.append(image);
      fragment.append(button);
    }
    els.thumbStrip.append(fragment);
  }

  function updateThumbs() {
    const current = els.thumbStrip.querySelector('[aria-current="page"]');
    if (current) current.removeAttribute("aria-current");
    const next = els.thumbStrip.querySelector(`[data-page="${state.page}"]`);
    if (!next) return;
    next.setAttribute("aria-current", "page");
    next.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }

  function handleKeydown(event) {
    if (event.target.matches("input")) return;
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      goTo(state.page - 1, "prev");
    }
    if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      goTo(state.page + 1, "next");
    }
    if (event.key === "Home") {
      event.preventDefault();
      goTo(1, "prev");
    }
    if (event.key === "End") {
      event.preventDefault();
      goTo(totalPages, "next");
    }
  }

  function beginTouch(event) {
    if (event.touches.length !== 1) return;
    state.touchStartX = event.touches[0].clientX;
    state.touchStartY = event.touches[0].clientY;
  }

  function finishTouch(event) {
    if (event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - state.touchStartX;
    const deltaY = touch.clientY - state.touchStartY;
    if (Math.abs(deltaX) < 54 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    goTo(state.page + (deltaX < 0 ? 1 : -1), deltaX < 0 ? "next" : "prev");
  }

  els.prev.addEventListener("click", () => goTo(state.page - 1, "prev"));
  els.next.addEventListener("click", () => goTo(state.page + 1, "next"));
  els.stagePrev.addEventListener("click", () => goTo(state.page - 1, "prev"));
  els.stageNext.addEventListener("click", () => goTo(state.page + 1, "next"));
  els.zoomOut.addEventListener("click", () => changeZoom(-0.1));
  els.zoomIn.addEventListener("click", () => changeZoom(0.1));
  els.fitPage.addEventListener("click", () => {
    state.zoom = 1;
    updateZoom();
  });
  els.input.addEventListener("change", () => goTo(els.input.value));
  els.slider.addEventListener("input", () => goTo(els.slider.value));
  els.thumbStrip.addEventListener("click", (event) => {
    const thumb = event.target.closest(".thumb");
    if (thumb) goTo(thumb.dataset.page);
  });
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("touchstart", beginTouch, { passive: true });
  document.addEventListener("touchend", finishTouch, { passive: true });

  buildThumbs();
  render("none");
})();
