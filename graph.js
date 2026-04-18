/* =============================================================
   OTAKU GRID — graph.js
   Self-contained Bubble Graph module with pure-JS force simulation
   Phase 3 — No D3, no frameworks, vanilla Canvas 2D API
   ============================================================= */

(function () {
  "use strict";

  // ── Genre → Color Palette ─────────────────────────────────
  const GENRE_COLORS = {
    "Action":       "#ef4444",
    "Romance":      "#f472b6",
    "Comedy":       "#facc15",
    "Drama":        "#a78bfa",
    "Sci-Fi":       "#38bdf8",
    "Fantasy":      "#34d399",
    "Horror":       "#fb923c",
    "Slice of Life":"#86efac",
    "Mystery":      "#c084fc",
    "Sports":       "#fbbf24",
    "Adventure":    "#fb923c",
    "Supernatural": "#a78bfa",
    "Psychological":"#c084fc",
    "Thriller":     "#ef4444",
    "Mecha":        "#38bdf8",
    "Music":        "#f472b6",
    "Ecchi":        "#f472b6",
    "Harem":        "#facc15",
    "Other":        "#6b7280"
  };

  function genreColor(genres) {
    if (!genres || genres.length === 0) return GENRE_COLORS["Other"];
    for (const g of genres) {
      if (GENRE_COLORS[g]) return GENRE_COLORS[g];
    }
    return GENRE_COLORS["Other"];
  }

  function primaryGenre(genres) {
    if (!genres || genres.length === 0) return "Other";
    for (const g of genres) {
      if (GENRE_COLORS[g]) return g;
    }
    return genres[0] || "Other";
  }

  // Truncate string with ellipsis
  function truncate(str, max) {
    if (!str) return "";
    str = String(str);
    return str.length > max ? str.slice(0, max - 1) + "…" : str;
  }

  // Shared genre count between two node genre arrays
  function sharedGenres(a, b) {
    const setA = new Set(a);
    return b.filter(g => setA.has(g)).length;
  }

  // Hex → RGB
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  // ── Image cache (loaded cover images for canvas) ──────────
  const imgCache = {};

  function loadImage(url) {
    if (imgCache[url]) return imgCache[url];
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => imgCache[url] = img;
    img.onerror = () => { img._failed = true; imgCache[url] = img; };
    imgCache[url] = img;
    return img;
  }

  // ── Graph Module ──────────────────────────────────────────
  const GraphModule = {
    nodes: [],
    edges: [],
    filteredNodes: new Set(),  // indices of visible nodes
    canvas: null,
    ctx: null,
    wrap: null,
    animFrame: null,
    simRunning: false,
    dragging: null,    // { nodeIdx, offsetX, offsetY }
    hovered: null,     // node index
    selected: null,    // node index
    pulsePhase: null,  // array of {t, done} per node

    // Filter state
    filters: {
      genres: new Set(["all"]),
      ratingMin: 0,
      ratingMax: 10,
      year: "all"
    },

    init() {
      this.canvas = document.getElementById("bubble-canvas");
      this.ctx = this.canvas?.getContext("2d");
      this.wrap = document.getElementById("graph-canvas-wrap");
      this.tooltip = document.getElementById("graph-tooltip");
      this.emptyState = document.getElementById("graph-empty");

      if (!this.canvas || !this.ctx) return;

      this.bindEvents();
      this.bindFilters();

      // ResizeObserver
      if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => this.handleResize());
        if (this.wrap) ro.observe(this.wrap);
      }
    },

    // Called by app.js when graph data is ready
    loadFromAppState(appState) {
      const results = [];
      appState.entries.forEach(title => {
        const norm = (window.AppFns?.normalizeTitle || (t => t.trim().toLowerCase()))(title);
        const r = appState.resultMap.get(norm);
        if (r && r.found && r.image) results.push(r);
      });

      if (results.length === 0) return;

      // Store pending data — build graph when panel activates with real dimensions
      this._pendingResults = results;
      this.updateEmptyState();

      if (document.getElementById("graph-panel")?.classList.contains("active")) {
        this._buildOnActivate();
      }
    },

    _buildOnActivate() {
      if (!this._pendingResults || this._pendingResults.length === 0) return;
      this._sizeCanvas();
      this.buildGraph(this._pendingResults);
      this._pendingResults = null;
    },

    _sizeCanvas() {
      const canvas = this.canvas;
      const wrap = this.wrap;
      if (!canvas || !wrap) return;
      // Use actual rendered dimensions
      const w = wrap.clientWidth  || wrap.offsetWidth  || 800;
      const h = wrap.clientHeight || wrap.offsetHeight || 500;
      canvas.width  = Math.max(w, 400);
      canvas.height = Math.max(h, 400);
    },

    onActivate(appState) {
      // Size the canvas now that the panel is visible
      this._sizeCanvas();

      if (this._pendingResults && this._pendingResults.length > 0) {
        this._buildOnActivate();
        return;
      }

      if (appState && appState.resultMap && appState.resultMap.size > 0 && this.nodes.length === 0) {
        this.loadFromAppState(appState);
        return;
      }

      // Already have nodes — just resize positions and redraw
      if (this.nodes.length > 0) {
        this.handleResize(true);
      }

      this.updateEmptyState();
    },

    buildGraph(results) {
      const W = Math.max(this.canvas?.width  || 0, 400);
      const H = Math.max(this.canvas?.height || 0, 400);
      const cx = W / 2, cy = H / 2;

      this.nodes = results.map((r, i) => {
        const score = parseFloat(r.score) || 5;
        const radius = Math.round(20 + (score / 10) * 30);
        const angle = (i / results.length) * Math.PI * 2;
        const spread = Math.min(W, H) * 0.3;

        return {
          id: i,
          title: r.romaji || r.title || "",
          english: r.english || "",
          score,
          genres: r.genres || [],
          year: String(r.year || ""),
          image: r.image || "",
          anilistId: r.anilistId || null,
          malId: r.malId || null,
          r: radius,
          color: genreColor(r.genres),
          primary: primaryGenre(r.genres),
          x: cx + Math.cos(angle) * spread + (Math.random() - 0.5) * 60,
          y: cy + Math.sin(angle) * spread + (Math.random() - 0.5) * 60,
          vx: 0, vy: 0,
          fx: null, fy: null,  // fixed position when dragged
          opacity: 1
        };
      });

      // Build edges: nodes sharing ≥1 genre, cap at 40, prefer ≥2
      const candidates = [];
      for (let a = 0; a < this.nodes.length; a++) {
        for (let b = a + 1; b < this.nodes.length; b++) {
          const shared = sharedGenres(this.nodes[a].genres, this.nodes[b].genres);
          if (shared >= 1) candidates.push({ a, b, shared });
        }
      }
      // Sort: more shared genres first
      candidates.sort((x, y) => y.shared - x.shared);
      this.edges = candidates.slice(0, 40);

      // Preload images
      this.nodes.forEach(n => { if (n.image) loadImage(n.image); });

      // Build genre list for filter pills
      this.buildGenreFilter();

      // Init pulse
      this.pulsePhase = this.nodes.map((_, i) => ({ t: -(i * 0.04), done: false }));

      // Run simulation
      this.filteredNodes = new Set(this.nodes.map((_, i) => i));
      this.runSimulation(300);
    },

    // ── Force Simulation ─────────────────────────────────────
    runSimulation(ticks) {
      const nodes = this.nodes;
      const edges = this.edges;
      const canvas = this.canvas;

      const k_repel   = 5500;
      const k_spring  = 0.025;
      const restLen   = 220;
      const k_center  = 0.008;
      const damping   = 0.85;

      const W = canvas?.width || 800;
      const H = canvas?.height || 600;
      const cx = W / 2;
      const cy = H / 2;

      for (let tick = 0; tick < ticks; tick++) {
        // Reset forces
        nodes.forEach(n => { n.fx2 = 0; n.fy2 = 0; });

        // Repulsion between all pairs
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
            const minDist = a.r + b.r + 20;
            const eff = Math.max(d, minDist);
            const F = k_repel / (eff * eff);
            const fx = (dx / eff) * F;
            const fy = (dy / eff) * F;
            a.fx2 -= fx; a.fy2 -= fy;
            b.fx2 += fx; b.fy2 += fy;
          }
        }

        // Spring attraction along edges
        edges.forEach(({ a, b }) => {
          const na = nodes[a], nb = nodes[b];
          let dx = nb.x - na.x;
          let dy = nb.y - na.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const stretch = d - restLen;
          const F = k_spring * stretch;
          const fx = (dx / d) * F;
          const fy = (dy / d) * F;
          na.fx2 += fx; na.fy2 += fy;
          nb.fx2 -= fx; nb.fy2 -= fy;
        });

        // Center gravity
        nodes.forEach(n => {
          n.fx2 += (cx - n.x) * k_center;
          n.fy2 += (cy - n.y) * k_center;
        });

        // Integrate
        nodes.forEach(n => {
          if (n === this.dragging?.node) return;
          n.vx = (n.vx + n.fx2) * damping;
          n.vy = (n.vy + n.fy2) * damping;
          n.x += n.vx;
          n.y += n.vy;

          // Boundary clamp
          n.x = Math.max(n.r + 10, Math.min(W - n.r - 10, n.x));
          n.y = Math.max(n.r + 10, Math.min(H - n.r - 10, n.y));
        });
      }

      this.simRunning = false;
      this.startRenderLoop();
    },

    startRenderLoop() {
      if (this.animFrame) cancelAnimationFrame(this.animFrame);
      this.renderLoop();
    },

    renderLoop() {
      this.draw();
      // Keep running if pulse animation still running
      const stillPulsing = this.pulsePhase && this.pulsePhase.some(p => !p.done);
      if (stillPulsing || this.dragging) {
        this.animFrame = requestAnimationFrame(() => this.renderLoop());
      } else {
        this.animFrame = null;
      }
    },

    draw() {
      const ctx = this.ctx;
      const canvas = this.canvas;
      if (!ctx || !canvas) return;

      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // Draw edges
      this.edges.forEach(({ a, b, shared }) => {
        if (!this.filteredNodes.has(a) || !this.filteredNodes.has(b)) return;
        if (this.nodes[a].opacity < 0.5 || this.nodes[b].opacity < 0.5) return;
        ctx.save();
        ctx.globalAlpha = shared >= 2 ? 0.12 : 0.06;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.nodes[a].x, this.nodes[a].y);
        ctx.lineTo(this.nodes[b].x, this.nodes[b].y);
        ctx.stroke();
        ctx.restore();
      });

      // Draw nodes
      this.nodes.forEach((n, i) => {
        if (!this.filteredNodes.has(i)) return;

        const isSelected = this.selected === i;
        const isHovered  = this.hovered === i;

        // Pulse scale
        let pulse = 1;
        if (this.pulsePhase && this.pulsePhase[i] && !this.pulsePhase[i].done) {
          const t = this.pulsePhase[i].t;
          if (t >= 0 && t <= 1) {
            pulse = t < 0.4 ? 0.8 + t * 0.625 : t < 0.7 ? 1.05 - (t - 0.4) * 0.167 : 1.0;
          }
          this.pulsePhase[i].t += 0.025;
          if (this.pulsePhase[i].t > 1) this.pulsePhase[i].done = true;
        }

        ctx.save();
        ctx.globalAlpha = n.opacity;
        ctx.translate(n.x, n.y);
        ctx.scale(pulse, pulse);

        // Glow ring for selected
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(0, 0, n.r + 5, 0, Math.PI * 2);
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2.5;
          ctx.shadowColor = "#fff";
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Hover ring
        if (isHovered && !isSelected) {
          ctx.beginPath();
          ctx.arc(0, 0, n.r + 3, 0, Math.PI * 2);
          ctx.strokeStyle = n.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Node fill
        ctx.beginPath();
        ctx.arc(0, 0, n.r, 0, Math.PI * 2);
        const rgb = hexToRgb(n.color);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`;
        ctx.fill();

        // Cover image clipped to circle
        const img = n.image ? imgCache[n.image] : null;
        if (img && img.complete && !img._failed) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, n.r, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, -n.r, -n.r, n.r * 2, n.r * 2);
          // Slight color tint overlay
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`;
          ctx.fillRect(-n.r, -n.r, n.r * 2, n.r * 2);
          ctx.restore();
        }

        // Label below node
        ctx.font = `500 11px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label = truncate(n.title, 14);
        const textY = n.r + 5;

        // Text shadow
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillText(label, 1, textY + 1);
        ctx.fillStyle = isHovered || isSelected ? "#fff" : "rgba(240,244,255,0.85)";
        ctx.fillText(label, 0, textY);

        ctx.restore();
      });
    },

    // ── Filter Logic ──────────────────────────────────────────
    applyFilters() {
      const { genres, ratingMin, ratingMax, year } = this.filters;
      const hasAll = genres.has("all");

      this.nodes.forEach((n, i) => {
        const genreOk  = hasAll || n.genres.some(g => genres.has(g));
        const ratingOk = n.score >= ratingMin && n.score <= ratingMax;
        const yearOk   = year === "all" || n.year === year;
        const visible  = genreOk && ratingOk && yearOk;
        this.filteredNodes[visible ? "add" : "delete"](i);
        // Fade: smooth opacity
        n.opacity = visible ? 1 : 0.08;
      });

      // Handle selected node becoming hidden
      if (this.selected !== null && !this.filteredNodes.has(this.selected)) {
        this.selected = null;
      }

      this.startRenderLoop();
    },

    buildGenreFilter() {
      const allGenres = new Set();
      this.nodes.forEach(n => n.genres.forEach(g => allGenres.add(g)));
      
      const container = document.getElementById("genre-pills");
      if (!container) return;

      container.innerHTML = `<button class="genre-pill active" data-genre="all">All</button>`;
      
      [...allGenres].sort().forEach(g => {
        const btn = document.createElement("button");
        btn.className = "genre-pill";
        btn.dataset.genre = g;
        btn.textContent = g;
        container.appendChild(btn);
      });

      // Year filter
      const years = new Set();
      this.nodes.forEach(n => { if (n.year) years.add(n.year); });
      const yearSel = document.getElementById("year-filter");
      if (yearSel) {
        yearSel.innerHTML = `<option value="all">All Years</option>`;
        [...years].sort((a, b) => b - a).forEach(y => {
          const opt = document.createElement("option");
          opt.value = y;
          opt.textContent = y;
          yearSel.appendChild(opt);
        });
      }
    },

    updateEmptyState() {
      const empty = document.getElementById("graph-empty");
      if (!empty) return;
      empty.style.display = this.nodes.length === 0 ? "flex" : "none";
    },

    // ── Event Binding ─────────────────────────────────────────
    bindEvents() {
      const canvas = this.canvas;
      if (!canvas) return;
      const isMobile = () => window.innerWidth < 600;

      const getPos = e => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const src = e.touches ? e.touches[0] : e;
        return {
          x: (src.clientX - rect.left) * scaleX,
          y: (src.clientY - rect.top) * scaleY
        };
      };

      const hitRadius = () => isMobile() ? 60 : 40;

      const nearestNode = (pos) => {
        let best = null, bestD = Infinity;
        const hr = hitRadius();
        this.nodes.forEach((n, i) => {
          if (!this.filteredNodes.has(i)) return;
          const dx = n.x - pos.x, dy = n.y - pos.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < n.r + hr && d < bestD) { bestD = d; best = i; }
        });
        return best;
      };

      // ── Hover / Tooltip ────────────────────────────────────
      canvas.addEventListener("mousemove", e => {
        const pos = getPos(e);
        const ni = nearestNode(pos);
        this.hovered = ni;

        if (ni !== null) {
          this.showTooltip(this.nodes[ni], e.clientX, e.clientY);
          canvas.style.cursor = "pointer";
        } else {
          this.hideTooltip();
          canvas.style.cursor = this.dragging ? "grabbing" : "default";
        }

        // Drag in progress
        if (this.dragging !== null) {
          const n = this.nodes[this.dragging];
          n.x = pos.x;
          n.y = pos.y;
          if (!this.animFrame) this.startRenderLoop();
        }
      });

      // ── Click → Highlight ──────────────────────────────────
      canvas.addEventListener("click", e => {
        if (this.dragging !== null) return; // ignore click after drag
        const pos = getPos(e);
        const ni = nearestNode(pos);

        if (ni === null) {
          // Reset highlight
          this.selected = null;
          this.nodes.forEach((n, i) => {
            n.opacity = this.filteredNodes.has(i) ? 1 : 0.08;
          });
          this.startRenderLoop();
          return;
        }

        this.selected = ni;

        // Connected nodes = those sharing ≥1 genre
        const connected = new Set([ni]);
        this.edges.forEach(({ a, b }) => {
          if (a === ni) connected.add(b);
          if (b === ni) connected.add(a);
        });

        this.nodes.forEach((n, i) => {
          if (!this.filteredNodes.has(i)) return;
          n.opacity = connected.has(i) ? 1 : 0.18;
        });

        this.startRenderLoop();
      });

      // ── Double-click → Detail Modal ────────────────────────
      let dblClickTimer = null;
      canvas.addEventListener("dblclick", e => {
        const pos = getPos(e);
        const ni = nearestNode(pos);
        if (ni !== null) {
          const n = this.nodes[ni];
          const result = {
            found: true,
            title: n.title,
            romaji: n.title,
            english: n.english,
            image: n.image,
            score: n.score.toFixed(1),
            genres: n.genres,
            genresStr: n.genres.slice(0, 3).join(", "),
            year: n.year,
            anilistId: n.anilistId,
            malId: n.malId
          };
          const norm = (window.AppFns?.normalizeTitle || (t => t.toLowerCase().trim()))(n.title);
          if (window.AppFns?.openDetailModal) {
            window.AppFns.openDetailModal(result, norm);
          }
        }
      });

      // ── Drag ──────────────────────────────────────────────
      canvas.addEventListener("mousedown", e => {
        if (isMobile()) return;
        const pos = getPos(e);
        const ni = nearestNode(pos);
        if (ni !== null) {
          this.dragging = ni;
          canvas.style.cursor = "grabbing";
          e.preventDefault();
        }
      });

      canvas.addEventListener("mouseup", () => {
        if (this.dragging !== null) {
          // Brief re-simulation after drag drop
          this.runSimulation(50);
          this.dragging = null;
        }
        canvas.style.cursor = "default";
      });

      canvas.addEventListener("mouseleave", () => {
        this.hovered = null;
        this.hideTooltip();
        if (this.dragging !== null) {
          this.runSimulation(50);
          this.dragging = null;
        }
      });

      // Touch support (mobile) - tap only
      canvas.addEventListener("touchstart", e => {
        const pos = getPos(e);
        const ni = nearestNode(pos);
        if (ni !== null) canvas.style.cursor = "pointer";
      }, { passive: true });

      canvas.addEventListener("touchend", e => {
        const pos = getPos(e.changedTouches ? { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY } : e);
        // Re-convert using the canvas rect
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const px = { x: pos.x * scaleX, y: pos.y * scaleY };
      }, { passive: true });
    },

    bindFilters() {
      // Genre pills
      const pillsContainer = document.getElementById("genre-pills");
      if (pillsContainer) {
        pillsContainer.addEventListener("click", e => {
          const pill = e.target.closest(".genre-pill");
          if (!pill) return;
          const genre = pill.dataset.genre;

          if (genre === "all") {
            this.filters.genres = new Set(["all"]);
            pillsContainer.querySelectorAll(".genre-pill").forEach(p => p.classList.toggle("active", p.dataset.genre === "all"));
          } else {
            this.filters.genres.delete("all");
            pill.classList.toggle("active");
            if ([...pillsContainer.querySelectorAll(".genre-pill.active")].filter(p => p.dataset.genre !== "all").length === 0) {
              this.filters.genres = new Set(["all"]);
              pillsContainer.querySelector("[data-genre='all']").classList.add("active");
            } else {
              if (pill.classList.contains("active")) this.filters.genres.add(genre);
              else this.filters.genres.delete(genre);
              pillsContainer.querySelector("[data-genre='all']").classList.remove("active");
            }
          }

          this.applyFilters();
        });
      }

      // Rating range sliders
      const rMin = document.getElementById("rating-min");
      const rMax = document.getElementById("rating-max");
      const rMinLbl = document.getElementById("rating-min-label");
      const rMaxLbl = document.getElementById("rating-max-label");
      const rFill = document.getElementById("range-track-fill");

      const updateRangeFill = () => {
        if (!rMin || !rMax || !rFill) return;
        const min = parseFloat(rMin.value);
        const max = parseFloat(rMax.value);
        const pMin = (min / 10) * 100;
        const pMax = (max / 10) * 100;
        rFill.style.left = `${pMin}%`;
        rFill.style.width = `${pMax - pMin}%`;
        if (rMinLbl) rMinLbl.textContent = min;
        if (rMaxLbl) rMaxLbl.textContent = max;
      };

      rMin?.addEventListener("input", () => {
        if (parseFloat(rMin.value) > parseFloat(rMax.value)) rMin.value = rMax.value;
        this.filters.ratingMin = parseFloat(rMin.value);
        updateRangeFill();
        this.applyFilters();
      });

      rMax?.addEventListener("input", () => {
        if (parseFloat(rMax.value) < parseFloat(rMin.value)) rMax.value = rMin.value;
        this.filters.ratingMax = parseFloat(rMax.value);
        updateRangeFill();
        this.applyFilters();
      });

      updateRangeFill();

      // Year filter
      document.getElementById("year-filter")?.addEventListener("change", e => {
        this.filters.year = e.target.value;
        this.applyFilters();
      });

      // Reset filters
      document.getElementById("reset-filters-btn")?.addEventListener("click", () => {
        this.filters = { genres: new Set(["all"]), ratingMin: 0, ratingMax: 10, year: "all" };
        if (rMin) rMin.value = 0;
        if (rMax) rMax.value = 10;
        document.getElementById("year-filter").value = "all";
        document.querySelectorAll(".genre-pill").forEach(p => p.classList.toggle("active", p.dataset.genre === "all"));
        updateRangeFill();
        this.nodes.forEach((n, i) => { n.opacity = 1; this.filteredNodes.add(i); });
        this.selected = null;
        this.startRenderLoop();
      });
    },

    // ── Tooltip ──────────────────────────────────────────────
    showTooltip(node, clientX, clientY) {
      if (!this.tooltip) return;
      const img = node.image ? imgCache[node.image] : null;
      const hasImg = img && img.complete && !img._failed;

      this.tooltip.innerHTML = `
        ${hasImg ? `<img class="tooltip-thumb" src="${node.image}" alt="${node.title}" loading="lazy">` : ""}
        <div class="tooltip-info">
          <div class="tooltip-title">${truncate(node.title, 22)}</div>
          ${node.score ? `<div class="tooltip-score">★ ${node.score.toFixed(1)}</div>` : ""}
          ${node.genres.length ? `<div class="tooltip-genres">${node.genres.slice(0, 3).join(", ")}</div>` : ""}
          ${node.year ? `<div class="tooltip-year">${node.year}</div>` : ""}
        </div>
      `;
      this.tooltip.classList.add("visible");

      // Position tooltip near cursor but within viewport
      const pad = 12;
      const tw = 240;
      const th = 100;
      let tx = clientX + pad;
      let ty = clientY - th / 2;

      if (tx + tw > window.innerWidth) tx = clientX - tw - pad;
      if (ty < 0) ty = pad;
      if (ty + th > window.innerHeight) ty = window.innerHeight - th - pad;

      this.tooltip.style.left = `${tx}px`;
      this.tooltip.style.top = `${ty}px`;
      this.tooltip.style.position = "fixed";
    },

    hideTooltip() {
      if (this.tooltip) this.tooltip.classList.remove("visible");
    },

    // ── Resize ────────────────────────────────────────────────
    handleResize(forceRedraw = false) {
      const canvas = this.canvas;
      const wrap = this.wrap;
      if (!canvas || !wrap) return;

      const oldW = canvas.width;
      const oldH = canvas.height;
      const newW = wrap.clientWidth || 800;
      const newH = wrap.clientHeight || 600;

      if (oldW === newW && oldH === newH && !forceRedraw) return;

      const scaleX = newW / (oldW || newW);
      const scaleY = newH / (oldH || newH);

      canvas.width  = newW;
      canvas.height = newH;

      // Rescale node positions proportionally
      if (oldW > 0 && oldH > 0) {
        this.nodes.forEach(n => {
          n.x *= scaleX;
          n.y *= scaleY;
        });
      } else if (this.nodes.length > 0) {
        // Initial placement
        const cx = newW / 2, cy = newH / 2;
        this.nodes.forEach((n, i) => {
          const angle = (i / this.nodes.length) * Math.PI * 2;
          const spread = Math.min(newW, newH) * 0.3;
          n.x = cx + Math.cos(angle) * spread;
          n.y = cy + Math.sin(angle) * spread;
        });
        this.runSimulation(300);
        return;
      }

      this.draw();
    }
  };

  // ── Init on DOM ready ─────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => GraphModule.init());
  } else {
    GraphModule.init();
  }

  // Expose globally so app.js can call it
  window.GraphModule = GraphModule;

})();
