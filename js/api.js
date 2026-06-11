// js/api.js
// Централизирани заявки към ASP.NET API — коректна сериализация на масиви и числа

const API_BASE =
  (window.API_BASE && typeof window.API_BASE === "string")
    ? window.API_BASE
    : (location.hostname === "localhost" || location.hostname === "127.0.0.1"
        ? "https://atlanticdriveapi.azurewebsites.net"
        : "https://atlanticdriveapi.azurewebsites.net");

// ✅ Share endpoint (OG meta за iMessage/Messenger)
const SHARE_BASE =
  (window.SHARE_BASE && typeof window.SHARE_BASE === "string")
    ? window.SHARE_BASE.replace(/\/+$/, "")
    : `${API_BASE}/share`;

// ------- helpers -------
function isNumericString(v) {
  return typeof v === "string" && /^\d+$/.test(v.trim());
}

function toIntOrNull(v) {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (isNumericString(v)) return Number(v);
  return null;
}

function appendNumber(qs, key, val) {
  const n = toIntOrNull(val);
  if (n !== null) qs.append(key, String(n));
}

function appendDecimal(qs, key, val) {
  if (typeof val === "number" && Number.isFinite(val)) {
    qs.append(key, String(val));
  } else if (typeof val === "string" && val.trim() !== "" && !Number.isNaN(Number(val))) {
    qs.append(key, val.trim());
  }
}

function buildQuery(params = {}) {
  const qs = new URLSearchParams();

  for (const [key, rawVal] of Object.entries(params)) {
    if (rawVal === undefined || rawVal === null || rawVal === "") continue;

    // Масиви -> ?key=1&key=2 (ASP.NET Core int[] binding)
    if (Array.isArray(rawVal)) {
      for (const item of rawVal) {
        appendNumber(qs, key, item);
      }
      continue;
    }

    // Числови query-та
    switch (key) {
      case "makeId":
      case "modelId":
      case "yearFrom":
      case "yearTo":
      case "kmMin":
      case "kmMax":
      case "skip":
      case "take":
      // нови числови филтри:
      case "bodyTypeId":
      case "engineFromCc":
      case "engineToCc":
      case "powerFromHp":
      case "powerToHp":
        appendNumber(qs, key, rawVal);
        break;

      case "priceFrom":
      case "priceTo":
        appendDecimal(qs, key, rawVal);
        break;

      default:
        // sort, origin, color и други текстови
        qs.append(key, String(rawVal));
        break;
    }
  }

  return qs.toString();
}

// ------- HTTP -------
async function apiGet(path, params = {}) {
  const query = buildQuery(params);
  const url = `${API_BASE}${path}${query ? `?${query}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
    // credentials: "include",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText} :: ${txt}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return res.json();
}

async function apiPost(path, body = null) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
    // credentials: "include",
    keepalive: true,
  });

  if (!res.ok && res.status !== 204) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText} :: ${txt}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

// ------- Публични ресурси -------
async function getMakes() {
  return apiGet("/api/public/makes");
}

async function getModels(makeId) {
  return apiGet("/api/public/models", { makeId });
}

async function getLookups() {
  return apiGet("/api/public/lookups");
}

async function getListingFeatures() {
  return apiGet("/api/public/listing-features");
}

async function getPublicListings(filters = {}) {
  return apiGet("/api/public/listings", filters);
}

async function getPublicListingById(id) {
  return apiGet(`/api/public/listings/${id}`);
}

// ------- Проследяване (по желание) -------
function trackListingView(id) {
  const endpoint = `${API_BASE}/api/listings/${id}/view`;
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([], { type: "text/plain;charset=UTF-8" });
      navigator.sendBeacon(endpoint, blob);
      return;
    }
    fetch(endpoint, {
      method: "POST",
      headers: { "Accept": "*/*" },
      body: "",
      // credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch { /* no-op */ }
}

async function getListingStats(id) {
  return apiGet(`/api/listings/${id}/stats`);
}

// ------- ✅ Share helpers -------
function getShareUrlForListing(id) {
  const safeId = encodeURIComponent(String(id));
  return `${SHARE_BASE}/${safeId}`;
}

async function shareListing({ id, url, title, text } = {}) {
  const shareUrl = url || (id ? getShareUrlForListing(id) : "");
  if (!shareUrl) throw new Error("Missing share url / id");

  const data = { url: shareUrl };
  if (title) data.title = String(title);
  if (text) data.text = String(text);

  // Native share (iOS/Android)
  if (navigator.share) {
    await navigator.share(data);
    return { mode: "native", url: shareUrl };
  }

  // Clipboard
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(shareUrl);
    return { mode: "clipboard", url: shareUrl };
  }

  // Fallback
  window.prompt("Копирай линка:", shareUrl);
  return { mode: "prompt", url: shareUrl };
}

// ------- expose -------
window.AD_API = {
  apiGet,
  apiPost,
  getMakes,
  getModels,
  getLookups,
  getListingFeatures,
  getPublicListings,
  getPublicListingById,
  trackListingView,
  getListingStats,

  // ✅ share
  getShareUrlForListing,
  shareListing,
};

// За съвместимост със стар код:
window.AD_API_BASE = API_BASE;
window.AD_SHARE_BASE = SHARE_BASE;
