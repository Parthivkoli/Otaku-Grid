/* =============================================================
   OTAKU GRID — app.js
   All collage logic, fetch engine, UI interactions, Phase 1–2+4
   ============================================================= */

// ── Presets ──────────────────────────────────────────────────
const PRESETS = {
  shonen: [
    "Naruto", "One Piece", "Dragon Ball Z", "Bleach", "My Hero Academia",
    "Demon Slayer", "Hunter x Hunter", "Fullmetal Alchemist: Brotherhood",
    "Jujutsu Kaisen", "Black Clover", "Chainsaw Man", "Tokyo Revengers", "Fire Force"
  ],
  romance: [
    "Toradora", "Your Lie in April", "Clannad", "Fruits Basket", "Horimiya",
    "Kaguya-sama: Love is War", "Oregairu", "Ao Haru Ride", "Kimi ni Todoke",
    "Maid Sama!", "Rent-a-Girlfriend", "Golden Time", "Nana"
  ],
  starter: [
    "Cowboy Bebop", "Death Note", "Attack on Titan", "Steins;Gate",
    "Neon Genesis Evangelion", "Violet Evergarden", "Made in Abyss",
    "Vinland Saga", "One Punch Man", "Mob Psycho 100", "Erased", "Cyberpunk: Edgerunners"
  ],
  isekai: [
    "Re:Zero", "Sword Art Online", "Overlord", "No Game No Life",
    "The Rising of the Shield Hero", "That Time I Got Reincarnated as a Slime",
    "Mushoku Tensei", "KonoSuba", "Log Horizon", "Saga of Tanya the Evil"
  ],
  fantasy: [
    "Frieren", "Delicious in Dungeon", "Ranking of Kings", "Magi", "Spice and Wolf",
    "Goblin Slayer", "The Ancient Magus' Bride", "DanMachi", "Fate/stay night",
    "To Your Eternity", "Yona of the Dawn", "Akame ga Kill!"
  ]
};

const BACKGROUNDS = {
  "#000000": "#000000",
  "transparent": "transparent",
  "gradient-midnight": "linear-gradient(135deg, #0f172a, #1e293b, #334155)",
  "gradient-cyberpunk": "linear-gradient(135deg, #120458, #ff007f, #00e5ff)",
  "gradient-sakura": "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
  "gradient-abyss": "linear-gradient(135deg, #0f2027, #203a43, #2c5364)"
};

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── State ─────────────────────────────────────────────────────
const state = {
  source: "anilist",
  gridMode: "3",
  cardStyle: "default",
  collageTheme: "void",
  showOverlay: true,
  editMode: false,
  entries: [],
  resultMap: new Map(),
  customLabels: new Map(),
  fetchedOnce: false,
  bgColor: "#000000",
  customCols: 5,
  customRows: 2,
  currentView: "collage",
  abortController: null,
  editingIndex: null,
  detailData: null,
  watchlist: new Set()
};

// ── Elements ──────────────────────────────────────────────────
const el = {
  input: document.getElementById("anime-input"),
  grid: document.getElementById("grid-container"),
  fetchBtn: document.getElementById("fetch-btn"),
  exportBtn: document.getElementById("export-btn"),
  exportFormat: document.getElementById("export-format"),
  clipboardBtn: document.getElementById("clipboard-btn"),
  copyLinkBtn: document.getElementById("copy-link-btn"),
  editGridBtn: document.getElementById("edit-grid-btn"),
  settingsBtn: document.getElementById("settings-btn"),
  overlayToggle: document.getElementById("overlay-toggle"),
  toast: document.getElementById("toast"),
  toastMsg: document.getElementById("toast-message"),
  settingsModal: document.getElementById("settings-modal"),
  modalClose: document.getElementById("modal-close"),
  clearCacheBtn: document.getElementById("clear-cache-btn"),
  editModal: document.getElementById("edit-modal"),
  editModalClose: document.getElementById("edit-modal-close"),
  editTitleInput: document.getElementById("edit-title-input"),
  editSaveBtn: document.getElementById("edit-save-btn"),
  editRemoveBtn: document.getElementById("edit-remove-btn"),
  detailModal: document.getElementById("detail-modal"),
  detailClose: document.getElementById("detail-modal-close"),
  detailCover: document.getElementById("detail-cover"),
  detailTitle: document.getElementById("detail-modal-title"),
  detailEnglish: document.getElementById("detail-english"),
  detailScore: document.getElementById("detail-score"),
  detailEpisodes: document.getElementById("detail-episodes"),
  detailYear: document.getElementById("detail-year"),
  detailStatus: document.getElementById("detail-status"),
  detailGenres: document.getElementById("detail-genres"),
  detailLinks: document.getElementById("detail-links"),
  sourceBtns: Array.from(document.querySelectorAll(".toggle-btn[data-source]")),
  gridBtns: Array.from(document.querySelectorAll(".seg-btn[data-grid]")),
  styleBtns: Array.from(document.querySelectorAll(".style-btn[data-style]")),
  themeBtns: Array.from(document.querySelectorAll(".theme-btn[data-theme]")),
  bgBtns: Array.from(document.querySelectorAll(".bg-btn")),
  presetShonen: document.getElementById("preset-shonen"),
  presetRomance: document.getElementById("preset-romance"),
  presetStarter: document.getElementById("preset-starter"),
  presetIsekai: document.getElementById("preset-isekai"),
  presetFantasy: document.getElementById("preset-fantasy"),
  seasonCurrent: document.getElementById("season-current"),
  seasonPrevious: document.getElementById("season-previous"),
  customGridBtn: document.getElementById("custom-grid-btn"),
  customGridInputs: document.getElementById("custom-grid-inputs"),
  applyCustomGrid: document.getElementById("apply-custom-grid"),
  customColsInput: document.getElementById("custom-cols"),
  customRowsInput: document.getElementById("custom-rows"),
  randomizeBtn: document.getElementById("randomize-btn"),
  saveLayoutBtn: document.getElementById("save-layout-btn"),
  loadLayoutInput: document.getElementById("load-layout-input"),
  viewCollageBtn: document.getElementById("view-collage-btn"),
  viewGraphBtn: document.getElementById("view-graph-btn"),
  collagePanel: document.getElementById("collage-panel"),
  graphPanel: document.getElementById("graph-panel"),
  exportControls: document.getElementById("export-controls"),
  autocomplete: document.getElementById("autocomplete-dropdown"),
  splash: document.getElementById("splash-screen")
};

// ── Utilities ─────────────────────────────────────────────────
const wait = ms => new Promise(res => setTimeout(res, ms));

function normalizeTitle(t) {
  return t ? t.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

function getRandomItems(arr, n) {
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, n);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Toast
let toastTimer;
function showToast(msg, type = "info") {
  if (!el.toast) return;
  el.toastMsg.textContent = msg;
  el.toast.className = `toast show toast-${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 3200);
}

el.toast?.querySelector("#toast-close")?.addEventListener("click", () => el.toast.classList.remove("show"));

// Cache with 7-day TTL
function getCache(key) {
  try {
    const item = localStorage.getItem(`acg_v2_${key}`);
    if (!item) return null;
    const parsed = JSON.parse(item);
    // Support both old format (plain object) and new (with .ts)
    if (parsed.ts && Date.now() - parsed.ts > CACHE_TTL) {
      localStorage.removeItem(`acg_v2_${key}`);
      return null;
    }
    return parsed.data ?? parsed; // new has .data, old is plain
  } catch { return null; }
}

function setCache(key, value) {
  try {
    localStorage.setItem(`acg_v2_${key}`, JSON.stringify({ data: value, ts: Date.now() }));
  } catch { }
}

// Watchlist persistence
function loadWatchlist() {
  try {
    const w = JSON.parse(localStorage.getItem("acg_watchlist") || "[]");
    state.watchlist = new Set(w);
  } catch { state.watchlist = new Set(); }
}

function saveWatchlist() {
  try {
    localStorage.setItem("acg_watchlist", JSON.stringify([...state.watchlist]));
  } catch { }
}

// ── Season Helpers ────────────────────────────────────────────
function getSeasons() {
  const d = new Date(), m = d.getMonth(), y = d.getFullYear();
  let cur, prev, prevY = y;
  if (m <= 2) { cur = "WINTER"; prev = "FALL"; prevY = y - 1; }
  else if (m <= 5) { cur = "SPRING"; prev = "WINTER"; }
  else if (m <= 8) { cur = "SUMMER"; prev = "SPRING"; }
  else { cur = "FALL"; prev = "SUMMER"; }
  return { current: { season: cur, year: y }, previous: { season: prev, year: prevY } };
}

// ── AniList Batched GraphQL ───────────────────────────────────
async function fetchAniListBatch(titles, signal) {
  // Build a multi-alias query — one request for all titles
  const aliases = titles.map((t, i) => {
    const escaped = t.replace(/"/g, '\\"');
    return `q${i}: Media(search: "${escaped}", type: ANIME) {
      id
      title { romaji english }
      coverImage { large }
      seasonYear
      genres
      averageScore
      episodes
      status
    }`;
  });

  const query = `query { ${aliases.join("\n")} }`;

  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query }),
      signal
    });

    if (res.status === 429) throw new Error("rate_limit");
    const json = await res.json();
    const out = {};

    titles.forEach((title, i) => {
      const media = json?.data?.[`q${i}`];
      const norm = normalizeTitle(title);
      if (!media) {
        out[norm] = { found: false, title, image: "" };
        return;
      }
      out[norm] = {
        found: true,
        title: media.title.english || media.title.romaji,
        romaji: media.title.romaji,
        english: media.title.english || "",
        image: media.coverImage?.large || "",
        year: media.seasonYear || "",
        genres: media.genres || [],
        genresStr: media.genres ? media.genres.slice(0, 3).join(", ") : "",
        score: media.averageScore ? (media.averageScore / 10).toFixed(1) : "",
        episodes: media.episodes || "",
        status: media.status || "",
        anilistId: media.id || null
      };
    });

    return out;
  } catch (err) {
    if (err.name === "AbortError") throw err;
    console.warn("AniList batch error:", err.message);
    return null;
  }
}

// ── Jikan Single Fetch (rate-limited queue) ───────────────────
const jikanQueue = [];
let jikanRunning = false;

function jikanEnqueue(title, signal) {
  return new Promise((resolve, reject) => {
    jikanQueue.push({ title, signal, resolve, reject });
    if (!jikanRunning) runJikanQueue();
  });
}

async function runJikanQueue() {
  jikanRunning = true;
  while (jikanQueue.length > 0) {
    const { title, signal, resolve, reject } = jikanQueue.shift();
    try {
      const result = await fetchJikanSingle(title, signal);
      resolve(result);
    } catch (e) {
      reject(e);
    }
    if (jikanQueue.length > 0) await wait(420);
  }
  jikanRunning = false;
}

async function fetchJikanSingle(title, signal) {
  const res = await fetch(
    `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`,
    { signal }
  );
  if (res.status === 429) throw new Error("rate_limit");
  const json = await res.json();
  const item = json?.data?.[0];
  if (!item) return null;
  return {
    found: true,
    title: item.title_english || item.title,
    romaji: item.title,
    english: item.title_english || "",
    image: item.images?.jpg?.large_image_url || "",
    year: item.year || "",
    genres: item.genres?.map(g => g.name) || [],
    genresStr: item.genres?.map(g => g.name).slice(0, 3).join(", ") || "",
    score: item.score ? item.score.toFixed(1) : "",
    episodes: item.episodes || "",
    status: item.status || "",
    malId: item.mal_id || null
  };
}

// ── Fetch Suggestions for Autocomplete ───────────────────────
async function fetchSuggestions(query) {
  if (!query || query.length < 2) return [];
  try {
    const gql = `query ($search: String) {
      Page(page: 1, perPage: 5) {
        media(search: $search, type: ANIME) {
          title { romaji english }
          coverImage { medium }
          seasonYear
        }
      }
    }`;
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: gql, variables: { search: query } })
    });
    const json = await res.json();
    return json?.data?.Page?.media || [];
  } catch { return []; }
}

// ── Seasonal Fetch ────────────────────────────────────────────
async function fetchSeasonalAnime(season, year) {
  const gql = `query($season: MediaSeason, $seasonYear: Int) {
    Page(page: 1, perPage: 15) {
      media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
        title { english romaji }
      }
    }
  }`;
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: gql, variables: { season, seasonYear: year } })
    });
    const json = await res.json();
    return json.data.Page.media.map(m => m.title.english || m.title.romaji);
  } catch (err) {
    console.error("Seasonal fetch error:", err);
    return [];
  }
}

// ── Grid Rendering ────────────────────────────────────────────
function applyGridClass() {
  el.grid.className = "grid-container";
  el.grid.classList.add(`theme-${state.collageTheme}`);

  if (state.cardStyle === "polaroid") el.grid.classList.add("style-polaroid");

  if (state.gridMode === "auto") {
    el.grid.classList.add("grid-auto");
    el.grid.style.gridTemplateColumns = "";
  } else if (state.gridMode === "custom") {
    el.grid.classList.add("grid-custom");
    el.grid.style.gridTemplateColumns = `repeat(${state.customCols}, var(--tile-width))`;
  } else {
    el.grid.classList.add(`grid-${state.gridMode}x${state.gridMode}`);
    el.grid.style.gridTemplateColumns = "";
  }
}

function totalTileCount() {
  if (state.gridMode === "auto") return state.entries.length;
  if (state.gridMode === "custom") return state.customCols * state.customRows;
  return Math.pow(parseInt(state.gridMode), 2);
}

function renderGrid() {
  if (!el.grid) return;
  applyGridClass();
  el.grid.innerHTML = "";

  const count = totalTileCount();

  for (let i = 0; i < count; i++) {
    const entry = state.entries[i];
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.index = i;
    tile.style.setProperty("--i-delay", `${i * 55}ms`);

    if (!entry) {
      tile.classList.add("empty");
      el.grid.appendChild(tile);
      continue;
    }

    const norm = normalizeTitle(entry);
    const result = state.resultMap.get(norm);

    if (!result) {
      tile.classList.add("loading");
      el.grid.appendChild(tile);
      continue;
    }

    if (!result.found || !result.image) {
      tile.classList.add("not-found");
      tile.innerHTML = `<span>⚠</span><p>${entry}</p>`;
      el.grid.appendChild(tile);
      continue;
    }

    // ── Cache badge ──
    const cachedRaw = localStorage.getItem(`acg_v2_${norm}`);
    if (cachedRaw) {
      const badge = document.createElement("div");
      badge.className = "cache-badge";
      badge.textContent = "⚡";
      tile.appendChild(badge);
    }

    // ── Watchlist button ──
    const starBtn = document.createElement("button");
    starBtn.className = "watchlist-btn";
    starBtn.title = state.watchlist.has(norm) ? "Remove from watchlist" : "Add to watchlist";
    starBtn.innerHTML = state.watchlist.has(norm) ? "✅" : "⭐";
    starBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (state.watchlist.has(norm)) {
        state.watchlist.delete(norm);
      } else {
        state.watchlist.add(norm);
      }
      saveWatchlist();
      renderGrid();
    });
    tile.appendChild(starBtn);

    // ── Watched overlay ──
    if (state.watchlist.has(norm)) {
      const overlay = document.createElement("div");
      overlay.className = "watched-overlay";
      overlay.innerHTML = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      tile.appendChild(overlay);
    }

    // ── Image ──
    const img = document.createElement("img");
    img.alt = result.title;
    img.loading = "lazy";
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.src = result.image;
    img.onerror = () => {
      if (!img.dataset.triedProxy) {
        img.dataset.triedProxy = "true";
        img.src = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(result.image)}`;
      } else {
        tile.classList.add("not-found");
        tile.innerHTML = `<span>⚠</span><p>Image Blocked</p>`;
      }
    };
    tile.appendChild(img);

    // ── Label ──
    const label = state.customLabels.get(norm) || null;
    const displayTitle = label !== null ? label : result.title;

    if (state.cardStyle === "polaroid") {
      const info = document.createElement("div");
      info.className = "polaroid-info";
      info.innerHTML = `
        <div class="p-title-row">
          <span class="p-title">${displayTitle}</span>
          <span class="p-year">${result.year}</span>
        </div>
        <div class="p-meta"><span class="l">GENRE</span>${result.genresStr || result.genres?.join(", ") || ""}</div>
      `;
      // Double-click inline editing
      info.querySelector(".p-title").addEventListener("dblclick", e => {
        e.stopPropagation();
        startInlineEdit(info.querySelector(".p-title"), norm);
      });
      tile.appendChild(info);
    } else if (state.showOverlay) {
      const info = document.createElement("div");
      info.className = "tile-info";
      const titleEl = document.createElement("div");
      titleEl.className = "t-title";
      titleEl.textContent = displayTitle;
      titleEl.addEventListener("dblclick", e => {
        e.stopPropagation();
        startInlineEdit(titleEl, norm);
      });
      const yearEl = document.createElement("div");
      yearEl.className = "t-year";
      yearEl.textContent = result.year;
      info.appendChild(titleEl);
      info.appendChild(yearEl);
      tile.appendChild(info);
    }

    // ── Drag and Drop ──
    setupDragAndDrop(tile);
    // ── Click for detail modal (vs drag detection) ──
    setupTileClick(tile, result, norm);

    el.grid.appendChild(tile);
  }
}

// ── Inline Label Edit ─────────────────────────────────────────
function startInlineEdit(spanEl, norm) {
  if (spanEl.contentEditable === "true") return;
  spanEl.contentEditable = "true";
  spanEl.focus();
  // Select all text
  const range = document.createRange();
  range.selectNodeContents(spanEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const finish = () => {
    spanEl.contentEditable = "false";
    const newLabel = spanEl.textContent.trim();
    if (newLabel) state.customLabels.set(norm, newLabel);
    else state.customLabels.delete(norm);
  };

  spanEl.addEventListener("blur", finish, { once: true });
  spanEl.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); spanEl.blur(); }
    if (e.key === "Escape") { spanEl.textContent = state.customLabels.get(norm) || state.resultMap.get(norm)?.title || ""; spanEl.blur(); }
  });
}

// ── Tile Click / Drag Detection ───────────────────────────────
function setupTileClick(tile, result, norm) {
  let mouseDownTime = 0;
  let mouseMoved = false;

  tile.addEventListener("mousedown", e => {
    if (e.target.closest(".watchlist-btn")) return;
    mouseDownTime = Date.now();
    mouseMoved = false;
  });

  tile.addEventListener("mousemove", () => { mouseMoved = true; });

  tile.addEventListener("click", e => {
    if (e.target.closest(".watchlist-btn")) return;
    if (state.editMode) { openEditModal(parseInt(tile.dataset.index)); return; }
    const duration = Date.now() - mouseDownTime;
    if (!mouseMoved && duration < 250) {
      openDetailModal(result, norm);
    }
  });
}

// ── Detail Modal ──────────────────────────────────────────────
function openDetailModal(result, norm) {
  if (!result || !result.found) return;

  el.detailCover.src = result.image || "";
  el.detailCover.alt = result.title || "";
  el.detailTitle.textContent = result.romaji || result.title || "";
  el.detailEnglish.textContent = result.english && result.english !== result.romaji ? result.english : "";
  el.detailScore.textContent = result.score ? `★ ${result.score}` : "N/A";
  el.detailEpisodes.textContent = result.episodes || "—";
  el.detailYear.textContent = result.year || "—";
  el.detailStatus.textContent = formatStatus(result.status);

  // Genres
  el.detailGenres.innerHTML = "";
  const genres = result.genres || (result.genresStr ? result.genresStr.split(", ") : []);
  genres.slice(0, 6).forEach(g => {
    const tag = document.createElement("span");
    tag.className = "detail-genre-tag";
    tag.textContent = g;
    el.detailGenres.appendChild(tag);
  });

  // Links
  el.detailLinks.innerHTML = "";
  if (result.anilistId) {
    const a = document.createElement("a");
    a.href = `https://anilist.co/anime/${result.anilistId}`;
    a.target = "_blank";
    a.className = "detail-link detail-link-anilist";
    a.textContent = "AniList";
    el.detailLinks.appendChild(a);
  }
  if (result.malId) {
    const a = document.createElement("a");
    a.href = `https://myanimelist.net/anime/${result.malId}`;
    a.target = "_blank";
    a.className = "detail-link detail-link-mal";
    a.textContent = "MyAnimeList";
    el.detailLinks.appendChild(a);
  }

  state.detailData = { result, norm };
  openModal(el.detailModal);
}

function formatStatus(s) {
  if (!s) return "—";
  return s.replace(/_/g, " ").split(" ").map(w => w[0] + w.slice(1).toLowerCase()).join(" ");
}

// ── Drag & Drop ───────────────────────────────────────────────
function setupDragAndDrop(tile) {
  tile.draggable = true;
  tile.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", tile.dataset.index);
    tile.style.opacity = "0.4";
  });
  tile.addEventListener("dragend", () => tile.style.opacity = "1");
  tile.addEventListener("dragover", e => e.preventDefault());
  tile.addEventListener("drop", e => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData("text/plain"));
    const to = parseInt(tile.dataset.index);
    if (!isNaN(from) && !isNaN(to) && from !== to) {
      [state.entries[from], state.entries[to]] = [state.entries[to], state.entries[from]];
      renderGrid();
    }
  });
}

// ── Generate / Fetch ──────────────────────────────────────────
async function handleGenerate() {
  const titles = el.input.value.split("\n")
    .map(t => t.replace(/^\d+[\.\)\-]?\s*/, "").trim())
    .filter(Boolean);

  if (titles.length === 0) return;

  el.input.value = titles.join("\n");
  state.entries = [...titles];
  state.fetchedOnce = true;

  // Cancel any in-flight request
  if (state.abortController) state.abortController.abort();
  state.abortController = new AbortController();
  const signal = state.abortController.signal;

  el.fetchBtn.disabled = true;
  el.fetchBtn.textContent = "Fetching…";
  renderGrid();

  // Determine which titles need fetching
  const uncached = titles.filter(t => !state.resultMap.has(normalizeTitle(t)) && !getCache(normalizeTitle(t)));
  const fromCache = titles.filter(t => {
    const c = getCache(normalizeTitle(t));
    if (c) { state.resultMap.set(normalizeTitle(t), c); return true; }
    return false;
  });

  if (fromCache.length > 0) renderGrid();

  // Batch fetch uncached titles via AniList
  if (uncached.length > 0) {
    try {
      if (state.source === "anilist" || true) {
        // Always try AniList batch first
        const batchResults = await fetchAniListBatch(uncached, signal);
        if (batchResults) {
          uncached.forEach(t => {
            const norm = normalizeTitle(t);
            if (batchResults[norm]) {
              state.resultMap.set(norm, batchResults[norm]);
              setCache(norm, batchResults[norm]);
            }
          });
        }
      }
    } catch (err) {
      if (err.name === "AbortError") { el.fetchBtn.disabled = false; el.fetchBtn.textContent = "Generate Collage"; return; }
    }

    // Fallback: any titles still missing — try Jikan sequentially
    const stillMissing = uncached.filter(t => {
      const r = state.resultMap.get(normalizeTitle(t));
      return !r || !r.found || !r.image;
    });

    for (const t of stillMissing) {
      if (signal.aborted) break;
      const norm = normalizeTitle(t);
      try {
        const jResult = await jikanEnqueue(t, signal);
        const final = jResult || { found: false, title: t, image: "" };
        state.resultMap.set(norm, final);
        setCache(norm, final);
        renderGrid();
      } catch (e) {
        if (e.name === "AbortError") break;
        const fallback = { found: false, title: t, image: "" };
        state.resultMap.set(norm, fallback);
        setCache(norm, fallback);
      }
    }
  }

  renderGrid();
  el.fetchBtn.disabled = false;
  el.fetchBtn.textContent = "Generate Collage";
  updateShareUrl();

  // Notify graph module
  if (typeof window.GraphModule !== "undefined") {
    window.GraphModule.loadFromAppState(state);
  }
}

// ── Randomize / Shuffle ───────────────────────────────────────
function handleRandomize() {
  if (state.entries.length < 2) return;

  // Animate all tiles with flip
  document.querySelectorAll(".tile:not(.empty):not(.loading):not(.not-found)").forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add("flipping");
      tile.addEventListener("animationend", () => tile.classList.remove("flipping"), { once: true });
    }, i * 35);
  });

  setTimeout(() => {
    // Fisher-Yates shuffle
    const arr = [...state.entries];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    state.entries = arr;
    renderGrid();
  }, 220);
}

// ── Export ────────────────────────────────────────────────────
async function handleExport() {
  if (!state.fetchedOnce) return showToast("Generate your collage first!", "error");

  const origText = el.exportBtn.textContent;
  el.exportBtn.textContent = "Rendering…";
  el.exportBtn.disabled = true;

  const watermark = document.createElement("div");
  watermark.style.cssText = "position:absolute;bottom:8px;right:14px;color:rgba(255,255,255,0.55);font-size:13px;font-weight:700;font-family:Inter,sans-serif;z-index:100;pointer-events:none;";
  watermark.innerHTML = "Otaku Grid <span style='opacity:0.6;font-weight:400'>parthivkoli.github.io/Otaku-Grid</span>";
  el.grid.appendChild(watermark);

  const origBg = el.grid.style.background;
  el.grid.style.background = BACKGROUNDS[state.bgColor] || state.bgColor;
  el.grid.classList.add("export-mode");

  try {
    const canvas = await html2canvas(el.grid, {
      useCORS: true,
      scale: 2,
      backgroundColor: (state.bgColor === "transparent" || state.bgColor.startsWith("gradient")) ? null : state.bgColor
    });

    const format = el.exportFormat.value;
    const quality = format === "jpeg" ? 0.92 : undefined;
    const link = document.createElement("a");
    link.download = `otaku-collage.${format}`;
    link.href = canvas.toDataURL(`image/${format}`, quality);
    link.click();
    showToast("Collage exported! 🎉", "success");
  } catch (err) {
    console.error("Export Error:", err);
    showToast("Export failed.", "error");
  } finally {
    watermark.remove();
    el.grid.style.background = origBg;
    el.grid.classList.remove("export-mode");
    el.exportBtn.textContent = origText;
    el.exportBtn.disabled = false;
  }
}

// ── Copy to Clipboard ─────────────────────────────────────────
async function handleClipboard() {
  if (!state.fetchedOnce) return showToast("Generate your collage first!", "error");
  if (!navigator.clipboard?.write) return showToast("Clipboard API not supported in this browser.", "error");

  const origText = el.clipboardBtn.innerHTML;
  el.clipboardBtn.disabled = true;

  const origBg = el.grid.style.background;
  el.grid.style.background = BACKGROUNDS[state.bgColor] || state.bgColor;
  el.grid.classList.add("export-mode");

  try {
    const canvas = await html2canvas(el.grid, { useCORS: true, scale: 2, backgroundColor: state.bgColor === "transparent" ? null : state.bgColor });
    canvas.toBlob(async blob => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        showToast("Copied to clipboard! 📋", "success");
      } catch (e) {
        showToast("Clipboard write failed.", "error");
      }
    }, "image/png");
  } catch (err) {
    showToast("Render failed.", "error");
  } finally {
    el.grid.style.background = origBg;
    el.grid.classList.remove("export-mode");
    el.clipboardBtn.innerHTML = origText;
    el.clipboardBtn.disabled = false;
  }
}

// ── Share URL ─────────────────────────────────────────────────
function updateShareUrl() {
  const titles = el.input.value.trim();
  const url = new URL(window.location);
  if (!titles) {
    url.searchParams.delete("list");
  } else {
    url.searchParams.set("list", btoa(unescape(encodeURIComponent(titles))));
  }
  window.history.replaceState({}, "", url);
}

async function handleCopyLink() {
  el.copyLinkBtn.disabled = true;
  updateShareUrl();
  const longUrl = window.location.href;

  if (longUrl.includes("127.0.0.1") || longUrl.includes("localhost") || longUrl.startsWith("file:")) {
    await navigator.clipboard.writeText(longUrl);
    showToast("Link copied! (Localhost)", "success");
  } else {
    try {
      const apiUrl = `https://clck.ru/--?url=${encodeURIComponent(longUrl)}`;
      const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(apiUrl)}&t=${Date.now()}`);
      if (!res.ok) throw new Error("Proxy rejected");
      const shortUrl = (await res.text()).trim();
      if (shortUrl.startsWith("http")) {
        await navigator.clipboard.writeText(shortUrl);
        showToast("Short link copied! 🔗", "success");
      } else throw new Error("Invalid URL");
    } catch {
      await navigator.clipboard.writeText(longUrl);
      showToast("Link copied!", "success");
    }
  }

  el.copyLinkBtn.disabled = false;
}

// ── URL Hydration ─────────────────────────────────────────────
function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const list = params.get("list");
  if (list) {
    try {
      el.input.value = decodeURIComponent(escape(atob(list)));
      handleGenerate();
    } catch { }
  }
}

// ── Save / Load Layout ────────────────────────────────────────
function handleSaveLayout() {
  if (!state.fetchedOnce) return showToast("Nothing to save yet.", "error");
  const layout = {
    entries: state.entries,
    gridMode: state.gridMode,
    customCols: state.customCols,
    customRows: state.customRows,
    source: state.source,
    cardStyle: state.cardStyle,
    collageTheme: state.collageTheme,
    bgColor: state.bgColor,
    showOverlay: state.showOverlay,
    customLabels: [...state.customLabels.entries()]
  };
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "otaku-grid-layout.json";
  a.click();
  showToast("Layout saved! 💾", "success");
}

function handleLoadLayout(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const layout = JSON.parse(e.target.result);
      state.entries = layout.entries || [];
      state.gridMode = layout.gridMode || "3";
      state.customCols = layout.customCols || 5;
      state.customRows = layout.customRows || 2;
      state.source = layout.source || "anilist";
      state.cardStyle = layout.cardStyle || "default";
      state.collageTheme = layout.collageTheme || "void";
      state.bgColor = layout.bgColor || "#000000";
      state.showOverlay = layout.showOverlay !== undefined ? layout.showOverlay : true;
      state.customLabels = new Map(layout.customLabels || []);
      state.fetchedOnce = state.entries.length > 0;

      el.input.value = state.entries.join("\n");
      syncUIToState();

      // Fetch any missing data
      if (state.fetchedOnce) handleGenerate();
      showToast("Layout loaded! 📂", "success");
    } catch {
      showToast("Invalid layout file.", "error");
    }
  };
  reader.readAsText(file);
}

// Sync UI toggles to state (after load)
function syncUIToState() {
  el.sourceBtns.forEach(b => b.classList.toggle("active", b.dataset.source === state.source));
  el.gridBtns.forEach(b => b.classList.toggle("active", b.dataset.grid === state.gridMode));
  el.styleBtns.forEach(b => b.classList.toggle("active", b.dataset.style === state.cardStyle));
  el.themeBtns.forEach(b => b.classList.toggle("active", b.dataset.theme === state.collageTheme));
  el.bgBtns.forEach(b => b.classList.toggle("active", b.dataset.bg === state.bgColor));
  el.overlayToggle.checked = state.showOverlay;
}

// ── Autocomplete ──────────────────────────────────────────────
let autocompleteAc = null;

function getActiveLineInfo() {
  const text = el.input.value;
  const pos = el.input.selectionStart;
  const before = text.slice(0, pos);
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineEnd = text.indexOf("\n", pos);
  const rawLine = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const line = rawLine.replace(/^\d+[\.\)\-]?\s*/, "").trim();
  return { line, lineStart, lineEnd: lineEnd === -1 ? text.length : lineEnd };
}

function positionAutocomplete() {
  // Position below textarea
  const rect = el.input.getBoundingClientRect();
  el.autocomplete.style.left = `${rect.left}px`;
  el.autocomplete.style.top = `${rect.bottom + 4}px`;
  el.autocomplete.style.width = `${rect.width}px`;
}

const debouncedAutocompleteFetch = debounce(async () => {
  const { line } = getActiveLineInfo();
  if (!line || line.length < 2) { hideAutocomplete(); return; }

  if (autocompleteAc) autocompleteAc.abort();
  autocompleteAc = new AbortController();

  const suggestions = await fetchSuggestions(line);
  if (!suggestions.length) { hideAutocomplete(); return; }

  el.autocomplete.innerHTML = "";
  suggestions.forEach(s => {
    const displayTitle = s.title.english || s.title.romaji;
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.setAttribute("role", "option");
    item.innerHTML = `
      <img src="${s.coverImage?.medium || ""}" alt="${displayTitle}" loading="lazy">
      <div>
        <div class="autocomplete-item-title">${displayTitle}</div>
        <div class="autocomplete-item-year">${s.seasonYear || ""}</div>
      </div>
    `;
    item.addEventListener("click", () => {
      const { lineStart, lineEnd } = getActiveLineInfo();
      const text = el.input.value;
      el.input.value = text.slice(0, lineStart) + displayTitle + text.slice(lineEnd);
      hideAutocomplete();
      el.input.focus();
    });
    el.autocomplete.appendChild(item);
  });

  positionAutocomplete();
  el.autocomplete.style.display = "block";
}, 400);

function hideAutocomplete() {
  el.autocomplete.style.display = "none";
  el.autocomplete.innerHTML = "";
}

// ── View Switching ────────────────────────────────────────────
function switchView(view) {
  if (state.currentView === view) return;
  const from = state.currentView;
  state.currentView = view;

  // Transition
  if (view === "graph") {
    el.collagePanel.classList.remove("active");
    el.graphPanel.classList.add("active");
    el.viewCollageBtn.classList.remove("active");
    el.viewGraphBtn.classList.add("active");
    // Notify graph module
    if (typeof window.GraphModule !== "undefined") {
      window.GraphModule.onActivate(state);
    }
  } else {
    el.graphPanel.classList.remove("active");
    el.collagePanel.classList.add("active");
    el.viewGraphBtn.classList.remove("active");
    el.viewCollageBtn.classList.add("active");
  }
}

// ── Modal Helpers ─────────────────────────────────────────────
function openModal(modal) {
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}

// Close modal on backdrop click
document.addEventListener("click", e => {
  if (e.target.classList.contains("modal")) closeModal(e.target);
});

// Close modal on Esc
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal.active").forEach(m => closeModal(m));
    hideAutocomplete();
  }
});

// ── Edit Modal ────────────────────────────────────────────────
function openEditModal(idx) {
  state.editingIndex = idx;
  el.editTitleInput.value = state.entries[idx] || "";
  openModal(el.editModal);
  setTimeout(() => el.editTitleInput.focus(), 100);
}

async function handleEditSave() {
  const newTitle = el.editTitleInput.value.trim();
  if (!newTitle || state.editingIndex === null) return;

  state.entries[state.editingIndex] = newTitle;
  el.input.value = state.entries.filter(Boolean).join("\n");
  closeModal(el.editModal);

  const norm = normalizeTitle(newTitle);
  if (!state.resultMap.has(norm)) {
    renderGrid();
    try {
      const batch = await fetchAniListBatch([newTitle], state.abortController?.signal || new AbortController().signal);
      if (batch && batch[norm]) {
        state.resultMap.set(norm, batch[norm]);
        setCache(norm, batch[norm]);
      }
    } catch { }
  }
  renderGrid();
  updateShareUrl();
}

function handleEditRemove() {
  if (state.editingIndex === null) return;
  state.entries.splice(state.editingIndex, 1);
  el.input.value = state.entries.filter(Boolean).join("\n");
  closeModal(el.editModal);
  renderGrid();
  updateShareUrl();
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  loadWatchlist();

  // Splash screen auto-dismiss
  if (el.splash) {
    el.splash.addEventListener("animationend", () => {
      el.splash.classList.add("hidden");
    });
  }

  // Generate
  el.fetchBtn?.addEventListener("click", handleGenerate);

  // Export
  el.exportBtn?.addEventListener("click", handleExport);

  // Clipboard
  el.clipboardBtn?.addEventListener("click", handleClipboard);

  // Share link
  el.copyLinkBtn?.addEventListener("click", handleCopyLink);

  // Randomize
  el.randomizeBtn?.addEventListener("click", handleRandomize);

  // Save Layout
  el.saveLayoutBtn?.addEventListener("click", handleSaveLayout);

  // Load Layout
  el.loadLayoutInput?.addEventListener("change", e => handleLoadLayout(e.target.files[0]));

  // View Switch
  el.viewCollageBtn?.addEventListener("click", () => switchView("collage"));
  el.viewGraphBtn?.addEventListener("click", () => switchView("graph"));

  // Source toggle
  el.sourceBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      state.source = btn.dataset.source;
      el.sourceBtns.forEach(b => b.classList.toggle("active", b === btn));
    });
  });

  // Grid size buttons
  el.gridBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      el.customGridInputs.style.display = "none";
      el.customGridBtn?.classList.remove("active");
      state.gridMode = btn.dataset.grid;
      el.gridBtns.forEach(b => b.classList.toggle("active", b === btn));
      renderGrid();
    });
  });

  // Custom grid
  el.customGridBtn?.addEventListener("click", () => {
    el.customGridInputs.style.display = "flex";
    state.gridMode = "custom";
    el.gridBtns.forEach(b => b.classList.remove("active"));
    el.customGridBtn.classList.add("active");
    renderGrid();
  });

  el.applyCustomGrid?.addEventListener("click", () => {
    state.customCols = parseInt(el.customColsInput.value) || 5;
    state.customRows = parseInt(el.customRowsInput.value) || 2;
    renderGrid();
  });

  // Card style
  el.styleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      state.cardStyle = btn.dataset.style;
      el.styleBtns.forEach(b => b.classList.toggle("active", b === btn));
      renderGrid();
    });
  });

  // Collage themes
  el.themeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      state.collageTheme = btn.dataset.theme;
      el.themeBtns.forEach(b => b.classList.toggle("active", b === btn));
      renderGrid();
    });
  });

  // Background
  el.bgBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      state.bgColor = btn.dataset.bg;
      el.bgBtns.forEach(b => b.classList.toggle("active", b === btn));
    });
  });

  // Show titles toggle
  el.overlayToggle?.addEventListener("change", e => {
    state.showOverlay = e.target.checked;
    renderGrid();
  });

  // Settings modal
  el.settingsBtn?.addEventListener("click", () => openModal(el.settingsModal));
  el.modalClose?.addEventListener("click", () => closeModal(el.settingsModal));

  // Edit modal
  el.editModalClose?.addEventListener("click", () => closeModal(el.editModal));
  el.editSaveBtn?.addEventListener("click", handleEditSave);
  el.editRemoveBtn?.addEventListener("click", handleEditRemove);

  // Edit grid mode
  el.editGridBtn?.addEventListener("click", () => {
    state.editMode = !state.editMode;
    el.editGridBtn.textContent = state.editMode ? "✅ Done" : "✏️ Edit Grid";
    el.editGridBtn.style.borderColor = state.editMode ? "var(--accent)" : "";
    renderGrid();
  });

  // Detail modal
  el.detailClose?.addEventListener("click", () => closeModal(el.detailModal));

  // Clear cache
  el.clearCacheBtn?.addEventListener("click", () => {
    Object.keys(localStorage).filter(k => k.startsWith("acg_v2_")).forEach(k => localStorage.removeItem(k));
    state.resultMap.clear();
    showToast("Cache cleared! 🗑️");
    closeModal(el.settingsModal);
    location.reload();
  });

  // Presets
  el.presetShonen?.addEventListener("click", () => { el.input.value = getRandomItems(PRESETS.shonen, 9).join("\n"); handleGenerate(); });
  el.presetRomance?.addEventListener("click", () => { el.input.value = getRandomItems(PRESETS.romance, 9).join("\n"); handleGenerate(); });
  el.presetStarter?.addEventListener("click", () => { el.input.value = getRandomItems(PRESETS.starter, 9).join("\n"); handleGenerate(); });
  el.presetIsekai?.addEventListener("click", () => { el.input.value = getRandomItems(PRESETS.isekai, 9).join("\n"); handleGenerate(); });
  el.presetFantasy?.addEventListener("click", () => { el.input.value = getRandomItems(PRESETS.fantasy, 9).join("\n"); handleGenerate(); });

  // Seasonal fetch
  async function handleSeasonalClick(sznInfo) {
    el.input.value = `Fetching ${sznInfo.season} ${sznInfo.year} anime…`;
    const titles = await fetchSeasonalAnime(sznInfo.season, sznInfo.year);
    if (titles.length) {
      el.input.value = titles.join("\n");
      state.gridMode = "auto";
      el.gridBtns.forEach(b => b.classList.toggle("active", b.dataset.grid === "auto"));
      await handleGenerate();
    } else {
      el.input.value = "Failed to fetch seasonal anime.";
    }
  }

  el.seasonCurrent?.addEventListener("click", () => handleSeasonalClick(getSeasons().current));
  el.seasonPrevious?.addEventListener("click", () => handleSeasonalClick(getSeasons().previous));

  // Autocomplete
  el.input?.addEventListener("input", () => { debouncedAutocompleteFetch(); });
  el.input?.addEventListener("blur", () => setTimeout(hideAutocomplete, 180));
  el.input?.addEventListener("keydown", e => {
    if (e.key === "Enter" && el.autocomplete.style.display === "block") {
      e.stopPropagation();
    }
  });
  window.addEventListener("resize", () => {
    if (el.autocomplete.style.display === "block") positionAutocomplete();
  });

  // URL hydration
  hydrateFromUrl();
  renderGrid();
}

init();

// Expose state for graph module
window.AppState = state;
window.AppFns = { openDetailModal, normalizeTitle };
