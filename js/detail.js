// js/detail.js
document.addEventListener("DOMContentLoaded", initDetail);

// SVG fallback ако липсва картинка (без мрежови заявки)
const FALLBACK_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#eef2f7" offset="0"/>
      <stop stop-color="#e3e9f2" offset="1"/>
    </linearGradient>
  </defs>
  <rect fill="url(#g)" x="0" y="0" width="1200" height="675"/>
  <g fill="#8aa0bf" opacity="0.9">
    <circle cx="600" cy="300" r="120"/>
    <rect x="360" y="410" rx="12" ry="12" width="480" height="28"/>
  </g>
</svg>`);

const BRAND_SHARE_IMAGE = "Images/og-logo-neon-1200x630.png";

// =========================
// ORIGIN FLAGS (Detail) — after title on ALL screens
// =========================
const ORIGIN_FLAGS = {
  usa: { src: "Images/USAFlag.webp", alt: "САЩ" },
  canada: { src: "Images/canadaFlag.png", alt: "Канада" },
  korea: { src: "Images/Korea.png", alt: "Южна Корея" },
  uae: { src: "Images/UAE.webp", alt: "ОАЕ" },
};

const ORIGIN_ID_MAP = { 1: "usa", 2: "canada", 3: "korea", 4: "uae" };

function normalizeOrigin(val) {
  if (val == null) return "";

  // ако е обект {id,name}
  if (typeof val === "object") {
    const n = val.name ?? val.title ?? val.value ?? "";
    const id = val.id ?? val.originId ?? val.origin_id ?? "";
    if (id != null && String(id).trim() !== "" && /^\d+$/.test(String(id).trim())) {
      return ORIGIN_ID_MAP[Number(String(id).trim())] || "";
    }
    val = n;
  }

  const raw = String(val).trim();
  if (!raw) return "";

  // numeric/enum като "1"
  if (/^\d+$/.test(raw)) return ORIGIN_ID_MAP[Number(raw)] || "";

  const s = raw.toLowerCase();

  // USA
  if (
    s.includes("сащ") ||
    s.includes("u.s") ||
    s === "us" ||
    s.includes("usa") ||
    s.includes("united states") ||
    s.includes("america") ||
    s.includes("америка")
  )
    return "usa";

  // Canada
  if (s.includes("канада") || s === "ca" || s.includes("canada")) return "canada";

  // Korea
  if (s.includes("южна корея") || s.includes("south korea") || s.includes("korea") || s.includes("корея"))
    return "korea";

  // UAE
  if (s.includes("оае") || s.includes("uae") || s.includes("emirates") || s.includes("дубай") || s.includes("abu dhabi"))
    return "uae";

  return "";
}

function getListingOriginRaw(row) {
  const direct =
    row.origin ??
    row.origin_name ??
    row.originName ??
    row.origin_country ??
    row.originCountry ??
    row.source_country ??
    row.sourceCountry ??
    row.market ??
    row.market_name ??
    row.marketName ??
    row.source_market ??
    row.sourceMarket ??
    row.import_from ??
    row.importFrom ??
    row.import_country ??
    row.importCountry ??
    row.auction_country ??
    row.auctionCountry ??
    row.country ??
    row.country_name ??
    row.countryName ??
    row.origin_id ??
    row.originId ??
    "";

  if (direct) return direct;

  // fallback: сканираме целия row за "origin/country/market/source"
  for (const [k, v] of Object.entries(row || {})) {
    if (v == null) continue;
    const key = String(k).toLowerCase();
    if (!/(origin|country|market|source)/.test(key)) continue;

    if (typeof v === "string" || typeof v === "number") return v;
    if (typeof v === "object") {
      const n = v.name ?? v.title ?? v.value ?? "";
      if (n) return n;
      const id = v.id ?? "";
      if (id) return id;
    }
  }

  return "";
}

// DOM вариант (без innerHTML)
function buildOriginFlagImg(row) {
  const raw = getListingOriginRaw(row);
  const key = normalizeOrigin(raw);
  const meta = key ? ORIGIN_FLAGS[key] : null;
  if (!meta) return null;

  const img = document.createElement("img");
  img.src = meta.src;
  img.alt = meta.alt;
  img.className = "title__flag";
  img.loading = "lazy";
  img.decoding = "async";
  return img;
}

// Задава заглавие + флаг след него (винаги)
function setTitleWithFlag(titleEl, titleText, row) {
  if (!titleEl) return;

  titleEl.textContent = ""; // чистим всичко вътре
  const span = document.createElement("span");
  span.className = "title__text";
  span.textContent = titleText;

  titleEl.appendChild(span);

  const flag = buildOriginFlagImg(row);
  if (flag) titleEl.appendChild(flag);
}

// безопасно закачане на fallback за <img>
function attachImgFallback(imgEl) {
  if (!imgEl) return;
  imgEl.onerror = () => {
    imgEl.onerror = null;
    imgEl.src = FALLBACK_PLACEHOLDER;
  };
}

// ✅ Share UI helper (само за бутон)
function flashBtn(el, text, ms = 1400) {
  if (!el) return;
  const old = el.textContent;
  el.textContent = text;
  el.classList.add("is-flash");
  setTimeout(() => {
    el.textContent = old;
    el.classList.remove("is-flash");
  }, ms);
}

/**
 * ✅ Стабилен парс за числа:
 * - приема number или string
 * - маха интервали
 * - приема запетая като десетична
 * - връща number или null
 */
function toNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

async function initDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const hasApi = typeof window.AD_API === "object" && window.AD_API !== null;

  // Елементи
  const mainImgEl = document.getElementById("carMainImg");
  const thumbsWrap = document.getElementById("carThumbs");
  const titleEl = document.getElementById("carTitle");
  const subtitleEl = document.getElementById("carSubtitle");
  const stockEl = document.getElementById("carStock");
  const priceEl = document.getElementById("carPrice");
  const priceNoteEl = document.getElementById("carPriceNote");
  const descWrap = document.getElementById("carDescription");
  const tagsWrap = document.getElementById("carTags");
  const specsBox = document.getElementById("specsBox");
  const btnConsult = document.getElementById("btnConsult");
  const btnShare = document.getElementById("btnShare"); // ✅ added

  // Views UI (само total)
  const viewsBox = document.getElementById("viewStats");
  const viewsTotalEl = document.getElementById("viewsTotal");

  // Контакти
  const contactCard = document.getElementById("contactCard");
  const contactName = document.getElementById("contactName");
  const contactPhone = document.getElementById("contactPhone");
  const contactEmail = document.getElementById("contactEmail");

  // Видео секция
  const videoSection = document.getElementById("detailVideo");
  const videoFrame = document.getElementById("detailVideoFrame");

  // Lightbox
  const lb = document.getElementById("imgLightbox");
  const lbImg = document.getElementById("imgLightboxImg");
  const lbClose = document.getElementById("imgLightboxClose");
  const lbBackdrop = document.getElementById("imgLightboxBackdrop");
  const lbPrev = document.getElementById("imgLightboxPrev");
  const lbNext = document.getElementById("imgLightboxNext");
  const lbZoomIn = document.getElementById("imgZoomIn");
  const lbZoomOut = document.getElementById("imgZoomOut");
  const lbZoomReset = document.getElementById("imgZoomReset");

  if (!id) {
    if (titleEl) titleEl.textContent = "Липсва id на обява.";
    // SEO за error
    applyDetailSEO({
      id: "",
      make: "",
      model: "",
      year: "",
      km: "",
      fuel: "",
      gearbox: "",
      body: "",
      priceBGN: 0,
      priceEUR: 0,
      currency: "EUR",
      firstPhoto: "",
      priceIsFinal: null,
    });
    return;
  }

  // Пинг view
  try {
    await window.AD_API?.trackListingView?.(id);
  } catch {}

  let item = null;

  // 1) Зареждане на обявата
  try {
    if (hasApi && typeof AD_API.getPublicListingById === "function") {
      item = await AD_API.getPublicListingById(id);
    }
  } catch (e) {
    console.warn("AD_API.getPublicListingById гръмна:", e);
  }

  // 2) DEMO fallback
  if (!item) {
    const DEMO = {
      listing_id: 1,
      status: 1,
      title: "BMW 3 Series 2018",
      description: "Отлично състояние.",
      price_amount: 24500,
      currency_code: "EUR",
      published_at: "2025-10-29T09:33:58.789",
      dealer_id: 1,
      dealer_name: "Atlantic Drive",
      vehicle_id: 1,
      make: "BMW",
      model: "3 Series",
      year: 2018,
      mileage_km: 95000,
      color: "Черно",
      engine_cc: 1998,
      power_hp: 190,
      body_type: "Седан",
      fuel_type: "Бензин",
      transmission: "Автоматик",
      contact_name: "Nikola",
      contact_phone: "0888123456",
      contact_email: "nikola@atlanticdrive.bg",
      cover_photo_url: "Images/placeholder-car.png",
      price_is_final: true,
      price_note: "ДДС включено",
      video_url: "",
    };
    if (String(id) === "1") item = DEMO;
  }

  if (!item) {
    if (titleEl) titleEl.textContent = "Обявата не е намерена.";
    // SEO за not found
    applyDetailSEO({
      id,
      make: "",
      model: "",
      year: "",
      km: "",
      fuel: "",
      gearbox: "",
      body: "",
      priceBGN: 0,
      priceEUR: 0,
      currency: "EUR",
      firstPhoto: "",
      priceIsFinal: null,
    });
    return;
  }

  // Нормализирани полета
  const make = item.make_name || item.make || "";
  const model = item.model_name || item.model || "";
  const fuel = item.fuel_name || item.fuel_type || item.fuel || "";
  const gearbox = item.transmission || item.gearbox || "";
  const year = item.year || item.production_year || "";
  const km = toNumber(item.mileage_km ?? item.km) || ""; // ✅ стабилно
  const color = item.color || "";
  const body = item.body_type || item.body || "";
  const powerHp = item.power_hp || item.hp || "";
  const engineCc = item.engine_cc || item.engine_capacity_cc || "";
  const dealer = item.dealer_name || "";
  const publishedAt = item.published_at || item.created_at || item.updated_at || "";
  const drive = item.drive || item.drivetrain || "";

  // Тип цена + бележка
  let priceIsFinal = null;
  if (typeof item.price_is_final !== "undefined") {
    priceIsFinal = !!item.price_is_final;
  } else if (typeof item.priceIsFinal !== "undefined") {
    priceIsFinal = !!item.priceIsFinal;
  }
  const priceNoteRaw = item.price_note || item.priceNote || "";

  // Контакти
  const cName = item.contact_name || dealer || "Продавач";
  const cPhoneRaw = item.contact_phone || "";
  const cEmail = item.contact_email || "";

  // Видео URL
  const videoUrlRaw = item.video_url || item.videoUrl || "";

  // Снимки
  let photos = [];
  if (item.photos_json) {
    try {
      const parsed = JSON.parse(item.photos_json);
      if (Array.isArray(parsed)) photos = parsed;
    } catch {}
  }
  if (!photos.length && (item.cover_photo_url || item.photo_url)) {
    photos = [{ url: item.cover_photo_url || item.photo_url, is_cover: true }];
  }

  const firstPhoto =
    photos.find((p) => p.is_cover)?.url || photos[0]?.url || "Images/placeholder-car.png";

  if (mainImgEl) {
    mainImgEl.src = firstPhoto;
    attachImgFallback(mainImgEl);
  }

  // Lightbox setup
  const photoUrls = photos.length ? photos.map((p) => p.url) : [firstPhoto];
  let currentPhotoIndex = 0;
  let currentZoom = 1;

  function openLightbox(idx) {
    if (!lb || !lbImg) return;
    currentPhotoIndex = Math.max(0, Math.min(idx, photoUrls.length - 1));
    lbImg.src = photoUrls[currentPhotoIndex];
    attachImgFallback(lbImg);
    currentZoom = 1;
    lbImg.style.transform = "scale(1)";
    lb.classList.add("is-on");
    lb.setAttribute("aria-hidden", "false");
  }
  function closeLightbox() {
    if (!lb) return;
    lb.classList.remove("is-on");
    lb.setAttribute("aria-hidden", "true");
  }
  function showNext() {
    if (!photoUrls.length) return;
    currentPhotoIndex = (currentPhotoIndex + 1) % photoUrls.length;
    lbImg.src = photoUrls[currentPhotoIndex];
    attachImgFallback(lbImg);
    currentZoom = 1;
    lbImg.style.transform = "scale(1)";
  }
  function showPrev() {
    if (!photoUrls.length) return;
    currentPhotoIndex = (currentPhotoIndex - 1 + photoUrls.length) % photoUrls.length;
    lbImg.src = photoUrls[currentPhotoIndex];
    attachImgFallback(lbImg);
    currentZoom = 1;
    lbImg.style.transform = "scale(1)";
  }

  lbClose && lbClose.addEventListener("click", closeLightbox);
  lbBackdrop && lbBackdrop.addEventListener("click", closeLightbox);
  lbNext && lbNext.addEventListener("click", showNext);
  lbPrev && lbPrev.addEventListener("click", showPrev);

  lbZoomIn &&
    lbZoomIn.addEventListener("click", () => {
      currentZoom = Math.min(currentZoom + 0.2, 3);
      lbImg.style.transform = `scale(${currentZoom})`;
    });
  lbZoomOut &&
    lbZoomOut.addEventListener("click", () => {
      currentZoom = Math.max(currentZoom - 0.2, 0.4);
      lbImg.style.transform = `scale(${currentZoom})`;
    });
  lbZoomReset &&
    lbZoomReset.addEventListener("click", () => {
      currentZoom = 1;
      lbImg.style.transform = "scale(1)";
    });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight" && lb && lb.classList.contains("is-on")) showNext();
    if (e.key === "ArrowLeft" && lb && lb.classList.contains("is-on")) showPrev();
  });

  if (mainImgEl) {
    mainImgEl.style.cursor = "zoom-in";
    mainImgEl.addEventListener("click", () => openLightbox(currentPhotoIndex));
  }

  if (thumbsWrap) {
    thumbsWrap.innerHTML = "";
    if (photos.length > 1) {
      photos.forEach((p, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "thumb" + (idx === 0 ? " is-active" : "");
        btn.innerHTML = `<img src="${p.url}" alt="">`;
        const img = btn.querySelector("img");
        attachImgFallback(img);

        btn.addEventListener("click", () => {
          if (mainImgEl) mainImgEl.src = p.url;
          attachImgFallback(mainImgEl);
          thumbsWrap.querySelectorAll(".thumb").forEach((t) => t.classList.remove("is-active"));
          btn.classList.add("is-active");
          currentPhotoIndex = idx;
        });
        btn.addEventListener("dblclick", () => openLightbox(idx));
        thumbsWrap.appendChild(btn);
      });
    }
  }

  // Заглавие / подзаглавие / stock
  const titleText = item.title || `${make} ${model}`.trim() || "Автомобил";
  setTitleWithFlag(titleEl, titleText, item);

  if (subtitleEl) {
    const bits = [gearbox, fuel, km ? `${Number(km).toLocaleString("bg-BG")} км` : ""].filter(Boolean);
    subtitleEl.textContent = bits.join(" · ");
  }
  if (stockEl) stockEl.textContent = "#" + (item.listing_id || item.id || "—");

  // ===== Цена: входът е EUR (дефакто), показваме EUR голямо, BGN отдолу =====
  const EUR_PER_BGN = 1 / 1.95583; // фиксиран курс
  const BGN_PER_EUR = 1.95583;

  // ✅ стабилен парс на price_amount (поддържа "24 500" / "24,500")
  const rawAmount = toNumber(item.price_amount) || 0;
  const rawCurr = String(item.currency_code || "").toUpperCase();

  let priceEUR = 0,
    priceBGN = 0,
    haveFx = false;

  if (rawAmount) {
    // Ако някъде още идва BGN — конвертираме към EUR за показване
    if (rawCurr === "BGN" || rawCurr === "ЛВ" || rawCurr === "ЛВ.") {
      priceBGN = rawAmount;
      priceEUR = rawAmount * EUR_PER_BGN;
      haveFx = true;
    } else {
      // По подразбиране приемаме EUR (вкл. EUR/€/празно/непознато)
      priceEUR = rawAmount;
      priceBGN = rawAmount * BGN_PER_EUR;
      haveFx = true;
    }
  }

  // MAIN: EUR
  if (priceEl) {
    priceEl.textContent = priceEUR
      ? formatPriceEUR(priceEUR)
      : rawAmount
      ? `${rawAmount.toLocaleString("bg-BG")} ${item.currency_code || ""}`
      : "По запитване";
  }

  // NOTE: ≈ BGN + балонче (tooltip = бележка)
  if (priceNoteEl) {
    const lines = [];

    if (haveFx && priceBGN) {
      lines.push(`≈ ${formatPriceBGN(priceBGN)}`);
    }

    let pillHtml = "";
    const hasNote = !!priceNoteRaw;
    const titleAttr = hasNote ? ` title="${escapeHtmlAttr(priceNoteRaw)}"` : "";

    if (priceIsFinal === true) {
      pillHtml = `<span class="price-pill price-pill--final"${titleAttr}>Крайна цена</span>`;
    } else if (priceIsFinal === false) {
      pillHtml = `<span class="price-pill price-pill--provisional"${titleAttr}>Прогнозна цена</span>`;
    }
    if (pillHtml) lines.push(pillHtml);

    if (lines.length) {
      priceNoteEl.style.display = "block";
      priceNoteEl.innerHTML = lines.join("<br>");
    } else {
      priceNoteEl.style.display = "none";
      priceNoteEl.textContent = "";
    }
  }

  // ===== ✅ Share button (OG preview via /share/{id}) =====
  if (btnShare && window.AD_API && typeof window.AD_API.shareListing === "function") {
    const shareTitle = [make, model, year].filter(Boolean).join(" ").trim() || (item.title || "Обява");

    const shareTextBits = [
      priceEUR ? formatPriceEUR(priceEUR) : "",
      km ? `${Number(km).toLocaleString("bg-BG")} км` : "",
      fuel || "",
      gearbox || "",
    ].filter(Boolean);

    const shareText = shareTextBits.join(" · ");

    btnShare.addEventListener("click", async () => {
      const prevDisabled = btnShare.disabled;
      btnShare.disabled = true;

      try {
        const res = await window.AD_API.shareListing({
          id,
          title: shareTitle,
          text: shareText,
        });

        if (res?.mode === "clipboard") flashBtn(btnShare, "Копирано ✅");
        else if (res?.mode === "prompt") flashBtn(btnShare, "Линк ✅");
      } catch (e) {
        console.warn("Share failed:", e);
        flashBtn(btnShare, "Грешка ❌");
      } finally {
        btnShare.disabled = prevDisabled;
      }
    });
  }

  // ✅ Динамично SEO (title/desc/canonical/OG/Twitter/JSON-LD)
  applyDetailSEO({
    id,
    make,
    model,
    year,
    km,
    fuel,
    gearbox,
    body,
    priceBGN,
    priceEUR,
    currency: "EUR",
    firstPhoto,
    priceIsFinal,
  });

  // Характеристики
  const specMap = {
    year: { el: document.getElementById("specYear"), val: year },
    mileage_km: {
      el: document.getElementById("specKm"),
      val: km ? `${Number(km).toLocaleString("bg-BG")} км` : "",
    },
    // ✅ Двигател вече НЕ включва к.с. (за да не се повтаря с "Мощност")
    engine: { el: document.getElementById("specEngine"), val: formatEngine(engineCc) },
    fuel: { el: document.getElementById("specFuel"), val: fuel },
    gearbox: { el: document.getElementById("specGearbox"), val: gearbox },
    drive: { el: document.getElementById("specDrive"), val: drive },
    body_type: { el: document.getElementById("specBody"), val: body },
    power_hp: { el: document.getElementById("specPower"), val: powerHp ? `${powerHp} к.с.` : "" },
    color: { el: document.getElementById("specColor"), val: color },

    // ✅ Премахнат "Търговец" от характеристиките (показва се в контактите)
    dealer_name: { el: document.getElementById("specDealer"), val: "" },

    published_at: {
      el: document.getElementById("specPublished"),
      val: publishedAt ? formatDateBG(publishedAt) : "",
    },
  };

  if (specsBox) {
    specsBox.querySelectorAll(".detail-spec").forEach((specEl) => {
      const key = specEl.dataset.key;
      if (!key || !specMap[key]) return;
      const { el, val } = specMap[key];
      if (!val) {
        specEl.remove();
      } else if (el) {
        el.textContent = val;
      }
    });
  }

  // Описание
  if (descWrap) {
    const desc = item.description || item.notes || "";
    descWrap.innerHTML = desc
      ? `<h2>Описание</h2><p>${escapeHtml(desc).replace(/\n/g, "<br>")}</p>`
      : `<h2>Описание</h2><p class="muted">Няма въведено описание.</p>`;
  }

  // Тагове
  if (tagsWrap) {
    tagsWrap.innerHTML = "";
    [fuel, gearbox, body].filter(Boolean).forEach((t) => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = t;
      tagsWrap.appendChild(span);
    });
  }

  // Контакти
  if (contactCard && (cName || cPhoneRaw || cEmail)) {
    contactCard.style.display = "block";
    if (contactName) contactName.textContent = cName;
    if (contactPhone && cPhoneRaw) {
      contactPhone.href = "tel:" + cPhoneRaw.replace(/\s+/g, "");
      contactPhone.textContent = cPhoneRaw;
    }
    if (contactEmail && cEmail) {
      contactEmail.href = "mailto:" + cEmail;
      contactEmail.textContent = cEmail;
    }
  }

  // Бутон консултация
  if (btnConsult) {
    if (cPhoneRaw) {
      const clean = cPhoneRaw.replace(/\s+/g, "");
      btnConsult.href = "tel:" + clean;
      btnConsult.textContent = "✆ " + cPhoneRaw;
      btnConsult.style.whiteSpace = "nowrap";
    } else {
      const subject = encodeURIComponent(`Запитване за автомобил ${make} ${model} (${item.listing_id || item.id || "-"})`);
      const to = cEmail || "office@atlanticdrive.bg";
      btnConsult.href = `mailto:${to}?subject=${subject}`;
      btnConsult.textContent = "Изпрати e-mail";
    }
  }

  // Видео – вграден плеър най-отдолу
  if (videoSection && videoFrame) {
    if (videoUrlRaw) {
      const embedHtml = buildVideoEmbed(videoUrlRaw);
      if (embedHtml) {
        videoFrame.innerHTML = embedHtml;
        videoSection.style.display = "block";
      } else {
        videoSection.style.display = "none";
        videoFrame.innerHTML = "";
      }
    } else {
      videoSection.style.display = "none";
      videoFrame.innerHTML = "";
    }
  }

  // ===== Views (само общо) =====
  const initialTotal = item.views_count ?? item.viewsTotal ?? item.views ?? null;
  updateViewsBox(viewsBox, viewsTotalEl, initialTotal);

  setTimeout(async () => {
    try {
      const s = await window.AD_API?.getListingStats?.(id);
      if (s && typeof s.total !== "undefined") {
        updateViewsBox(viewsBox, viewsTotalEl, s.total);
      }
    } catch {}
  }, 200);
}

/* ===== SEO helpers ===== */

function setMetaById(id, value, attr = "content") {
  const el = document.getElementById(id);
  if (!el) return;
  if (attr === "text") el.textContent = value;
  else el.setAttribute(attr, value);
}

function absUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const cleaned = url.replace(/^\.?\//, "");
  return `${location.origin}/${cleaned}`;
}

/**
 * ✅ Ако obj е null -> махаме <script id="...">, за да няма Vehicle без offers (invalid)
 */
function upsertJsonLd(id, obj) {
  const existing = document.getElementById(id);

  if (!obj) {
    if (existing) existing.remove();
    return;
  }

  let el = existing;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(obj);
}

function stripUndef(o) {
  if (!o || typeof o !== "object") return o;
  if (Array.isArray(o)) return o.map(stripUndef).filter((v) => v !== undefined);
  const out = {};
  Object.keys(o).forEach((k) => {
    const v = stripUndef(o[k]);
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  });
  return out;
}

function applyDetailSEO({
  id,
  make,
  model,
  year,
  km,
  fuel,
  gearbox,
  body,
  priceBGN,
  priceEUR,
  currency,
  firstPhoto,
  priceIsFinal,
}) {
  const cleanMake = (make || "").trim();
  const cleanModel = (model || "").trim();
  const cleanYear = year ? String(year).trim() : "";
  const carName = [cleanMake, cleanModel, cleanYear].filter(Boolean).join(" ");

  const canonical = location && location.href ? location.href.split("#")[0] : "";

  const title = carName ? `${carName} | Обява | Atlantic Drive` : `Обява автомобил | Atlantic Drive`;

  const kmTxt = km ? `${Number(km).toLocaleString("bg-BG")} км` : "";

  // В описанието показваме цената в EUR (основната), както е на страницата
  const priceTxt = priceEUR
    ? `${Math.round(Number(priceEUR)).toLocaleString("bg-BG")} €`
    : priceBGN
    ? `${Math.round(Number(priceBGN)).toLocaleString("bg-BG")} лв.`
    : "";

  const bits = [carName || "Автомобил", fuel || "", gearbox || "", body || "", kmTxt, priceTxt].filter(Boolean);

  const desc = `${bits.join(" · ")}. Снимки, характеристики и консултация за внос под ключ от Atlantic Drive.`;

  // Title / meta description
  document.title = title;
  setMetaById("pageTitle", title, "text");

  const md = document.getElementById("metaDescription");
  if (md) md.setAttribute("content", desc);

  // Canonical + OG url
  const cl = document.getElementById("canonicalLink");
  if (cl && canonical) cl.href = canonical;
  if (canonical) setMetaById("ogUrl", canonical);

  // OG/Twitter title/desc
  setMetaById("ogTitle", title);
  setMetaById("ogDesc", desc);
  setMetaById("twTitle", title);
  setMetaById("twDesc", desc);

  // Share preview остава винаги на бранда LogoNeon.
  const shareImg = absUrl(BRAND_SHARE_IMAGE);
  const schemaImg = absUrl(firstPhoto) || shareImg;
  if (shareImg) {
    const ogImageEl = document.querySelector('meta[property="og:image"]');
    if (ogImageEl) ogImageEl.setAttribute("content", shareImg);
    const twImgEl = document.querySelector('meta[name="twitter:image"]');
    if (twImgEl) twImgEl.setAttribute("content", shareImg);
  }

  // ===== JSON-LD Vehicle + Offer =====
  // ✅ ако няма реална числова цена -> НЕ публикуваме Vehicle schema (иначе става invalid)
  const offerPriceNum = toNumber(priceEUR);
  const offerPrice = offerPriceNum && offerPriceNum > 0 ? Math.round(offerPriceNum) : null;

  if (!offerPrice) {
    upsertJsonLd("vehicleJsonLd", null);
    return;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: carName || "Автомобил",
    url: canonical || undefined,
    image: schemaImg ? [schemaImg] : undefined,

    brand: cleanMake ? { "@type": "Brand", name: cleanMake } : undefined,
    model: cleanModel || undefined,
    vehicleModelDate: cleanYear || undefined,
    fuelType: fuel || undefined,
    vehicleTransmission: gearbox || undefined,
    bodyType: body || undefined,
    mileageFromOdometer: km
      ? {
          "@type": "QuantitativeValue",
          value: toNumber(km) ?? undefined,
          unitCode: "KMT",
        }
      : undefined,

    offers: {
      "@type": "Offer",
      url: canonical || undefined,
      price: String(offerPrice),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      seller: {
        "@type": "Organization",
        name: "Atlantic Drive",
        url: `${location.origin}/`,
      },
    },
  };

  upsertJsonLd("vehicleJsonLd", stripUndef(jsonLd));
}

/* ===== UI helpers ===== */
function updateViewsBox(box, totalEl, total) {
  if (!box) return;
  if (total == null) {
    box.style.display = "none";
    return;
  }
  box.style.display = "";
  if (totalEl) totalEl.textContent = Number(total).toLocaleString("bg-BG");
}

function formatPriceBGN(v) {
  const n = Math.round(Number(v) || 0);
  return n ? `${n.toLocaleString("bg-BG")} лв.` : "По запитване";
}
function formatPriceEUR(v) {
  const n = Math.round(Number(v) || 0);
  return `€${n.toLocaleString("bg-BG")}`;
}

// ✅ Двигател: само литри + см³ (без к.с.)
function formatEngine(cc) {
  const numCc = Number(cc);
  const parts = [];

  if (numCc) {
    const liters = numCc / 1000;
    parts.push(liters % 1 === 0 ? `${liters.toFixed(0)} L` : `${liters.toFixed(1)} L`);
    parts.push(`${numCc} см³`);
  }

  return parts.length ? parts.join(" · ") : "";
}

function formatDateBG(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("bg-BG", { day: "2-digit", month: "long", year: "numeric" });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Прави embed за видео:
 * - YouTube (watch / youtu.be)
 * - Google Drive
 * - директни mp4/webm/ogg
 * - fallback iframe за други линкове
 */
function buildVideoEmbed(rawUrl) {
  if (!rawUrl) return "";
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return "";
  }

  const host = u.hostname.replace(/^www\./i, "").toLowerCase();
  let src = "";

  // YouTube – стандартни линкове
  if (host === "youtu.be") {
    const id = u.pathname.replace("/", "");
    if (id) {
      src = `https://www.youtube.com/embed/${id}`;
    }
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    const id = u.searchParams.get("v");
    if (id) {
      src = `https://www.youtube.com/embed/${id}`;
    }
  }

  // Google Drive
  if (!src && host.endsWith("drive.google.com")) {
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (m && m[1]) {
      src = `https://drive.google.com/file/d/${m[1]}/preview`;
    }
  }

  // Ако е директен видео файл
  const pathLower = u.pathname.toLowerCase();
  const ext = pathLower.split(".").pop();
  if (!src && ["mp4", "webm", "ogg", "ogv"].includes(ext)) {
    const type = ext === "ogv" ? "ogg" : ext;
    const safeUrl = escapeHtmlAttr(rawUrl);
    return `
      <video class="detail-video__player" controls playsinline preload="metadata">
        <source src="${safeUrl}" type="video/${type}">
        Вашият браузър не поддържа HTML5 видео.
      </video>
    `.trim();
  }

  // Ако все още няма src – просто iframe към URL-а (Facebook, Vimeo и т.н.)
  if (!src) {
    src = rawUrl;
  }

  const safeSrc = escapeHtmlAttr(src);
  return `
    <iframe
      class="detail-video__player"
      src="${safeSrc}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="no-referrer-when-downgrade"
      allowfullscreen
    ></iframe>
  `.trim();
}
