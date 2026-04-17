const PRESETS = {
  shonen: [
    "Naruto", "One Piece", "Dragon Ball Z", "Bleach", "My Hero Academia", "Demon Slayer", "Hunter x Hunter", 
    "Fullmetal Alchemist: Brotherhood", "Jujutsu Kaisen", "Black Clover", "Chainsaw Man", "Tokyo Revengers", "Fire Force"
  ],
  romance: [
    "Toradora", "Your Lie in April", "Clannad", "Fruits Basket", "Horimiya", "Kaguya-sama: Love is War", 
    "Oregairu", "Ao Haru Ride", "Kimi ni Todoke", "Maid Sama!", "Rent-a-Girlfriend", "Golden Time", "Nana"
  ],
  starter: [
    "Cowboy Bebop", "Death Note", "Attack on Titan", "Steins;Gate", "Neon Genesis Evangelion", "Violet Evergarden", 
    "Made in Abyss", "Vinland Saga", "One Punch Man", "Mob Psycho 100", "Erased", "Cyberpunk: Edgerunners"
  ],
  isekai: [
    "Re:Zero", "Sword Art Online", "Overlord", "No Game No Life", "The Rising of the Shield Hero", 
    "That Time I Got Reincarnated as a Slime", "Mushoku Tensei", "KonoSuba", "Log Horizon", "Saga of Tanya the Evil"
  ],
  fantasy: [
    "Frieren", "Delicious in Dungeon", "Ranking of Kings", "Magi", "Spice and Wolf", "Goblin Slayer", 
    "The Ancient Magus' Bride", "DanMachi", "Fate/stay night", "To Your Eternity", "Yona of the Dawn", "Akame ga Kill!"
  ]
};

const state = {
  source: "anilist",
  gridMode: "3",
  showOverlay: true,
  editMode: false,
  entries: [],
  resultMap: new Map(),
  fetchedOnce: false,
  bgColor: "#000000",
  customCols: 5,
  customRows: 2,
  cardStyle: "default"
};

const elements = {
  input: document.getElementById("anime-input"),
  grid: document.getElementById("grid-container"),
  fetchBtn: document.getElementById("fetch-btn"),
  exportBtn: document.getElementById("export-btn"),
  exportFormat: document.getElementById("export-format"),
  copyLinkBtn: document.getElementById("copy-link-btn"),
  editGridBtn: document.getElementById("edit-grid-btn"),
  settingsBtn: document.getElementById("settings-btn"),
  overlayToggle: document.getElementById("overlay-toggle"),
  toast: document.getElementById("toast"),
  toastMessage: document.getElementById("toast-message"),
  modal: document.getElementById("settings-modal"),
  modalClose: document.getElementById("modal-close"),
  clearCacheBtn: document.getElementById("clear-cache-btn"),
  sourceBtns: Array.from(document.querySelectorAll(".toggle-btn[data-source]")),
  gridBtns: Array.from(document.querySelectorAll(".seg-btn[data-grid]")),
  styleBtns: Array.from(document.querySelectorAll(".style-btn[data-style]")),
  bgBtns: Array.from(document.querySelectorAll(".bg-btn")),
  presetShonen: document.getElementById("preset-shonen"),
  presetRomance: document.getElementById("preset-romance"),
  presetStarter: document.getElementById("preset-starter"),
  presetIsekai: document.getElementById("preset-isekai"),
  presetFantasy: document.getElementById("preset-fantasy"),
  seasonPrevious: document.getElementById("season-previous"),
  customGridBtn: document.getElementById("custom-grid-btn"),
  customGridInputs: document.getElementById("custom-grid-inputs"),
  applyCustomGrid: document.getElementById("apply-custom-grid"),
  customColsInput: document.getElementById("custom-cols"),
  customRowsInput: document.getElementById("custom-rows")
};

// --- Utilities ---
const wait = (ms) => new Promise(res => setTimeout(res, ms));

function getRandomItems(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getSeasons() {
  const date = new Date();
  const month = date.getMonth();
  const year = date.getFullYear();
  let currentSeason, previousSeason, prevYear = year;
  
  if (month >= 0 && month <= 2) { currentSeason = "WINTER"; previousSeason = "FALL"; prevYear = year - 1; }
  else if (month >= 3 && month <= 5) { currentSeason = "SPRING"; previousSeason = "WINTER"; }
  else if (month >= 6 && month <= 8) { currentSeason = "SUMMER"; previousSeason = "SPRING"; }
  else { currentSeason = "FALL"; previousSeason = "SUMMER"; }
  
  return { current: { season: currentSeason, year }, previous: { season: previousSeason, year: prevYear } };
}

const BACKGROUNDS = {
  "#000000": "#000000",
  "transparent": "transparent",
  "gradient-midnight": "linear-gradient(135deg, #0f172a, #1e293b, #334155)",
  "gradient-cyberpunk": "linear-gradient(135deg, #120458, #ff007f, #00e5ff)",
  "gradient-sakura": "linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)",
  "gradient-abyss": "linear-gradient(135deg, #0f2027, #203a43, #2c5364)"
};

function normalizeTitle(title) {
  return title ? title.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

function showToast(message, type = "info") {
  if (!elements.toast) return;
  elements.toastMessage.textContent = message;
  elements.toast.className = `toast show toast-${type}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("show"), 3000);
}

function getCache(key) {
  try {
    const data = localStorage.getItem(`acg_v2_${key}`);
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
}

function setCache(key, value) {
  try { localStorage.setItem(`acg_v2_${key}`, JSON.stringify(value)); } catch (e) {}
}

// --- API Logic ---
async function fetchAniList(title) {
  const query = `query ($search: String) { Page(page: 1, perPage: 1) { media(search: $search, type: ANIME) { title { romaji english } coverImage { large } seasonYear genres } } }`;
  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: { search: title } })
    });
    if (response.status === 429) throw new Error("Rate limited");
    const data = await response.json();
    const media = data?.data?.Page?.media?.[0];
    if (!media) return null;
    return { 
      found: true, 
      title: media.title.english || media.title.romaji, 
      image: media.coverImage.large,
      year: media.seasonYear || "",
      genres: media.genres ? media.genres.slice(0, 3).join(", ") : ""
    };
  } catch (err) {
    console.warn(`AniList error for ${title}:`, err.message);
    return null;
  }
}

async function fetchJikan(title) {
  try {
    const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
    if (response.status === 429) throw new Error("Rate limited");
    const data = await response.json();
    const item = data?.data?.[0];
    if (!item) return null;
    return { 
      found: true, 
      title: item.title_english || item.title, 
      image: item.images.jpg.large_image_url,
      year: item.year || "",
      genres: item.genres ? item.genres.map(g => g.name).slice(0, 3).join(", ") : ""
    };
  } catch (err) {
    console.warn(`Jikan error for ${title}:`, err.message);
    return null;
  }
}

async function fetchWithFallback(rawTitle) {
  const norm = normalizeTitle(rawTitle);
  const cached = getCache(norm);
  
  // Only use cache if it was saved AFTER we added metadata fields like year
  if (cached && typeof cached.year !== "undefined") return cached;

  let result = state.source === "anilist" ? await fetchAniList(rawTitle) : await fetchJikan(rawTitle);
  if (!result) {
    // Small delay before trying fallback to avoid hitting rates
    await wait(150);
    result = state.source === "anilist" ? await fetchJikan(rawTitle) : await fetchAniList(rawTitle);
  }

  const final = result || { found: false, title: rawTitle, image: "" };
  setCache(norm, final);
  return final;
}

async function fetchSeasonalAnime(season, year) {
  const query = `
    query($season: MediaSeason, $seasonYear: Int) {
      Page(page: 1, perPage: 15) {
        media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
          title { english romaji }
        }
      }
    }
  `;
  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: { season, seasonYear: year } })
    });
    const data = await response.json();
    return data.data.Page.media.map(m => m.title.english || m.title.romaji);
  } catch (err) {
    console.error("Seasonal fetch error:", err);
    return [];
  }
}

// --- UI Logic ---
function renderGrid() {
  if (!elements.grid) return;
  const gridClass = `grid-container`;
  elements.grid.className = state.cardStyle === "polaroid" ? `${gridClass} style-polaroid` : gridClass;
  elements.grid.innerHTML = "";

  elements.grid.style.gridTemplateColumns = "";
  elements.grid.style.gridTemplateRows = "";
  elements.grid.style.aspectRatio = "";

  let totalTiles = 0;
  
  if (state.gridMode === "auto") {
    elements.grid.classList.add("grid-auto");
    totalTiles = state.entries.length;
  } else if (state.gridMode === "custom") {
    elements.grid.classList.add("grid-custom");
    elements.grid.style.gridTemplateColumns = `repeat(${state.customCols}, 180px)`;
    totalTiles = state.customCols * state.customRows;
  } else {
    elements.grid.classList.add(`grid-${state.gridMode}x${state.gridMode}`);
    totalTiles = Math.pow(parseInt(state.gridMode), 2);
  }
  
  for (let i = 0; i < totalTiles; i++) {
    const entry = state.entries[i];
    const tile = document.createElement("div");
    tile.className = "tile";
    
    if (!entry) {
      tile.classList.add("empty");
      elements.grid.appendChild(tile);
      continue;
    }

    const result = state.resultMap.get(normalizeTitle(entry));

    if (!result) {
      tile.classList.add("loading");
    } else if (!result.found || !result.image) {
      tile.classList.add("not-found");
      tile.innerHTML = `<span>⚠</span><p>${entry}</p>`;
    } else {
      const img = document.createElement("img");
      img.alt = result.title;
      tile.appendChild(img);
      
      // Try direct URL first, it works natively for AniList most of the time
      img.crossOrigin = "anonymous";
      img.src = result.image;
      
      // If direct URL fails (CORS error or 403 on MAL), try proxy
      img.onerror = () => {
        if (!img.dataset.triedProxy) {
          img.dataset.triedProxy = "true";
          img.src = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(result.image)}`;
        } else {
          tile.classList.add("not-found");
          tile.innerHTML = `<span>⚠</span><p>Image Blocked</p>`;
        }
      };

      if (state.cardStyle === "polaroid") {
        const info = document.createElement("div");
        info.className = "polaroid-info";
        info.innerHTML = `
          <div class="p-title-row">
            <span class="p-title">${result.title}</span>
            <span class="p-year">${result.year}</span>
          </div>
          <div class="p-meta"><span class="l">GENRE</span> ${result.genres}</div>
        `;
        tile.appendChild(info);
      } else {
        const info = document.createElement("div");
        info.className = "tile-info";
        info.innerHTML = `
          <div class="t-title">${result.title}</div>
          <div class="t-year">${result.year}</div>
        `;
        tile.appendChild(info);
      }
    }

    tile.draggable = !state.editMode;
    tile.dataset.index = i;
    tile.style.animationDelay = `${i * 40}ms`;
    setupDragAndDrop(tile);
    elements.grid.appendChild(tile);
  }
}

function setupDragAndDrop(tile) {
  tile.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", tile.dataset.index);
    tile.style.opacity = "0.4";
  });
  tile.addEventListener("dragend", () => tile.style.opacity = "1");
  tile.addEventListener("dragover", (e) => e.preventDefault());
  tile.addEventListener("drop", (e) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData("text/plain"));
    const to = parseInt(tile.dataset.index);
    if (!isNaN(from) && !isNaN(to) && from !== to) {
      const temp = state.entries[from];
      state.entries[from] = state.entries[to];
      state.entries[to] = temp;
      renderGrid();
    }
  });
}

async function handleGenerate() {
  // Strip out numbered list prefixes (e.g. "1. ", "12) ", "5-")
  const titles = elements.input.value.split("\n")
    .map(t => t.replace(/^\d+[\.\)\-]?\s*/, '').trim())
    .filter(Boolean);

  if (titles.length === 0) return;

  // Magically clean up the user's textarea to show the fixed titles
  elements.input.value = titles.join("\n");

  state.entries = titles;
  state.fetchedOnce = true;
  renderGrid();

  elements.fetchBtn.disabled = true;

  // SEQUENTIAL FETCH to avoid 429 Rate Limits
  let count = 0;
  for (const title of titles) {
    count++;
    elements.fetchBtn.textContent = `Fetching ${count} / ${titles.length}...`;
    const norm = normalizeTitle(title);
    if (!state.resultMap.has(norm)) {
      const res = await fetchWithFallback(title);
      state.resultMap.set(norm, res);
      renderGrid();
      // wait 1000ms between requests to be very polite to the APIs and avoid 429s
      await wait(1000);
    }
  }

  elements.fetchBtn.disabled = false;
  elements.fetchBtn.textContent = "Generate Collage";
  updateShareUrl();
}

async function handleExport() {
  if (!state.fetchedOnce) return showToast("Generate your collage first!", "error");
  
  elements.exportBtn.textContent = "Slicing...";
  elements.exportBtn.disabled = true;

  // Add Watermark Temporarily
  const watermark = document.createElement("div");
  watermark.style.position = "absolute";
  watermark.style.bottom = "8px";
  watermark.style.right = "16px";
  watermark.style.color = state.bgColor === "#ffffff" ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.6)";
  watermark.style.fontSize = "14px";
  watermark.style.fontWeight = "700";
  watermark.style.fontFamily = "Inter, sans-serif";
  watermark.style.zIndex = "100";
  watermark.innerHTML = "Otaku Grid <span style='opacity:0.7; font-weight:400;'>parthivkoli.github.io/Otaku-Grid</span>";
  elements.grid.appendChild(watermark);

  // Apply selected background to grid momentarily
  const originalBg = elements.grid.style.background;
  elements.grid.style.background = BACKGROUNDS[state.bgColor] || state.bgColor;
  elements.grid.classList.add("export-mode");

  try {
    const canvas = await html2canvas(elements.grid, {
      useCORS: true,
      scale: 2,
      backgroundColor: state.bgColor === "transparent" ? null : (state.bgColor.startsWith("gradient") ? null : state.bgColor),
    });

    const format = elements.exportFormat.value;
    const link = document.createElement("a");
    link.download = `otaku-collage.${format}`;
    link.href = canvas.toDataURL(`image/${format}`, 0.9);
    link.click();
    showToast("Collage exported!");
  } catch (err) {
    console.error("Export Error: ", err);
    showToast("Export failed.", "error");
  } finally {
    watermark.remove();
    elements.grid.style.background = originalBg;
    elements.grid.classList.remove("export-mode");
    elements.exportBtn.textContent = "Export Collage";
    elements.exportBtn.disabled = false;
  }
}

function updateShareUrl() {
  const titles = elements.input.value.trim();
  const url = new URL(window.location);
  if (!titles) {
    url.searchParams.delete("list");
  } else {
    const base64 = btoa(unescape(encodeURIComponent(titles)));
    url.searchParams.set("list", base64);
  }
  window.history.replaceState({}, "", url);
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const list = params.get("list");
  if (list) {
    try {
      elements.input.value = decodeURIComponent(escape(atob(list)));
      handleGenerate();
    } catch (e) {}
  }
}

function init() {
  if (elements.fetchBtn) elements.fetchBtn.onclick = handleGenerate;
  if (elements.exportBtn) elements.exportBtn.onclick = handleExport;
  if (elements.copyLinkBtn) {
    elements.copyLinkBtn.onclick = async () => {
      elements.copyLinkBtn.textContent = "Copying...";
      elements.copyLinkBtn.disabled = true;
      updateShareUrl();
      const longUrl = window.location.href;

      // Public shorteners reject localhost domains or timeout trying to crawl them!
      if (longUrl.includes("127.0.0.1") || longUrl.includes("localhost")) {
        await navigator.clipboard.writeText(longUrl);
        showToast("Link copied! (Localhost unshortenable)");
      } else {
        try {
          // Use is.gd routed through our Codetabs proxy for a fast, ad-free experience!
          const apiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`;
          const response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(apiUrl)}`);
          
          if (!response.ok) throw new Error("Proxy or API rejected request");
          
          const shortUrl = await response.text();
          
          if (shortUrl.includes("http")) {
            await navigator.clipboard.writeText(shortUrl.trim());
            showToast("Short link copied!");
          } else {
            throw new Error("Invalid URL returned");
          }
        } catch (err) {
          console.warn("URL shorten failed: ", err);
          await navigator.clipboard.writeText(longUrl);
          showToast("Link copied! (Fallback to long)");
        }
      }

      elements.copyLinkBtn.textContent = "Share Link";
      elements.copyLinkBtn.disabled = false;
    };
  }

  elements.sourceBtns.forEach(btn => {
    btn.onclick = () => {
      state.source = btn.dataset.source === "mal" ? "mal" : "anilist";
      elements.sourceBtns.forEach(b => b.classList.toggle("active", b === btn));
    };
  });

  elements.gridBtns.forEach(btn => {
    btn.onclick = () => {
      elements.customGridInputs.style.display = "none";
      elements.customGridBtn?.classList.remove("active");
      state.gridMode = btn.dataset.grid;
      elements.gridBtns.forEach(b => b.classList.toggle("active", b === btn));
      renderGrid();
    };
  });

  if (elements.customGridBtn) {
    elements.customGridBtn.onclick = () => {
      elements.customGridInputs.style.display = "flex";
      state.gridMode = "custom";
      elements.gridBtns.forEach(b => b.classList.remove("active"));
      elements.customGridBtn.classList.add("active");
      renderGrid();
    };
  }

  if (elements.applyCustomGrid) {
    elements.applyCustomGrid.onclick = () => {
      state.customCols = parseInt(elements.customColsInput.value) || 5;
      state.customRows = parseInt(elements.customRowsInput.value) || 2;
      renderGrid();
    };
  }

  if (elements.styleBtns) {
    elements.styleBtns.forEach(btn => {
      btn.onclick = () => {
        state.cardStyle = btn.dataset.style;
        elements.styleBtns.forEach(b => b.classList.toggle("active", b === btn));
        renderGrid();
      };
    });
  }

  if (elements.bgBtns) {
    elements.bgBtns.forEach(btn => {
      btn.onclick = () => {
        state.bgColor = btn.dataset.bg;
        elements.bgBtns.forEach(b => b.classList.toggle("active", b === btn));
        elements.grid.style.background = BACKGROUNDS[state.bgColor] || state.bgColor;
      };
    });
  }

  if (elements.overlayToggle) {
    elements.overlayToggle.onchange = (e) => {
      state.showOverlay = e.target.checked;
      renderGrid();
    };
  }

  if (elements.settingsBtn) elements.settingsBtn.onclick = () => elements.modal.classList.add("active");
  if (elements.modalClose) elements.modalClose.onclick = () => elements.modal.classList.remove("active");

  if (elements.clearCacheBtn) {
    elements.clearCacheBtn.onclick = () => {
      const keys = Object.keys(localStorage);
      keys.forEach(k => { if (k.startsWith("acg_v2_")) localStorage.removeItem(k); });
      state.resultMap.clear();
      showToast("Cache cleared!");
      location.reload();
    };
  }

  elements.presetShonen.onclick = () => { elements.input.value = getRandomItems(PRESETS.shonen, 9).join("\n"); handleGenerate(); };
  elements.presetRomance.onclick = () => { elements.input.value = getRandomItems(PRESETS.romance, 9).join("\n"); handleGenerate(); };
  elements.presetStarter.onclick = () => { elements.input.value = getRandomItems(PRESETS.starter, 9).join("\n"); handleGenerate(); };
  
  if (elements.presetIsekai) elements.presetIsekai.onclick = () => { elements.input.value = getRandomItems(PRESETS.isekai, 9).join("\n"); handleGenerate(); };
  if (elements.presetFantasy) elements.presetFantasy.onclick = () => { elements.input.value = getRandomItems(PRESETS.fantasy, 9).join("\n"); handleGenerate(); };

  async function handleSeasonalClick(sznInfo) {
    elements.input.value = `Fetching ${sznInfo.season} ${sznInfo.year} Anime...`;
    const titles = await fetchSeasonalAnime(sznInfo.season, sznInfo.year);
    if(titles.length) {
      elements.input.value = titles.join("\n");
      const savedGrid = state.gridMode;
      // Temporarily set gridMode to "auto" because seasonal returns 15 entries
      state.gridMode = "auto"; 
      elements.gridBtns.forEach(b => b.classList.toggle("active", b.dataset.grid === "auto"));
      await handleGenerate();
      state.gridMode = savedGrid; // Keep preference state
    } else {
      elements.input.value = "Failed to fetch seasonal anime.";
    }
  }

  if (elements.seasonCurrent) elements.seasonCurrent.onclick = () => handleSeasonalClick(getSeasons().current);
  if (elements.seasonPrevious) elements.seasonPrevious.onclick = () => handleSeasonalClick(getSeasons().previous);

  hydrateFromUrl();
  renderGrid();
}

init();
