// ============== CONFIG ==============
const API_BASE_MY =
  (window.API_BASE && typeof window.API_BASE === "string")
    ? window.API_BASE
    : (location.hostname === "localhost" || location.hostname === "127.0.0.1"
        ? "https://atlanticdriveapi.azurewebsites.net"
        : "https://atlanticdriveapi.azurewebsites.net");


// светъл inline fallback
const FALLBACK_INLINE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" rx="10" ry="10" fill="%23e2e8f0" /><path d="M15 55 L35 30 L55 50 L75 28 L105 55 Z" fill="none" stroke="%230f172a" stroke-width="2"/></svg>');




  // =========================
// ORIGIN FLAGS (cards) — under title on ALL screens
// =========================
const ORIGIN_FLAGS = {
  US: { src: "Images/USAFlag.webp", alt: "САЩ" },
  CA: { src: "Images/canadaFlag.png", alt: "Канада" },
  KR: { src: "Images/Korea.png", alt: "Южна Корея" },
  AE: { src: "Images/UAE.webp", alt: "ОАЕ" },
};

function normalizeOriginCode(raw) {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";

  const u = s.toUpperCase();

  // директни кодове
  if (u === "US" || u === "USA") return "US";
  if (u === "CA" || u === "CAN") return "CA";
  if (u === "KR" || u === "KOR") return "KR";
  if (u === "AE" || u === "UAE") return "AE";

  // текстови стойности
  const l = s.toLowerCase();

  if (
    l.includes("сащ") ||
    l.includes("u.s") ||
    l === "us" ||
    l.includes("usa") ||
    l.includes("united states") ||
    l.includes("america") ||
    l.includes("америка")
  ) return "US";

  if (l.includes("канада") || l === "ca" || l.includes("canada")) return "CA";

  if (l.includes("южна корея") || l.includes("south korea") || l.includes("korea") || l.includes("корея")) return "KR";

  if (l.includes("оае") || l.includes("uae") || l.includes("emirates") || l.includes("dubai") || l.includes("abu dhabi")) return "AE";

  return "";
}

function getOriginFromRow(row) {
  return (
    row?.originCountryCode ??
    row?.origin_country_code ??
    row?.originCode ??
    row?.origin_code ??
    row?.origin ??
    row?.originName ??
    row?.origin_name ??
    row?.sourceCountryCode ??
    row?.source_country_code ??
    ""
  );
}

function renderOriginFlagHtml(row) {
  const code = normalizeOriginCode(getOriginFromRow(row));
  const meta = code ? ORIGIN_FLAGS[code] : null;
  if (!meta) return "";

  // inline style => гаранция "под заглавието" на всички резолюции без CSS зависимости
  return `
    <img
      class="listing-origin-flag"
      src="${meta.src}"
      alt="${meta.alt}"
      loading="lazy"
      decoding="async"
      style="width:34px;height:22px;display:block;margin-top:6px;border-radius:4px;object-fit:cover;"
      onerror="this.onerror=null;this.style.display='none';"
    >
  `.trim();
}

// =================== NEW: default currency + FX ===================
const DEFAULT_CURRENCY = "EUR";
const EUR_TO_BGN = 1.95583; // fixed peg

function parseMoneyToNumber(str) {
  if (str == null) return NaN;
  const s = String(str).trim().replace(/\s+/g, "").replace(/,/g, ".");
  const cleaned = s.replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function fmtIntBG(n) {
  return Number(n).toLocaleString("bg-BG", { maximumFractionDigits: 0 });
}

/**
 * Always shows EUR as primary and BGN as secondary (pale).
 * If stored currency is BGN, it converts to EUR for primary.
 * Returns HTML string (contains <span class="price-sub">...).
 */
function formatPriceDual(val, curr) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return "По запитване";

  const c = String(curr || DEFAULT_CURRENCY).toUpperCase();

  let eur = n;
  let bgn = n * EUR_TO_BGN;

  const isBGN =
    c === "BGN" || c === "ЛВ" || c === "ЛВ." || c.includes("BGN") || c.includes("ЛВ");

  if (isBGN) {
    bgn = n;
    eur = n / EUR_TO_BGN;
  }

  const eurTxt = "€" + fmtIntBG(eur);
  const bgnTxt = fmtIntBG(bgn) + " лв.";

  return `${eurTxt} <span class="price-sub">≈ ${bgnTxt}</span>`;
}
// ============================================================


// ============== AUTH ==============
const rawAuth = localStorage.getItem("auth");
if (!rawAuth) location.href = "/logIn.html";
const auth = JSON.parse(rawAuth);

function jwtExp(token) {
  try { return JSON.parse(atob(token.split('.')[1])).exp || 0; }
  catch { return 0; }
}
function isExpired(token) {
  const exp = jwtExp(token);
  const now = Math.floor(Date.now() / 1000);
  return exp && exp < (now - 5);
}
function forceLogout() {
  localStorage.removeItem("auth");
  localStorage.removeItem("user");
  location.href = "/logIn.html";
}
if (!auth?.token || isExpired(auth.token)) forceLogout();


// ---- детекция на GLOBAL ADMIN ----
const GLOBAL_ADMIN_ROLES = ["global_admin"];

function isMainAdmin() {
  const hasRoleVal = (val) =>
    !!val && GLOBAL_ADMIN_ROLES.includes(String(val).toLowerCase());

  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return false;
    const a = JSON.parse(raw);

    if (hasRoleVal(a.role)) return true;

    if (Array.isArray(a.roles) && a.roles.some(hasRoleVal)) return true;

    if (a.user) {
      if (hasRoleVal(a.user.role)) return true;
      if (Array.isArray(a.user.roles) && a.user.roles.some(hasRoleVal)) return true;
    }

    if (!a.token) return false;
    const payloadStr = atob(a.token.split(".")[1] || "");
    const payload = JSON.parse(payloadStr || "{}");

    const claimRole =
      payload["role"] ||
      payload["roles"] ||
      payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];

    const rolesArr = Array.isArray(claimRole)
      ? claimRole
      : (claimRole ? [claimRole] : []);

    if (rolesArr.some(hasRoleVal)) return true;

    if (payload.isGlobalAdmin === true || payload.isSuperAdmin === true || payload.isMainAdmin === true) return true;
  } catch (e) {
    console.error("isMainAdmin (global_admin) error:", e);
    return false;
  }

  return false;
}

const IS_MAIN_ADMIN = isMainAdmin();

async function authFetch(url, options = {}) {
  const a = JSON.parse(localStorage.getItem("auth") || "{}");
  const headers = new Headers(options.headers || {});
  if (a?.token) headers.set("Authorization", "Bearer " + a.token);
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) { forceLogout(); throw new Error("Unauthorized"); }
  return res;
}


// ============== CACHES/DOM ==============
let MY_LISTINGS_CACHE = [];
const COVERS_CACHE = new Map();

// снимки – едно място за състоянието
let CURRENT_PHOTOS = [];

// режим: "mine" или "all"
let CURRENT_MODE = "mine";

const btnLogout = document.getElementById("btnLogout");
const btnNew = document.getElementById("btnNew");
const btnLeads = document.getElementById("btnLeads");
const btnClients = document.getElementById("btnClients");
const btnAllListings = document.getElementById("btnAllListings");

const formBox = document.getElementById("listingFormBox");
const statusEl = document.getElementById("status");
const pageHeadingEl = document.getElementById("pageHeading");

const cardsGrid = document.getElementById("cardsGrid");
const noListingsEl = document.getElementById("noListings");

// модал
const listingModal = document.getElementById("listingModal");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalEditBtn = document.getElementById("modalEditBtn");
const modalDeleteBtn = document.getElementById("modalDeleteBtn");

// детайл в модала
const detailEmpty = document.getElementById("detailEmpty");
const detailBody = document.getElementById("detailBody");
const detailMainImg = document.getElementById("detailMainImg");
const detailThumbs = document.getElementById("detailThumbs");
const detailTitle = document.getElementById("detailTitle");
const detailSubtitle = document.getElementById("detailSubtitle");
const detailStock = document.getElementById("detailStock");
const detailPrice = document.getElementById("detailPrice");
const detailStatusNote = document.getElementById("detailStatusNote");
const detailPriceMeta = document.getElementById("detailPriceMeta");
const detailSpecs = document.getElementById("detailSpecs");
const detailDesc = document.getElementById("detailDesc");
const detailContactBox = document.getElementById("detailContactBox");
const detailContactName = document.getElementById("detailContactName");
const detailContactPhone = document.getElementById("detailContactPhone");
const detailContactEmail = document.getElementById("detailContactEmail");
const detailLinksBox = document.getElementById("detailLinks");

// формови елементи
const formError = document.getElementById("formError");
const formOk = document.getElementById("formOk");
const formTitle = document.getElementById("formTitle");
const currentEditIdEl = document.getElementById("currentEditId");
const saveSpinner = document.getElementById("saveSpinner");
const btnSave = document.getElementById("btnSave");
const btnCancel = document.getElementById("btnCancel");

const vinEl = document.getElementById("vin");
const lotEl = document.getElementById("lotNumber");
const priceIsFinalEl = document.getElementById("priceIsFinal");
const priceNoteEl = document.getElementById("priceNote");

// дата/час на търга
const auctionDateEl = document.getElementById("auctionDate");
const auctionTimeEl = document.getElementById("auctionTime");

// vehicle полета
const makeEl = document.getElementById("makeId");
const modelEl = document.getElementById("modelId");
const yearEl = document.getElementById("year");
const bodyTypeEl = document.getElementById("bodyTypeId");
const fuelTypeEl = document.getElementById("fuelTypeId");
const transmissionEl = document.getElementById("transmissionId");
const engineCcEl = document.getElementById("engineCc");
const powerHpEl = document.getElementById("powerHp");
const mileageKmEl = document.getElementById("mileageKm");

// новите полета
const originCountryCodeEl = document.getElementById("originCountryCode");
const hasDamageEl = document.getElementById("hasDamage");
const sourceUrlEl = document.getElementById("sourceUrl");
const videoUrlEl = document.getElementById("videoUrl");

// снимки (input + контейнер)
const photosInputEl = document.getElementById("photos");
const photosPreviewEl = document.getElementById("photosPreview");
if (photosPreviewEl) photosPreviewEl.classList.add("photos-preview");

// FEATURES: форма + модал
const listingFeaturesBox = document.getElementById("listingFeaturesBox");
const featureIdsHiddenEl = document.getElementById("featureIds");
const detailFeaturesBox = document.getElementById("detailFeatures");
let LISTING_FEATURES = [];


// =================== NEW: AUTO TITLE STATE ===================
let LAST_AUTO_TITLE = "";
let TITLE_LOCKED_BY_USER = false;

function buildAutoTitle() {
  const y = (yearEl?.value || "").trim();

  const makeName =
    makeEl && makeEl.selectedIndex > 0
      ? (makeEl.options[makeEl.selectedIndex]?.textContent || "").trim()
      : "";

  const modelName =
    modelEl && modelEl.selectedIndex > 0
      ? (modelEl.options[modelEl.selectedIndex]?.textContent || "").trim()
      : "";

  const parts = [y, makeName, modelName].filter(Boolean);
  return parts.join(" ").trim();
}

function updateAutoTitle(force = false) {
  const titleEl = document.getElementById("title");
  if (!titleEl) return;

  const auto = buildAutoTitle();
  if (!auto) return;

  const current = (titleEl.value || "").trim();

  if (
    force ||
    !TITLE_LOCKED_BY_USER ||
    !current ||
    current === LAST_AUTO_TITLE
  ) {
    titleEl.value = auto;
    LAST_AUTO_TITLE = auto;
    TITLE_LOCKED_BY_USER = false;
  }
}

function initAutoTitleStateFromCurrent() {
  const titleEl = document.getElementById("title");
  if (!titleEl) return;

  const auto = buildAutoTitle();
  const current = (titleEl.value || "").trim();

  LAST_AUTO_TITLE = auto;
  TITLE_LOCKED_BY_USER = !!(current && auto && current !== auto);
}
// ============================================================


// ============== HELPERS (общи) ==============
function getFromRow(row, ...keys) {
  for (const k of keys) {
    if (row && row[k] !== undefined && row[k] !== null) return row[k];
  }
  return null;
}

// mark required
function markRequiredFields() {
  const requiredIds = ["makeId", "modelId", "year", "title", "price"];
  requiredIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.required = true;
    const field = el.closest(".field");
    if (field) field.setAttribute("data-required", "true");
  });
}
markRequiredFields();

// locked helper
function setLockedField(id, locked) {
  const el = document.getElementById(id);
  if (!el) return;
  el.disabled = !!locked;
  const field = el.closest(".field");
  if (!field) return;
  if (locked) field.setAttribute("data-locked", "true");
  else field.removeAttribute("data-locked");
}


// ====== AUCTION HELPERS ======
let auctionTimerId = null;

function formatAuctionDateParts(dateString) {
  if (!dateString) return { date: "", time: "" };
  const d = new Date(dateString);
  if (isNaN(d)) return { date: "", time: "" };

  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Europe/Sofia"
  });

  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Europe/Sofia"
  }) + " EET";

  return { date, time };
}

function formatTimeLeft(dateString, now) {
  const end = new Date(dateString);
  if (isNaN(end)) return "";
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return "ENDED";

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  let parts = [];
  if (days > 0) parts.push(days + "D");
  parts.push(hours + "H");
  parts.push((minutes < 10 ? "0" : "") + minutes + "min");

  return parts.join(" ");
}

function isAuctionExpired(dateString, now) {
  const end = new Date(dateString);
  if (isNaN(end)) return false;
  return end.getTime() <= now.getTime();
}

function buildAuctionEndAt(dateStr, timeStr, isFinal) {
  if (isFinal) return null;
  if (!dateStr || !timeStr) return null;
  return `${dateStr}T${timeStr}:00`;
}

function initAuctionCountdowns() {
  if (auctionTimerId) {
    clearInterval(auctionTimerId);
    auctionTimerId = null;
  }

  const updateAll = () => {
    const now = new Date();

    document.querySelectorAll(".listing-auction").forEach(block => {
      const endStr = block.getAttribute("data-auction-end");
      if (!endStr) return;

      const leftEl = block.querySelector(".auction-time-left-text");
      if (leftEl) leftEl.textContent = formatTimeLeft(endStr, now);

      const card = block.closest(".listing-card");
      if (card) {
        if (isAuctionExpired(endStr, now)) {
          card.classList.add("auction-row-ended");
        } else {
          card.classList.remove("auction-row-ended");
        }
      }
    });

    document.querySelectorAll(".detail-auction-info").forEach(block => {
      const endStr = block.getAttribute("data-auction-end");
      if (!endStr) return;

      const { date, time } = formatAuctionDateParts(endStr);
      const dateEl = block.querySelector(".auction-date-text");
      const timeEl = block.querySelector(".auction-time-text");
      const leftEl = block.querySelector(".auction-time-left-text");

      if (dateEl) dateEl.textContent = date;
      if (timeEl) timeEl.textContent = time;
      if (leftEl) leftEl.textContent = formatTimeLeft(endStr, now);

      if (isAuctionExpired(endStr, now)) {
        block.classList.add("auction-ended");
        const detailPanel = block.closest(".ad-detail");
        if (detailPanel) detailPanel.classList.add("auction-row-ended");
      } else {
        block.classList.remove("auction-ended");
        const detailPanel = block.closest(".ad-detail");
        if (detailPanel) detailPanel.classList.remove("auction-row-ended");
      }
    });
  };

  updateAll();
  auctionTimerId = setInterval(updateAll, 60_000);
}

function refreshAuctionInputsLock() {
  const isFinal = !!priceIsFinalEl?.checked;
  if (auctionDateEl) auctionDateEl.disabled = isFinal;
  if (auctionTimeEl) auctionTimeEl.disabled = isFinal;
}


// ============== AUTH / UI ==============
btnLogout?.addEventListener("click", () => {
  const ok = confirm("Сигурен ли сте, че искате да излезете от профила?");
  if (!ok) return;
  forceLogout();
});

btnNew?.addEventListener("click", () => enterCreateMode());

btnClients?.addEventListener("click", () => {
  window.location.href = "my-clients.html";
});

// НОВО: бутон "Всички обяви" – toggle mine/all само за global_admin
if (btnAllListings) {
  if (IS_MAIN_ADMIN) {
    btnAllListings.style.display = "inline-flex";
    btnAllListings.textContent = "Всички обяви";

    btnAllListings.addEventListener("click", () => {
      const nextMode = CURRENT_MODE === "mine" ? "all" : "mine";
      setModeAndLoad(nextMode);
    });
  } else {
    btnAllListings.style.display = "none";
  }
}

// показване на бутона за запитвания само за global_admin
if (btnLeads) {
  if (IS_MAIN_ADMIN) {
    btnLeads.style.display = "inline-flex";
    btnLeads.addEventListener("click", () => {
      window.location.href = "leads.html";
    });
  } else {
    btnLeads.style.display = "none";
  }
}

// VIN: авто-uppercase, без I/O/Q
if (vinEl) {
  vinEl.addEventListener("input", () => {
    vinEl.value = vinEl.value.toUpperCase().replace(/[IOQ]/g, "");
  });
}

priceIsFinalEl?.addEventListener("change", refreshAuctionInputsLock);
refreshAuctionInputsLock();


// =================== NEW: title lock by user ===================
const titleInputEl = document.getElementById("title");
if (titleInputEl) {
  titleInputEl.addEventListener("input", () => {
    const cur = (titleInputEl.value || "").trim();
    TITLE_LOCKED_BY_USER = !!(cur && cur !== LAST_AUTO_TITLE);
  });
}

modelEl?.addEventListener("change", () => updateAutoTitle());
yearEl?.addEventListener("input", () => updateAutoTitle());
yearEl?.addEventListener("change", () => updateAutoTitle());
// ===============================================================

// ============== LOOKUPS ==============
async function loadMakes() {
  const sel = makeEl;
  if (!sel) return;

  // reset
  sel.innerHTML = "<option value=''>-- избери --</option>";

  try {
    const res = await fetch(API_BASE_MY + "/api/public/makes");
    if (!res.ok) return;

    const makes = await res.json();
    makes.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      sel.appendChild(opt);
    });
  } catch {}
}


async function loadModelsForMakeAndSelect(makeId, selectedModelId) {
  const modelSel = modelEl;
  if (!modelSel) return;
  modelSel.innerHTML = "<option value=''>-- избери --</option>";
  modelSel.disabled = true;
  if (!makeId) return;

  try {
    const res = await fetch(API_BASE_MY + "/api/public/models?makeId=" + makeId);
    const models = await res.json();
    models.forEach(md => {
      const opt = document.createElement("option");
      opt.value = md.id;
      opt.textContent = md.name;
      modelSel.appendChild(opt);
    });
    modelSel.disabled = false;
    if (selectedModelId != null) {
      modelSel.value = String(selectedModelId);
    }

    updateAutoTitle();
  } catch {}
}

makeEl?.addEventListener("change", async (e) => {
  const makeId = e.target.value || null;
  await loadModelsForMakeAndSelect(makeId, null);
  updateAutoTitle();
});

async function loadLookups() {
  try {
    const res = await fetch(API_BASE_MY + "/api/public/lookups");
    if (!res.ok) return;

    const data = await res.json();

    // reset selects
    const bt = document.getElementById("bodyTypeId");
    const ft = document.getElementById("fuelTypeId");
    const tr = document.getElementById("transmissionId");

    if (bt) bt.innerHTML = "<option value=''>--</option>";
    if (ft) ft.innerHTML = "<option value=''>--</option>";
    if (tr) tr.innerHTML = "<option value=''>--</option>";

    fillSelect("bodyTypeId", data.body_types);
    fillSelect("fuelTypeId", data.fuel_types);
    fillSelect("transmissionId", data.transmissions);
  } catch {}
}


function fillSelect(id, items) {
  const sel = document.getElementById(id);
  if (!sel || !items) return;
  items.forEach(x => {
    const opt = document.createElement("option");
    opt.value = x.id;
    opt.textContent = x.name;
    sel.appendChild(opt);
  });
}


// ============== FEATURES (listing_features) ==============
async function loadListingFeatures(selectedIds) {
  if (!listingFeaturesBox) return;
  try {
    const res = await fetch(API_BASE_MY + "/api/public/listing-features");
    if (!res.ok) return;
    const data = await res.json();

    LISTING_FEATURES = Array.isArray(data)
      ? data
          .map(f => ({
            id: Number(f.featureId ?? f.feature_id ?? f.id),
            name: f.name
          }))
          .filter(f => f.id && f.name)
      : [];

    renderFeatureChips(selectedIds || []);
  } catch {}
}

function renderFeatureChips(selectedIds) {
  if (!listingFeaturesBox) return;
  listingFeaturesBox.innerHTML = "";

  // ако идват повече от 3 от edit -> режем до 3
  const initial = (selectedIds || []).map(Number).filter(n => !Number.isNaN(n)).slice(0, MAX_FEATURES_PER_LISTING);
  const selectedSet = new Set(initial);

  LISTING_FEATURES.forEach(f => {
    const id = Number(f.id);
    if (!id) return;

    const name = f.name || "";
    if (!name) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "feature-chip";
    btn.dataset.id = String(id);
    btn.textContent = name;

    if (selectedSet.has(id)) btn.classList.add("is-selected");

    btn.addEventListener("click", () => {
      const isSelected = btn.classList.contains("is-selected");

      // ако махаш -> винаги позволено
      if (isSelected) {
        btn.classList.remove("is-selected");
        syncSelectedFeaturesHidden();
        return;
      }

      // ако добавяш -> провери лимит
      const count = getSelectedFeatureCount();
      if (count >= MAX_FEATURES_PER_LISTING) {
        toastFeatureLimit();
        return;
      }

      btn.classList.add("is-selected");
      syncSelectedFeaturesHidden();
    });

    listingFeaturesBox.appendChild(btn);
  });

  syncSelectedFeaturesHidden();
}


function syncSelectedFeaturesHidden() {
  if (!listingFeaturesBox || !featureIdsHiddenEl) return;

  let ids = Array.from(listingFeaturesBox.querySelectorAll(".feature-chip.is-selected"))
    .map(el => Number(el.dataset.id))
    .filter(n => !Number.isNaN(n));

  // safety: ако по някакъв начин станат >3, режем и махаме визуално излишните
  if (ids.length > MAX_FEATURES_PER_LISTING) {
    const keep = new Set(ids.slice(0, MAX_FEATURES_PER_LISTING));

    listingFeaturesBox.querySelectorAll(".feature-chip.is-selected").forEach(ch => {
      const id = Number(ch.dataset.id);
      if (!keep.has(id)) ch.classList.remove("is-selected");
    });

    ids = ids.slice(0, MAX_FEATURES_PER_LISTING);
  }

  featureIdsHiddenEl.value = ids.join(",");
}


function getSelectedFeatureIds() {
  if (!listingFeaturesBox) return [];
  return Array.from(
    listingFeaturesBox.querySelectorAll(".feature-chip.is-selected")
  )
    .map(el => Number(el.dataset.id))
    .filter(n => !Number.isNaN(n));
}

function applySelectedFeatures(featureIds) {
  if (!listingFeaturesBox) return;

  const ids = (featureIds || [])
    .map(Number)
    .filter(n => !Number.isNaN(n))
    .slice(0, MAX_FEATURES_PER_LISTING);

  const set = new Set(ids);

  listingFeaturesBox.querySelectorAll(".feature-chip").forEach(ch => {
    const id = Number(ch.dataset.id);
    if (set.has(id)) ch.classList.add("is-selected");
    else ch.classList.remove("is-selected");
  });

  syncSelectedFeaturesHidden();
}


function extractFeatureIdsFromItem(item) {
  if (!item) return [];

  const arr = getFeaturesArrayFromItem(item);
  if (arr.length) {
    return arr
      .map(f => Number(f.featureId ?? f.feature_id ?? f.id))
      .filter(n => !Number.isNaN(n));
  }

  if (Array.isArray(item.featureIds)) {
    return item.featureIds.map(Number).filter(n => !Number.isNaN(n));
  }
  if (Array.isArray(item.feature_ids)) {
    return item.feature_ids.map(Number).filter(n => !Number.isNaN(n));
  }
  if (typeof item.feature_ids === "string") {
    return item.feature_ids
      .split(/[,\s;]+/g)
      .map(x => Number(x))
      .filter(n => !Number.isNaN(n));
  }
  return [];
}
// =================== FEATURES LIMIT ===================
const MAX_FEATURES_PER_LISTING = 3;

function getSelectedFeatureCount() {
  if (!listingFeaturesBox) return 0;
  return listingFeaturesBox.querySelectorAll(".feature-chip.is-selected").length;
}

function toastFeatureLimit() {
  // ако имаш showErr - ползвай него, иначе alert
  if (typeof showErr === "function") {
    showErr(`Можеш да избереш най-много ${MAX_FEATURES_PER_LISTING} екстри.`);
  } else {
    alert(`Можеш да избереш най-много ${MAX_FEATURES_PER_LISTING} екстри.`);
  }
}
// ======================================================



// ============== READY PROMISES (за edit попълване) ==============
let MAKES_READY = null;
let LOOKUPS_READY = null;
let FEATURES_READY = null;


// ==============================================================


// ============== PHOTO STATE / PREVIEW / DND ==============
function resetPhotosState() {
  CURRENT_PHOTOS.forEach(p => {
    if (p.kind === "new" && p.url && p.url.startsWith("blob:")) {
      URL.revokeObjectURL(p.url);
    }
  });
  CURRENT_PHOTOS = [];
  if (photosPreviewEl) photosPreviewEl.innerHTML = "";
  if (photosInputEl) photosInputEl.value = "";
}

function getVisiblePhotos() {
  return CURRENT_PHOTOS.filter(p => !p.deleted);
}

function renderPhotosPreview() {
  if (!photosPreviewEl) return;
  photosPreviewEl.innerHTML = "";
  const visible = getVisiblePhotos();
  visible.forEach((p, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "ph";
    wrapper.draggable = true;
    wrapper.dataset.index = String(index);

    const img = document.createElement("img");
    img.src = p.url || FALLBACK_INLINE;
    wrapper.appendChild(img);

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "ph-del";
    btnDel.textContent = "×";
    btnDel.title = "Премахни снимката";
    btnDel.addEventListener("click", () => {
      const visibleIdx = index;
      let count = -1;
      for (let i = 0; i < CURRENT_PHOTOS.length; i++) {
        if (CURRENT_PHOTOS[i].deleted) continue;
        count++;
        if (count === visibleIdx) {
          if (CURRENT_PHOTOS[i].kind === "existing") {
            CURRENT_PHOTOS[i].deleted = true;
          } else {
            if (CURRENT_PHOTOS[i].url && CURRENT_PHOTOS[i].url.startsWith("blob:")) {
              URL.revokeObjectURL(CURRENT_PHOTOS[i].url);
            }
            CURRENT_PHOTOS.splice(i, 1);
          }
          break;
        }
      }
      renderPhotosPreview();
    });
    wrapper.appendChild(btnDel);

    if (index === 0) {
      const badge = document.createElement("span");
      badge.className = "ph-badge";
      badge.textContent = "Корица";
      wrapper.appendChild(badge);
    }

    photosPreviewEl.appendChild(wrapper);
  });
}

let dragStartIndex = null;
let dragTargetIndex = null;

if (photosPreviewEl) {
  photosPreviewEl.addEventListener("dragstart", (e) => {
    const ph = e.target.closest(".ph");
    if (!ph) return;
    const all = Array.from(photosPreviewEl.querySelectorAll(".ph"));
    dragStartIndex = all.indexOf(ph);
    ph.classList.add("dragging");
  });

  photosPreviewEl.addEventListener("dragenter", (e) => {
    const ph = e.target.closest(".ph");
    if (!ph) return;
    e.preventDefault();
    const all = Array.from(photosPreviewEl.querySelectorAll(".ph"));
    dragTargetIndex = all.indexOf(ph);
    all.forEach(el => el.classList.remove("drag-over"));
    ph.classList.add("drag-over");
  });

  photosPreviewEl.addEventListener("dragover", (e) => {
    if (dragStartIndex === null) return;
    e.preventDefault();
  });

  photosPreviewEl.addEventListener("drop", (e) => {
    e.preventDefault();
    if (dragStartIndex === null) return;
    if (dragTargetIndex === null) dragTargetIndex = dragStartIndex;
    reorderVisiblePhotos(dragStartIndex, dragTargetIndex);
    dragStartIndex = null;
    dragTargetIndex = null;
    photosPreviewEl.querySelectorAll(".ph").forEach(el => {
      el.classList.remove("dragging");
      el.classList.remove("drag-over");
    });
    renderPhotosPreview();
  });

  photosPreviewEl.addEventListener("dragend", () => {
    dragStartIndex = null;
    dragTargetIndex = null;
    photosPreviewEl.querySelectorAll(".ph").forEach(el => {
      el.classList.remove("dragging");
      el.classList.remove("drag-over");
    });
  });
}

function reorderVisiblePhotos(fromIdx, toIdx) {
  const visible = getVisiblePhotos();
  if (fromIdx == null || toIdx == null) return;
  if (fromIdx === toIdx) return;
  const moved = visible[fromIdx];
  visible.splice(fromIdx, 1);
  visible.splice(toIdx, 0, moved);

  const deleted = CURRENT_PHOTOS.filter(p => p.deleted);
  CURRENT_PHOTOS = [...visible, ...deleted];
}

if (photosInputEl) {
  photosInputEl.addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(f => {
      const url = URL.createObjectURL(f);
      CURRENT_PHOTOS.push({
        kind: "new",
        file: f,
        url,
        deleted: false
      });
    });
    photosInputEl.value = "";
    renderPhotosPreview();
  });
}

function getPhotoStateForSave() {
  const visible = getVisiblePhotos();
  const newFiles = visible
    .filter(p => p.kind === "new")
    .map(p => p.file)
    .filter(Boolean);

  const deletedExistingUrls = CURRENT_PHOTOS
    .filter(p => p.kind === "existing" && p.deleted && p.url)
    .map(p => p.url);

  const first = visible[0] || null;
  const setFirstAsCover = !!(first && first.kind === "new");

  return { newFiles, deletedExistingUrls, setFirstAsCover };
}

async function loadPhotosForEdit(listingId) {
  if (!listingId) return null;
  resetPhotosState();

  try {
    const res = await fetch(API_BASE_MY + "/api/public/listings/" + encodeURIComponent(listingId));
    if (!res.ok) return null;

    const item = await res.json();

    const photos = normalizePhotosLikeCatalog(item);
    CURRENT_PHOTOS = photos.map(u => ({ kind: "existing", url: u, deleted: false }));
    renderPhotosPreview();

    return item;
  } catch {
    return null;
  }
}




// ============== STATUS PILL ==============
function renderStatus(status) {
  if (status === 4) return '<span class="pill pill-sold">Продадена</span>';
  if (status === 3) return '<span class="pill pill-deleted">Изтрита</span>';
  return '<span class="pill pill-active">Активна</span>';
}


// ============== LOAD LISTINGS (mine/all) ==============
async function loadListings(mode) {
  if (!statusEl) return;
  statusEl.textContent = "Зареждане...";

  const url =
    mode === "all"
      ? API_BASE_MY + "/api/listings/all"
      : API_BASE_MY + "/api/listings/mine";

  try {
    const res = await authFetch(url, {
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) {
      statusEl.textContent = "Не успях да заредя обявите.";
      return;
    }

    const data = await res.json();
    MY_LISTINGS_CACHE = data || [];

    if (!cardsGrid) return;
    cardsGrid.innerHTML = "";

    if (!data.length) {
      if (mode === "all") {
        statusEl.textContent = "Няма обяви.";
        if (noListingsEl) {
          noListingsEl.style.display = "block";
          noListingsEl.textContent = "Няма налични обяви.";
        }
      } else {
        statusEl.textContent = "Нямаш обяви.";
        if (noListingsEl) {
          noListingsEl.style.display = "block";
          noListingsEl.textContent = "Нямаш активни обяви. Натисни „Нова обява“, за да създадеш първата си обява.";
        }
      }
      return;
    }

    statusEl.textContent = "";
    if (noListingsEl) noListingsEl.style.display = "none";

    data.forEach((row, idx) => {
      const card = buildListingCard(row, idx);
      cardsGrid.appendChild(card);
    });

    initAuctionCountdowns();
  } catch {
    statusEl.textContent = "Грешка при зареждане.";
  }
}

// помощна функция за смяна на режим + UI
async function setModeAndLoad(mode) {
  CURRENT_MODE = mode;

  if (IS_MAIN_ADMIN && btnAllListings) {
    btnAllListings.textContent = mode === "all" ? "Само моите" : "Всички обяви";
  }

  if (pageHeadingEl) {
    pageHeadingEl.textContent = mode === "all" ? "Всички обяви" : "Моите обяви";
  }

  await loadListings(mode);
}


// ============== КАРТИ ==============
function buildListingCard(row, idx) {
  const card = document.createElement("article");
  const listingId = row.listingId || row.id;
  const thumbId = String(listingId || "");
  card.className = "listing-card";
  card.dataset.id = listingId;

  // EUR primary + BGN secondary (HTML)
  const priceTxt = row.priceAmount
    ? formatPriceDual(row.priceAmount, row.currencyCode || DEFAULT_CURRENCY)
    : "По запитване";

  const priceBadge =
    row.priceIsFinal === true
      ? '<span class="pill-final">Крайна</span>'
      : (row.priceIsFinal === false
          ? '<span class="pill-provisional">Прогнозна</span>'
          : "");

  const make = row.make || row.makeName || row.make_name || "";
  const model = row.model || row.modelName || row.model_name || "";
  const year = getFromRow(row, "year", "productionYear", "production_year") || "";
  const lotNumber = row.lotNumber || row.lot_number || "";

  const titleText = row.title || `${make} ${model} ${year}` || "Без име";
  const lotText = lotNumber ? `Lot: ${lotNumber}` : "";

  // ✅ флаг под заглавието (US/CA/KR/AE) — трябва да имаш helper-ите от предишния пач
  const originFlagHtml = renderOriginFlagHtml(row);

  const auctionEndAt = row.auctionEndAt || row.auction_end_at || null;
  const hasAuction = !!(auctionEndAt && row.priceIsFinal === false);

  const views =
    typeof row.viewsCount === "number"
      ? row.viewsCount
      : (typeof row.views_count === "number" ? row.views_count : 0);

  const viewsLabel = `Прегледи: ${views}`;

  card.innerHTML = `
    <div class="listing-card-media">
      <img class="listing-card-img"
           data-listing-id="${thumbId}"
           src="${FALLBACK_INLINE}"
           alt="">
    </div>

    <div class="listing-card-body">
      <h3 class="listing-card-title">${escapeHtml(titleText)}</h3>
      ${originFlagHtml ? `<div class="listing-card-origin">${originFlagHtml}</div>` : ""}
      ${lotText ? `<p class="listing-card-lot">${escapeHtml(lotText)}</p>` : ""}

      ${hasAuction ? `
        <div class="listing-auction" data-auction-end="${auctionEndAt}">
          <span class="auction-label">TIME LEFT:</span>
          <span class="auction-value auction-time-left-text"></span>
        </div>
      ` : ""}
    </div>

    <div class="listing-card-footer">
      <div class="listing-card-price">
        <div class="listing-card-price-main">${priceTxt}</div>
        <div class="listing-card-price-badges">${priceBadge}</div>
        <div class="small muted">${viewsLabel}</div>
      </div>
    </div>
  `;

  const imgEl = card.querySelector(".listing-card-img");
  ensureCoverFor(thumbId, imgEl);

  return card;
}


async function ensureCoverFor(id, imgEl) {
  if (!id || !imgEl) return;
  if (COVERS_CACHE.has(id)) {
    imgEl.src = COVERS_CACHE.get(id);
    return;
  }
  const hasApi = typeof window.AD_API === "object" && window.AD_API !== null;

  try {
    let item = null;
    if (hasApi && typeof window.AD_API.getPublicListingById === "function") {
      item = await window.AD_API.getPublicListingById(id);
    } else {
      const res = await fetch(API_BASE_MY + "/api/public/listings/" + encodeURIComponent(id));
      if (res.ok) item = await res.json();
    }
    if (!item) return;
    const photos = normalizePhotosLikeCatalog(item);
    if (photos && photos[0]) {
      COVERS_CACHE.set(id, photos[0]);
      if (imgEl?.isConnected) imgEl.src = photos[0];
    }
  } catch {}
}


// ============== UPLOAD ==============
async function uploadPhotos(files) {
  if (!files || files.length === 0) return [];
  const fd = new FormData();
  files.forEach(f => fd.append("Files", f));
  const res = await authFetch(API_BASE_MY + "/api/files/photos", {
    method: "POST",
    body: fd
  });
  if (!res.ok) {
    throw new Error("Качване на снимки неуспешно.");
  }
  const data = await res.json();
  return data.urls || [];
}


// ============== CREATE / EDIT MODE ==============
function clearForm(opts = {}) {
  const keepDropdownState = !!opts.keepDropdownState;

  const dropdownIds = new Set([
    "makeId", "modelId", "year",
    "bodyTypeId", "fuelTypeId", "transmissionId"
  ]);

  const ids = [
    "makeId", "modelId", "year", "bodyTypeId", "fuelTypeId", "transmissionId",
    "engineCc", "powerHp", "mileageKm", "title", "price", "description",
    "vin", "lotNumber", "priceNote", "auctionDate", "auctionTime",
    "originCountryCode", "sourceUrl", "videoUrl"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // ✅ при edit пазим ОПЦИИТЕ (няма flash), но чистим СТОЙНОСТТА
    if (keepDropdownState && dropdownIds.has(id)) {
      el.value = "";

      // 🔥 важно: като се чисти марката, чистим и модела като стойност + опции
      if (id === "makeId") {
        const modelSel = document.getElementById("modelId");
        if (modelSel) {
          modelSel.value = "";
          modelSel.innerHTML = "<option value=''>-- избери --</option>";
          modelSel.disabled = true;
        }
      }

      // 🔥 ако чистиш директно modelId – също чистиш опциите и disable
      if (id === "modelId") {
        el.innerHTML = "<option value=''>-- избери --</option>";
        el.disabled = true;
      }

      el.closest(".field")?.removeAttribute("data-invalid");
      return;
    }

    el.value = "";
    el.closest(".field")?.removeAttribute("data-invalid");
  });

  if (priceIsFinalEl) priceIsFinalEl.checked = false;
  if (hasDamageEl) hasDamageEl.checked = false;

  if (listingFeaturesBox) {
    listingFeaturesBox.querySelectorAll(".feature-chip").forEach(ch => {
      ch.classList.remove("is-selected");
    });
  }
  if (featureIdsHiddenEl) featureIdsHiddenEl.value = "";

  currentEditIdEl.value = "";
  formError.style.display = "none";
  formOk.style.display = "none";
  resetPhotosState();
  refreshAuctionInputsLock();

  LAST_AUTO_TITLE = "";
  TITLE_LOCKED_BY_USER = false;
}


function normalizeListing(item) {
  if (!item || typeof item !== "object") return item;

  const v = item.vehicle && typeof item.vehicle === "object" ? item.vehicle : {};
  const out = { ...item, ...v };

  // map алтернативни имена -> стандартни
  out.makeId ??= out.make_id ?? out.vehicleMakeId ?? out.vehicle_make_id;
  out.modelId ??= out.model_id ?? out.vehicleModelId ?? out.vehicle_model_id;

  out.makeName ??= out.make_name ?? out.make;
  out.modelName ??= out.model_name ?? out.model;

  return out;
}


function unlockVehicleFieldsForCreate() {
  [
    "makeId", "modelId", "year",
    "bodyTypeId", "fuelTypeId", "transmissionId",
    "engineCc", "powerHp", "mileageKm", "vin"
  ].forEach(id => setLockedField(id, false));
}

function lockVehicleFieldsForEdit() {
  setLockedField("vin", true);
}

function enterCreateMode() {
  clearForm();
  unlockVehicleFieldsForCreate();
  formTitle.textContent = "Нова обява";
  formBox.style.display = "block";
  document.getElementById("formSub").textContent =
    "Попълни задължителните полета и качи снимки.";

  if (LISTING_FEATURES.length) {
    applySelectedFeatures([]);
  }

  if (formBox && typeof formBox.scrollIntoView === "function") {
    formBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function prefillVehicleFieldsFromRow(row) {
  row = normalizeListing(row);

  // взимаме ИМЕНАТА (най-сигурното)
  const makeName = getFromRow(row, "makeName", "make_name", "make");
  const modelName = getFromRow(row, "modelName", "model_name", "model");

  // първо пробваме ID-та, после fallback по име
  let makeIdVal = getFromRow(row, "makeId", "make_id");
  let modelIdVal = getFromRow(row, "modelId", "model_id");

  // ако имаме име на марка -> намираме ID по име и го предпочитаме
  if (makeEl && makeName) {
    const byName = findOptionValueByText(makeEl, makeName);
    if (byName) makeIdVal = byName;
  }

  // 1) SET MAKE
  if (makeEl) makeEl.value = makeIdVal != null ? String(makeIdVal) : "";

  // 2) LOAD MODELS for that MAKE
  // ❗ НЕ подавай selectedModelId тук, защото може да е стар/грешен
  await loadModelsForMakeAndSelect(makeIdVal, null);

  // 3) SELECT MODEL (prefer by NAME, then by ID)
  if (modelEl) {
    if (modelName) {
      const modelValByName = findOptionValueByText(modelEl, modelName);
      if (modelValByName) {
        modelEl.value = String(modelValByName);
      } else if (modelIdVal != null) {
        modelEl.value = String(modelIdVal);
      } else {
        modelEl.value = "";
      }
    } else if (modelIdVal != null) {
      modelEl.value = String(modelIdVal);
    } else {
      modelEl.value = "";
    }
  }

  // останалите полета
  const yearVal = getFromRow(row, "year", "productionYear", "production_year");
  const mileageVal = getFromRow(row, "mileageKm", "mileage_km", "km");
  const engineCcVal = getFromRow(row, "engineCc", "engine_cc", "engine_capacity_cc");
  const powerHpVal = getFromRow(row, "powerHp", "power_hp", "hp");
  const bodyTypeIdVal = getFromRow(row, "bodyTypeId", "body_type_id");
  const fuelTypeIdVal = getFromRow(row, "fuelTypeId", "fuel_type_id");
  const transmissionIdVal = getFromRow(row, "transmissionId", "transmission_id");

  if (yearEl && yearVal != null) yearEl.value = String(yearVal);
  if (mileageKmEl && mileageVal != null) mileageKmEl.value = String(mileageVal);
  if (engineCcEl && engineCcVal != null) engineCcEl.value = String(engineCcVal);
  if (powerHpEl && powerHpVal != null) powerHpEl.value = String(powerHpVal);

  if (bodyTypeEl && bodyTypeIdVal != null) bodyTypeEl.value = String(bodyTypeIdVal);
  if (fuelTypeEl && fuelTypeIdVal != null) fuelTypeEl.value = String(fuelTypeIdVal);
  if (transmissionEl && transmissionIdVal != null) transmissionEl.value = String(transmissionIdVal);

  updateAutoTitle(true);
}



function prefillAuctionInputs(auctionEndAt) {
  if (!auctionDateEl || !auctionTimeEl) return;
  if (!auctionEndAt) {
    auctionDateEl.value = "";
    auctionTimeEl.value = "";
    refreshAuctionInputsLock();
    return;
  }
  const d = new Date(auctionEndAt);
  if (isNaN(d)) return;
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  auctionDateEl.value = `${y}-${m}-${dd}`;
  auctionTimeEl.value = `${hh}:${mm}`;
  refreshAuctionInputsLock();
}

async function enterEditMode(row) {
  // ✅ 1) първо гарантираме, че select-овете имат опции
  await ensureFormDataReady(true);


  // ✅ 2) чистим формата, но НЕ пипаме dropdown-ите (няма flash)
  clearForm({ keepDropdownState: true });

  // ✅ 3) при EDIT искаш да можеш да сменяш make/model/year → отключваме vehicle полетата
  unlockVehicleFieldsForCreate();

  // VIN ако искаш да остане заключен:
  lockVehicleFieldsForEdit();

  closeListingModal();

  formTitle.textContent = "Редакция на обява";
  formBox.style.display = "block";
  document.getElementById("formSub").textContent =
    `Редактираш #${row.listingId}${row.lotNumber ? " • Lot: " + row.lotNumber : ""}`;

  // взимаме пълния item и merge-ваме
  const fullItemRaw = await loadPhotosForEdit(row.listingId);

const base = normalizeListing(row);
const fresh = normalizeListing(fullItemRaw);

// fresh трябва да е authoritative
const item = fresh ? { ...base, ...fresh } : base;


  setIf("title", item.title);
  setIf("price", item.priceAmount);
  setIf("description", item.description);
  setIf("lotNumber", item.lotNumber);
  setIf("priceNote", item.priceNote);
  if (priceIsFinalEl) priceIsFinalEl.checked = !!item.priceIsFinal;
  setIf("vin", item.vin);

  const originVal = item.originCountryCode || item.origin_country_code || "";
  if (originCountryCodeEl) originCountryCodeEl.value = originVal || "";

  const hasDamageVal = (typeof item.hasDamage !== "undefined")
    ? item.hasDamage
    : item.has_damage;
  if (hasDamageEl) hasDamageEl.checked = !!hasDamageVal;

  const srcUrl = item.sourceUrl || item.source_url || "";
  const vidUrl = item.videoUrl || item.video_url || "";
  if (sourceUrlEl) sourceUrlEl.value = srcUrl || "";
  if (videoUrlEl) videoUrlEl.value = vidUrl || "";

  currentEditIdEl.value = item.listingId;

  // ✅ това сетва make/model/year + lookup полета и зарежда моделите за марката
  await prefillVehicleFieldsFromRow(item);

  const auctionEndAt = item.auctionEndAt || item.auction_end_at || null;
  prefillAuctionInputs(auctionEndAt);

  const existingFeatureIds = extractFeatureIdsFromItem(item);
  applySelectedFeatures(existingFeatureIds || []);

  initAutoTitleStateFromCurrent();

  if (formBox && typeof formBox.scrollIntoView === "function") {
    formBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }

console.log("ROW cache:", row);
console.log("FULL item:", fullItemRaw);
}


function setIf(id, val) {
  const el = document.getElementById(id);
  if (el && typeof val !== "undefined" && val !== null) el.value = String(val);
}

function parseIntOrNull(inputEl) {
  if (!inputEl) return null;
  const raw = inputEl.value.trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d\-]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? null : n;
}

function markInvalid(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const field = el.closest(".field");
  if (field) field.setAttribute("data-invalid", "true");
}


// ============== SAVE (Create | Update) ==============
btnSave?.addEventListener("click", async () => {
  formError.style.display = "none";
  formOk.style.display = "none";

  const idEditing = currentEditIdEl.value ? Number(currentEditIdEl.value) : null;

  const makeId = parseIntOrNull(makeEl);
  const modelId = parseIntOrNull(modelEl);
  const year = parseIntOrNull(yearEl);
  const bodyTypeId = parseIntOrNull(bodyTypeEl);
  const fuelTypeId = parseIntOrNull(fuelTypeEl);
  const transmissionId = parseIntOrNull(transmissionEl);
  const engineCc = parseIntOrNull(engineCcEl);
  const powerHp = parseIntOrNull(powerHpEl);
  const mileageKm = parseIntOrNull(mileageKmEl);

  const title = document.getElementById("title").value.trim();
  const priceStr = document.getElementById("price").value;
  const priceAmount = parseMoneyToNumber(priceStr);
  const descriptionRaw = document.getElementById("description").value;

  const vinRaw = vinEl.value.trim();
  const vin = vinRaw ? vinRaw.toUpperCase().replace(/[IOQ]/g, "") : null;

  const lotNumber = lotEl.value.trim() || null;
  const priceIsFinal = !!priceIsFinalEl.checked;
  const priceNote = (priceNoteEl.value || "").trim() || null;

  const auctionDateStr = auctionDateEl ? auctionDateEl.value : "";
  const auctionTimeStr = auctionTimeEl ? auctionTimeEl.value : "";
  const auctionEndAt = buildAuctionEndAt(auctionDateStr, auctionTimeStr, priceIsFinal);

  const originCountryCode = originCountryCodeEl
    ? (originCountryCodeEl.value || null)
    : null;
  const hasDamage = hasDamageEl ? !!hasDamageEl.checked : false;

  const featureIds = getSelectedFeatureIds();

  const sourceUrl = sourceUrlEl ? (sourceUrlEl.value.trim() || null) : null;
  const videoUrl = videoUrlEl ? (videoUrlEl.value.trim() || null) : null;

  let hasError = false;

  // ✅ задължителни (и за create, и за edit)
  if (!makeId) { markInvalid("makeId"); hasError = true; }
  if (!modelId) { markInvalid("modelId"); hasError = true; }
  if (!year) { markInvalid("year"); hasError = true; }

  if (!title) { markInvalid("title"); hasError = true; }

  if (!priceStr || !Number.isFinite(priceAmount) || priceAmount <= 0) {
    markInvalid("price");
    hasError = true;
  }

  if (hasError) {
    showErr("Марка, модел, година, заглавие и цена са задължителни.");
    return;
  }

  if (vin && (vin.length !== 17 || /[^A-HJ-NPR-Z0-9]/.test(vin))) {
    markInvalid("vin");
    showErr("VIN трябва да е 17 символа (без I, O, Q).");
    return;
  }

  try {
    saveSpinner.style.display = "inline";

    const { newFiles, deletedExistingUrls, setFirstAsCover } = getPhotoStateForSave();

    if (idEditing) {
      // ✅ UPDATE вече праща vehicle полетата, за да може Audi S5 → Audi RS7 да се запише
      const bodyUpdate = {
        makeId,
        modelId,
        year,
        bodyTypeId,
        fuelTypeId,
        transmissionId,
        engineCc,
        powerHp,
        mileageKm,

        title,
        description: descriptionRaw.trim() ? descriptionRaw : null,
        priceAmount: priceAmount,
        currencyCode: DEFAULT_CURRENCY, // EUR
        lotNumber,
        priceIsFinal,
        priceNote,
        hasDamage,
        originCountryCode,
        auctionEndAt,
        featureIds,
        sourceUrl,
        videoUrl
      };

      const res = await authFetch(
        API_BASE_MY + "/api/listings/" + encodeURIComponent(idEditing),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyUpdate)
        }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Грешка при редакция.");
      }

      if (deletedExistingUrls.length) {
        try {
          await authFetch(
            API_BASE_MY + "/api/listings/" + encodeURIComponent(idEditing) + "/photos",
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ urls: deletedExistingUrls })
            }
          );
        } catch {}
      }

      if (newFiles.length) {
        const urls = await uploadPhotos(newFiles);
        if (urls.length) {
          await authFetch(
            API_BASE_MY + `/api/listings/${encodeURIComponent(idEditing)}/photos`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ urls, setFirstAsCover })
            }
          );
        }
      }

      formOk.textContent = "Обявата е обновена.";
      formOk.style.display = "block";
    } else {
      const photoUrls = newFiles.length ? await uploadPhotos(newFiles) : [];

      const bodyCreate = {
        makeId,
        modelId,
        year,
        bodyTypeId,
        fuelTypeId,
        transmissionId,
        engineCc,
        powerHp,
        mileageKm,

        color: null,
        euroStandard: null,
        vin,
        lotNumber,
        priceIsFinal,
        priceNote,
        title,
        description: descriptionRaw,
        priceAmount: priceAmount,
        currencyCode: DEFAULT_CURRENCY, // EUR
        ownerUserId: null,
        photos: photoUrls,
        contact: null,
        dealerIdOverride: null,
        hasDamage,
        originCountryCode,
        auctionEndAt,
        featureIds,
        sourceUrl,
        videoUrl
      };

      const res = await authFetch(API_BASE_MY + "/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyCreate)
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Грешка при създаване.");
      }

      formOk.textContent = "Обявата е създадена.";
      formOk.style.display = "block";
    }

    await loadListings(CURRENT_MODE);
    setTimeout(() => { formBox.style.display = "none"; }, 300);

  } catch (err) {
    showErr(err.message || "Грешка при запис.");
  } finally {
    saveSpinner.style.display = "none";
  }
});


btnCancel?.addEventListener("click", () => {
  formBox.style.display = "none";
});

function showErr(msg) {
  formError.textContent = msg;
  formError.style.display = "block";
  formOk.style.display = "none";
}


// ============== МОДАЛ ОТВАРЯНЕ/ЗАТВАРЯНЕ ==============
function openListingModal() {
  if (!listingModal) return;
  listingModal.classList.add("is-open");
  document.body.classList.add("modal-open");
}

function closeListingModal() {
  if (!listingModal) return;
  listingModal.classList.remove("is-open");
  document.body.classList.remove("modal-open");
}

modalCloseBtn?.addEventListener("click", () => {
  closeListingModal();
});

listingModal?.addEventListener("click", (e) => {
  if (e.target.classList.contains("ad-modal-backdrop")) {
    closeListingModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && listingModal?.classList.contains("is-open")) {
    closeListingModal();
  }
});


// ============== DELETE / VIEW / EDIT actions ==============
document.addEventListener("click", async (e) => {
  const cardEl = e.target.closest(".listing-card");
  if (cardEl &&
      !e.target.closest(".listing-card-footer-actions") &&
      !e.target.closest(".ad-action-btn")) {
    const id = cardEl.dataset.id;
    if (id) {
      loadListingDynamic(id);
    }
    return;
  }

  if (e.target.classList.contains("btnDel")) {
    const id = e.target.dataset.id;
    if (!id) return;
    if (!confirm("Сигурен ли си, че искаш да изтриеш обявата? Това действие е необратимо.")) return;
    try {
      const res = await authFetch(
        API_BASE_MY + "/api/listings/" + encodeURIComponent(id) + "?hard=1",
        { method: "DELETE" }
      );
      if (!res.ok && res.status !== 404) {
        const t = await res.text();
        throw new Error(t || "Грешка при триене.");
      }

      await loadListings(CURRENT_MODE);

      if (listingModal && listingModal.dataset.listingId === String(id)) {
        closeListingModal();
      }
    } catch (err) {
      alert(err.message || "Грешка при триене");
    }
  }

  if (e.target.classList.contains("btnView")) {
    const id = e.target.dataset.id;
    if (id) loadListingDynamic(id);
  }

  if (e.target.classList.contains("btnEdit")) {
    const id = Number(e.target.dataset.id);
    const row = MY_LISTINGS_CACHE.find(x => Number(x.listingId) === id);
    if (row) enterEditMode(row);
  }
});


// ============== LOAD ONE (detail for modal) ==============
async function loadListingDynamic(id) {
  const hasApi = typeof window.AD_API === "object" && window.AD_API !== null;
  let item = null;

  if (hasApi && typeof window.AD_API.getPublicListingById === "function") {
    try {
      item = await window.AD_API.getPublicListingById(id);
    } catch {}
  }

  if (!item) {
    try {
      const res = await fetch(API_BASE_MY + "/api/public/listings/" + encodeURIComponent(id));
      if (res.ok) item = await res.json();
    } catch {}
  }

  const localRow = MY_LISTINGS_CACHE.find(x => String(x.listingId) === String(id));

  if (item && localRow) {
    // merge
    item = { ...localRow, ...item };

    // ✅ PRICE: първо localRow
    item.priceAmount =
      (localRow.priceAmount ?? localRow.price_amount ??
       item.priceAmount ?? item.price_amount ?? item.price ?? 0);

    // ✅ CURRENCY: 1:1 като картата -> ако localRow няма, пада на DEFAULT (EUR)
    // ❗ НЕ fallback-ваме към item.currency_code, за да не се прецаква модала
    item.currencyCode =
      (localRow.currencyCode ?? localRow.currency_code ?? DEFAULT_CURRENCY);
  } else if (!item && localRow) {
    item = localRow;
    item.currencyCode = item.currencyCode ?? item.currency_code ?? DEFAULT_CURRENCY;
  }

  if (item) {
    fillDetailPanel(item);
    openListingModal();
  } else {
    showEmptyDetail();
  }
}

function showEmptyDetail() {
  if (!detailEmpty || !detailBody) return;
  detailEmpty.style.display = "block";
  detailBody.style.display = "none";
}

function renderDetailFeatures(item) {
  if (!detailFeaturesBox) return;

  const arr = getFeaturesArrayFromItem(item);
  let names = arr
    .map(f => f.name || f.featureName || "")
    .filter(Boolean);

  if (!names.length) {
    detailFeaturesBox.style.display = "none";
    detailFeaturesBox.innerHTML = "";
    return;
  }

  detailFeaturesBox.innerHTML = names
    .map(n => `<span class="feature-badge">${escapeHtml(n)}</span>`)
    .join("");
  detailFeaturesBox.style.display = "flex";
}

function detectSourceInfo(url) {
  const u = (url || "").toLowerCase();
  if (!u) return null;

  if (u.includes("copart")) {
    return {
      className: "ad-link-btn--source-copart",
      text: "Copart"
    };
  }

  if (u.includes("iaai")) {
    return {
      className: "ad-link-btn--source-iaai",
      text: "IAAI"
    };
  }

  return {
    className: "ad-link-btn--source-generic",
    text: "Линк към търга"
  };
}
function fillDetailPanel(item) {
  detailEmpty.style.display = "none";
  detailBody.style.display = "block";

  const make = item.make_name || item.makeName || item.make || "";
  const model = item.model_name || item.modelName || item.model || "";
  const fuel = item.fuel_name || item.fuelTypeName || item.fuel_type || item.fuel || "";
  const gearbox = item.transmission || item.transmissionName || item.gearbox || "";
  const year = item.year || item.productionYear || item.production_year || "";
  const km = item.mileage_km || item.mileageKm || item.km || "";
  const body = item.body_type || item.bodyTypeName || item.body || "";
  const powerHp = item.power_hp || item.powerHp || item.hp || "";
  const engineCc = item.engine_cc || item.engineCc || item.engine_capacity_cc || "";
  const color = item.color || "";
  const publishedAt = item.published_at || item.publishedAt || item.created_at || item.createdAt || "";

  // ✅ priority: camelCase first, после snake_case
  const price = item.priceAmount ?? item.price_amount ?? item.price ?? 0;
  const currency = item.currencyCode ?? item.currency_code ?? DEFAULT_CURRENCY;

  const st = item.status || item.listingStatus;

  const lotNumber = item.lot_number || item.lotNumber || "";
  const priceIsFinal =
    (typeof item.price_is_final !== "undefined") ? item.price_is_final
      : (typeof item.priceIsFinal !== "undefined") ? item.priceIsFinal : null;
  const priceNote = item.price_note || item.priceNote || "";
  const auctionEndRaw = item.auction_end_at || item.auctionEndAt || null;

  const vin = item.vin || "";

  const cName = item.contact_name || item.contactName || "Продавач";
  const cPhone = item.contact_phone || item.contactPhone || "";
  const cEmail = item.contact_email || item.contactEmail || "";

  const listingId =
    item.listing_id || item.listingId || item.id || "";

  const sourceUrl = item.source_url || item.sourceUrl || "";
  const videoUrl = item.video_url || item.videoUrl || "";

  if (listingModal) {
    listingModal.dataset.listingId = String(listingId || "");
  }
  if (modalEditBtn) modalEditBtn.dataset.id = listingId;
  if (modalDeleteBtn) modalDeleteBtn.dataset.id = listingId;

  const photos = normalizePhotosLikeCatalog(item);
  const firstPhoto = photos[0] || FALLBACK_INLINE;

  if (detailMainImg) detailMainImg.src = firstPhoto;

  if (detailThumbs) {
    detailThumbs.innerHTML = "";
    if (photos.length > 1) {
      photos.forEach((src, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ad-thumb" + (idx === 0 ? " is-active" : "");
        btn.innerHTML = `<img src="${src}" alt="">`;
        btn.addEventListener("click", () => {
          detailMainImg.src = src;
          detailThumbs.querySelectorAll(".ad-thumb").forEach(t => t.classList.remove("is-active"));
          btn.classList.add("is-active");
        });
        detailThumbs.appendChild(btn);
      });
    }
  }

  const fallbackTitle = `${[make, model, year].filter(Boolean).join(" ")}`.trim();
  detailTitle.textContent = item.title || fallbackTitle || "Обява";

  const bits = [
    gearbox,
    fuel,
    km ? `${Number(km).toLocaleString("bg-BG")} км` : ""
  ].filter(Boolean);
  detailSubtitle.textContent = bits.join(" · ");

  const idTxt = listingId || "—";
  const idParts = [];
  if (idTxt) idParts.push("#" + idTxt);
  if (lotNumber) idParts.push("Lot: " + lotNumber);
  if (vin) idParts.push("VIN: " + vin);
  detailStock.textContent = idParts.join(" • ");

  // EUR primary + BGN secondary (HTML)
  detailPrice.innerHTML = formatPriceDual(price, currency);

  detailStatusNote.textContent =
    st === 1 ? "Активна обява"
      : st === 4 ? "Продадена"
      : st === 3 ? "Изтрита"
      : "Чернова";

  const badge =
    priceIsFinal === true ? '<span class="pill-final">Крайна цена</span>' :
      priceIsFinal === false ? '<span class="pill-provisional">Прогнозна</span>' : '';
  const note = priceNote ? `<div>${escapeHtml(priceNote)}</div>` : "";

  let auctionHtml = "";
  if (priceIsFinal === false && auctionEndRaw) {
    auctionHtml = `
      <div class="detail-auction-info" data-auction-end="${auctionEndRaw}">
        <div class="auction-sale-date">
          <span class="auction-label">Sale date:</span>
          <span class="auction-value">
            <strong class="auction-date-text"></strong><br />
            <span class="auction-time-text"></span>
          </span>
        </div>
        <div class="auction-time-left">
          <span class="auction-label">Time left:</span>
          <span class="auction-value auction-time-left-text"></span>
        </div>
      </div>
    `;
  }

  detailPriceMeta.innerHTML = `${badge}${note}${auctionHtml}`;

  detailSpecs.innerHTML = "";
  const specs = [
    { lbl: "Марка", val: make },
    { lbl: "Модел", val: model },
    { lbl: "Година", val: year },
    { lbl: "Пробег", val: km ? `${Number(km).toLocaleString("bg-BG")} км` : "" },
    { lbl: "Двигател", val: formatEngineLocal(engineCc, powerHp) },
    { lbl: "Гориво", val: fuel },
    { lbl: "Скорости", val: gearbox },
    { lbl: "Каросерия", val: body },
    { lbl: "Цвят", val: color },
    { lbl: "Публикувано", val: publishedAt ? formatDateBG(publishedAt) : "" }
  ];
  specs
    .filter(s => s.val)
    .forEach(s => {
      const row = document.createElement("div");
      row.className = "ad-detail-spec";
      row.innerHTML =
        `<span class="ad-detail-spec__lbl">${s.lbl}</span>` +
        `<span class="ad-detail-spec__val">${escapeHtml(String(s.val))}</span>`;
      detailSpecs.appendChild(row);
    });

  if (item.description) {
    detailDesc.innerHTML =
      `<h3>Описание</h3><p>${escapeHtml(String(item.description))}</p>`;
  } else {
    detailDesc.innerHTML = "";
  }

  if (cPhone || cEmail) {
    detailContactBox.style.display = "block";
    detailContactName.textContent = cName;
    if (cPhone) {
      detailContactPhone.href = "tel:" + cPhone.replace(/\s+/g, "");
      detailContactPhone.textContent = cPhone;
    } else {
      detailContactPhone.textContent = "";
    }
    if (cEmail) {
      detailContactEmail.href = "mailto:" + cEmail;
      detailContactEmail.textContent = cEmail;
    } else {
      detailContactEmail.textContent = "";
    }
  } else {
    detailContactBox.style.display = "none";
  }

  if (detailLinksBox) {
    detailLinksBox.innerHTML = "";

    if (sourceUrl) {
      const info = detectSourceInfo(sourceUrl);
      if (info) {
        const a = document.createElement("a");
        a.href = sourceUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = info.text;
        a.className = "ad-link-btn " + info.className;
        detailLinksBox.appendChild(a);
      }
    }

    if (videoUrl) {
      const aVid = document.createElement("a");
      aVid.href = videoUrl;
      aVid.target = "_blank";
      aVid.rel = "noopener noreferrer";
      aVid.textContent = "Чуй двигателя";
      aVid.className = "ad-link-btn ad-link-btn--video";
      detailLinksBox.appendChild(aVid);
    }

    detailLinksBox.style.display =
      detailLinksBox.childElementCount ? "flex" : "none";
  }

  renderDetailFeatures(item);
  initAuctionCountdowns();
}


// ============== HELPERS ==============
function formatEngineLocal(cc, hp) {
  const nCc = Number(cc), nHp = Number(hp);
  const parts = [];
  if (nCc) {
    const liters = nCc / 1000;
    parts.push(
      (Number.isInteger(liters) ? liters.toFixed(0) : liters.toFixed(1)) + " L"
    );
  }
  if (nHp) parts.push(nHp + " к.с.");
  return parts.join(" · ");
}

function formatDateBG(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizePhotosLikeCatalog(item) {
  if (item?.photos_json) {
    try {
      const arr = JSON.parse(item.photos_json);
      if (Array.isArray(arr) && arr.length)
        return arr.map(p => makeAbsIfNeeded(typeof p === "string" ? p : p.url));
    } catch {}
  }
  if (Array.isArray(item?.photos) && item.photos.length)
    return item.photos.map(p => makeAbsIfNeeded(typeof p === "string" ? p : p.url));
  if (Array.isArray(item?.photoUrls) && item.photoUrls.length)
    return item.photoUrls.map(u => makeAbsIfNeeded(u));
  const single =
    item?.cover_photo_url ||
    item?.coverPhotoUrl ||
    item?.photo_url ||
    item?.cover_url ||
    item?.main_photo ||
    item?.image_url;
  if (single) return [makeAbsIfNeeded(single)];
  return [];
}

function makeAbsIfNeeded(url) {
  if (!url) return FALLBACK_INLINE;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:"))
    return url;
  if (url.startsWith("/"))
    return API_BASE_MY.replace(/\/+$/, "") + url;
  return url;
}

function getFeaturesArrayFromItem(item) {
  if (!item) return [];
  if (Array.isArray(item.features)) return item.features;

  if (typeof item.features_json === "string" && item.features_json.trim()) {
    try {
      return JSON.parse(item.features_json);
    } catch {
      return [];
    }
  }
  return [];
}

function isSelectReady(sel) {
  return !!(sel && sel.options && sel.options.length > 1);
}

function ensureFormDataReady(force = false) {
  // ако DOM е бил празен при първото викане, "force" или "не е ready" -> зареди пак
  if (force || !isSelectReady(makeEl)) {
    MAKES_READY = loadMakes();
  }

  // lookups
  const bt = document.getElementById("bodyTypeId");
  const ft = document.getElementById("fuelTypeId");
  const tr = document.getElementById("transmissionId");
  const lookupsReady = isSelectReady(bt) && isSelectReady(ft) && isSelectReady(tr);

  if (force || !lookupsReady) {
    LOOKUPS_READY = loadLookups();
  }

  // features
  if (force || !Array.isArray(LISTING_FEATURES) || LISTING_FEATURES.length === 0) {
    FEATURES_READY = loadListingFeatures();
  }

  return Promise.all([MAKES_READY, LOOKUPS_READY, FEATURES_READY]);
}
function findOptionValueByText(sel, text) {
  const t = String(text || "").trim().toLowerCase();
  if (!sel || !t) return null;

  const opt = Array.from(sel.options).find(o =>
    String(o.textContent || "").trim().toLowerCase() === t
  );

  return opt ? opt.value : null;
}


// ============== INIT ==============
document.addEventListener("DOMContentLoaded", async () => {
  await ensureFormDataReady(true);   // force първоначално зареждане
  setModeAndLoad("mine");
});


