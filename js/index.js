// Начална страница: филтри (Марка/Модел/Година) + обяви + UI + форма + оператор (контакти)
// Изпраща към catalog.html: makeId, modelId, yearFrom, yearTo
document.addEventListener("DOMContentLoaded", () => {
  // ===== селектори според HTML =====
  const form        = document.getElementById("searchForm");
  const makeSel     = document.getElementById("make");
  const modelSel    = document.getElementById("model");
  const yearFromSel = document.getElementById("yearFrom");
  const yearToSel   = document.getElementById("yearTo");
  const clearBtn    = document.getElementById("clearFilters");
  const cardsWrap   = document.getElementById("cards");
  const countEl     = document.getElementById("count");

  // махаме "Общо налични: X"
  if (countEl && countEl.parentElement) {
    countEl.parentElement.style.display = "none";
  }

  // NAV бутон "ОСТАВИ ЗАПИТВАНЕ"
  const topMailBtn = document.querySelector(".nav .cta");

  // FAB / drawer
  const fab       = document.getElementById("fabContact");
  const drawer    = document.getElementById("cbDrawer");
  const backdrop  = document.getElementById("cbBackdrop");
  const closeBtn  = document.getElementById("cbClose");
  const cancelBtn = document.getElementById("cbCancel");
  const cForm     = document.getElementById("cbForm");
  const toast     = document.getElementById("cbToast");

  // малък helper за тоста
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("is-on"));
    setTimeout(() => {
      toast.classList.remove("is-on");
      setTimeout(() => { toast.hidden = true; }, 260);
    }, 2400);
  }

  // nav / burger
  const nav = document.querySelector(".nav");
  const navToggle = document.querySelector(".nav-toggle");
  if (nav && navToggle) navToggle.addEventListener("click", () => nav.classList.toggle("is-open"));

  let contactsBox = null;

  // дали имаме реално API
  const hasApi = typeof window.AD_API === "object" && window.AD_API !== null;

  // офис → имейл (за формата "Остави запитване")
  const OFFICE_EMAILS = {
    "AtlanticDrive - София":          "sofia@atlanticdrive.bg",
    "AtlanticDrive - Пловдив":        "plovdiv@atlanticdrive.bg",
    "AtlanticDrive - Горубляне":      "sofia@atlanticdrive.bg",
  };
  const OFFICE_KEYS = Object.keys(OFFICE_EMAILS);

  // статични контакти за FAB "За запитване"
  const STATIC_CONTACTS = [
    { phone: "+359 878 119 140" },
  ];

  // демо коли (fallback)
  const DEMO_LISTINGS = [
    {
      id: 101,
      title: "BMW 530d xDrive",
      make_name: "BMW",
      model_name: "530d xDrive",
      year: 2019,
      mileage_km: 82000,
      fuel_name: "Дизел",
      price_amount: 28900,
      currency_code: "EUR",
      photo_url: "Images/BMW1.avif",
      contact_name: "Никола",
      contact_phone: "0888123456",
      contact_email: "nikola@example.com",
      price_is_final: false
    },
    {
      id: 102,
      title: "Mercedes C300 4Matic",
      make_name: "Mercedes",
      model_name: "C300",
      year: 2018,
      mileage_km: 74000,
      fuel_name: "Бензин",
      price_amount: 26400,
      currency_code: "EUR",
      photo_url: "Images/Mercedes1.webp",
      contact_name: "Иван",
      contact_phone: "0888777666",
      contact_email: "ivan@example.com",
      price_is_final: true
    },
    {
      id: 103,
      title: "Audi Q5 45 TFSI Quattro",
      make_name: "Audi",
      model_name: "Q5",
      year: 2020,
      mileage_km: 41000,
      fuel_name: "Бензин",
      price_amount: 29900,
      currency_code: "EUR",
      photo_url: "Images/Audi1.jpg",
      contact_name: "Петър",
      contact_phone: "",
      contact_email: "peter@example.com",
      price_is_final: false
    }
  ];

  // =====================================================================
  // helpers
  // =====================================================================
  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const safeParseJSON = (str) => {
    try { const v = JSON.parse(str); return Array.isArray(v) ? v : []; } catch { return []; }
  };

  const formatKm = (km) => {
    const n = Number(km);
    if (!n) return "";
    return n.toLocaleString("bg-BG") + " км";
  };

  // фиксиран курс EUR -> BGN
  const EUR_TO_BGN = 1.95583;

  const formatPrice = (val, curr) => {
    if (!val) return "по договаряне";
    const num = Number(val);
    const txt = num.toLocaleString("bg-BG", { maximumFractionDigits: 0 });
    if (!curr || String(curr).toUpperCase() === "EUR" || curr === "€") return "€" + txt;
    if (String(curr).toUpperCase() === "BGN" || curr === "лв") return txt + " лв.";
    return txt + " " + curr;
  };

  // (ново) показва левова стойност под EUR цената
  const formatPriceBgnFromEur = (val, curr) => {
    if (!val) return "";
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0) return "";

    const isEur = (!curr) || (String(curr).toUpperCase() === "EUR") || (curr === "€");
    if (!isEur) return "";

    const bgn = num * EUR_TO_BGN;
    if (!Number.isFinite(bgn) || bgn <= 0) return "";

    const txt = bgn.toLocaleString("bg-BG", { maximumFractionDigits: 0 });
    return txt + " лв.";
  };

  const normalizeYears = (fromEl, toEl) => {
    if (!fromEl || !toEl) return;
    const f = parseInt(fromEl.value || "0", 10);
    const t = parseInt(toEl.value || "0", 10);
    if (f && t && t < f) {
      const tmp = fromEl.value;
      fromEl.value = toEl.value;
      toEl.value = tmp;
    }
  };

  const numOrEmpty = (v) => {
    const n = parseInt(String(v || "").trim(), 10);
    return Number.isFinite(n) && n > 0 ? String(n) : "";
  };

  // =====================================================================
  // Инициализация от query (за синхрон с каталога и връщане назад)
  // =====================================================================
  async function initFromQuery() {
    const qs = new URLSearchParams(location.search);
    const makeId   = qs.get("makeId")   || "";
    const modelId  = qs.get("modelId")  || "";
    const yFrom    = qs.get("yearFrom") || "";
    const yTo      = qs.get("yearTo")   || "";

    await loadMakes();

    // марка/модел
    if (makeSel && makeId) {
      makeSel.value = makeId;
      await loadModelsForMake(makeId);
      if (modelSel && modelId) {
        const has = Array.from(modelSel.options).some(o => o.value === modelId);
        if (has) {
          modelSel.value = modelId;
          modelSel.disabled = false;
        }
      }
    } else if (modelSel) {
      // по подразбиране – "Модел"
      modelSel.innerHTML = `<option value="">Модел</option>`;
      modelSel.disabled = true;
    }

    if (yearFromSel && yFrom) yearFromSel.value = yFrom;
    if (yearToSel && yTo)     yearToSel.value   = yTo;
  }

  // =====================================================================
  // Марки
  // =====================================================================
  async function loadMakes() {
    if (!makeSel) return;
    try {
      if (hasApi && typeof window.AD_API.getMakes === "function") {
        const makes = await window.AD_API.getMakes();
        makeSel.innerHTML =
          `<option value="">Марка</option>` +
          makes.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
      } else {
        // fallback
        makeSel.innerHTML = `
          <option value="">Марка</option>
          <option value="1">BMW</option>
          <option value="2">Mercedes-Benz</option>
          <option value="3">Audi</option>
          <option value="4">Volkswagen</option>
        `;
      }
    } catch (err) {
      console.error("Грешка при зареждане на марки", err);
      makeSel.innerHTML = `<option value="">Марка</option>`;
    }
  }

  (async () => {
    await initFromQuery();
    if (!makeSel || makeSel.options.length === 0) await loadMakes();
  })();

  // =====================================================================
  // Модели при смяна на марка
  // =====================================================================
  async function loadModelsForMake(makeId) {
    if (!modelSel) return;
    modelSel.disabled = true;
    // по подразбиране – "Модел"
    modelSel.innerHTML = `<option value="">Модел</option>`;
    if (!makeId) return;

    try {
      if (hasApi && typeof window.AD_API.getModels === "function") {
        const models = await window.AD_API.getModels(makeId);
        modelSel.innerHTML =
          `<option value="">Модел</option>` +
          models.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
        modelSel.disabled = false;
      } else {
        // fallback
        const fallback = {
          "1": ["320d", "520d", "530d", "X3", "X5"],
          "2": ["C220d", "E220d", "GLC", "GLE"],
          "3": ["A4", "A6", "Q3", "Q5"],
          "4": ["Golf 7", "Passat B8", "Tiguan"]
        };
        const list = fallback[String(makeId)] || [];
        modelSel.innerHTML =
          `<option value="">Модел</option>` +
          list.map((m, i) => `<option value="${i + 1}">${escapeHtml(m)}</option>`).join("");
        modelSel.disabled = list.length === 0;
      }
    } catch (err) {
      console.error("Грешка при зареждане на модели", err);
    }
  }

  makeSel?.addEventListener("change", async () => {
    const makeId = makeSel.value;
    await loadModelsForMake(makeId);
  });

  // =========================
  // ORIGIN FLAGS (Home cards)
  // =========================
  const ORIGIN_FLAGS = {
    usa:    { src: "Images/USAFlag.webp",    alt: "САЩ" },
    canada: { src: "Images/canadaFlag.png",  alt: "Канада" },
    korea:  { src: "Images/Korea.png",       alt: "Южна Корея" },
    uae:    { src: "Images/UAE.webp",        alt: "ОАЕ" },
  };

  const ORIGIN_ID_MAP = { 1: "usa", 2: "canada", 3: "korea", 4: "uae" };

  function normalizeOrigin(val) {
    if (val == null) return "";

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

    if (/^\d+$/.test(raw)) return ORIGIN_ID_MAP[Number(raw)] || "";

    const s = raw.toLowerCase();

    if (
      s.includes("сащ") || s.includes("u.s") || s === "us" ||
      s.includes("usa") || s.includes("united states") || s.includes("america") || s.includes("америка")
    ) return "usa";

    if (s.includes("канада") || s === "ca" || s.includes("canada")) return "canada";

    if (s.includes("южна корея") || s.includes("south korea") || s.includes("korea") || s.includes("корея"))
      return "korea";

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

  function getFlagMetaHtml(row) {
    const raw = getListingOriginRaw(row);
    const key = normalizeOrigin(raw);
    const meta = key ? ORIGIN_FLAGS[key] : null;
    if (!meta) return "";
    return `<span class="meta-flag" title="${escapeHtml(meta.alt)}">
              <img src="${meta.src}" alt="${escapeHtml(meta.alt)}" loading="lazy">
            </span>`;
  }

  function getFlagImgHtml(row) {
    const raw = getListingOriginRaw(row);
    const key = normalizeOrigin(raw);
    const meta = key ? ORIGIN_FLAGS[key] : null;
    if (!meta) return "";
    return `<img src="${meta.src}" alt="${escapeHtml(meta.alt)}" class="title__flag" loading="lazy">`;
  }

  // =====================================================================
  // Обяви (home)
  // =====================================================================
  async function loadLatestListings() {
    if (!cardsWrap) return;
    try {
      if (hasApi && typeof window.AD_API.getPublicListings === "function") {
        // само 3 най-нови (вземаме до 9, показваме както си решил)
        const rows = await window.AD_API.getPublicListings({ skip: 0, take: 9 });
        renderListings(rows);
      } else {
        // fallback
        renderListings(DEMO_LISTINGS.slice(0, 3));
      }
    } catch (err) {
      console.error("Грешка при зареждане на обяви", err);
      renderListings(DEMO_LISTINGS.slice(0, 3));
    }
  }

  function renderListings(list) {
    if (!cardsWrap) return;
    cardsWrap.innerHTML = "";

    if (!list || !list.length) {
      cardsWrap.innerHTML = `<p class="muted">Няма обяви за момента.</p>`;
      if (countEl) countEl.textContent = "0";
      return;
    }

    const frag = document.createDocumentFragment();

    list.forEach((row, idx) => {
      const photosJson   = row.photos_json ? safeParseJSON(row.photos_json) : null;
      const photoFromApi = photosJson && photosJson.length
        ? (photosJson.find(p => p.is_cover) || photosJson[0]).url
        : null;

      const firstPhotoUrl =
        photoFromApi ||
        row.cover_photo_url ||
        row.coverPhotoUrl ||
        row.photo_url ||
        row.cover_url ||
        row.main_photo ||
        row.image_url ||
        "Images/placeholder-car.png";

      const makeName  = row.make_name  || row.make  || "";
      const modelName = row.model_name || row.model || "";
      const fuelName  = row.fuel_name  || row.fuel_type || "";

      const title = row.title ||
        `${makeName || ""} ${modelName || ""}`.trim() ||
        "Автомобил";

      const price     = formatPrice(row.price_amount, row.currency_code);
      const priceBgn  = formatPriceBgnFromEur(row.price_amount, row.currency_code);
      const mileage   = row.mileage_km || row.km || "";
      const listingId = row.listing_id || row.id;
      const detailUrl = `detail.html${listingId ? `?id=${listingId}` : ""}`;

      // ✅ флаг ВИНАГИ след заглавието (и мобилен, и десктоп)
      const titleFlagHtml = getFlagImgHtml(row);

      // ✅ крайна/прогнозна цена
      const priceIsFinal =
        (typeof row.price_is_final !== "undefined") ? row.price_is_final :
        (typeof row.priceIsFinal !== "undefined") ? row.priceIsFinal :
        null;

      const priceTypeText =
        priceIsFinal === true ? "Крайна цена" :
        priceIsFinal === false ? "Прогнозна цена" :
        "";

      const priceTypeClass =
        priceIsFinal === true ? "price-type price-type--final" :
        priceIsFinal === false ? "price-type price-type--estimate" :
        "price-type";

      // features за баджа (показваме МАКС 2)
      const featuresArr = row.features_json
        ? safeParseJSON(row.features_json)
            .map(f => f?.name || f?.feature_name || f?.label || "")
            .filter(Boolean)
        : [];

      const featuresText = featuresArr.length ? featuresArr.slice(0, 2).join(" • ") : "";
      const badgeText = featuresText || (mileage ? formatKm(mileage) : "");

      // ---- телефон / имейл за консултация ----
      const rawPhone = (row.contact_phone || row.contactPhone || "").toString().trim();
      const cleanPhone = rawPhone.replace(/[^\d+]/g, "");
      const hasPhone   = cleanPhone.length >= 6;

      const contactEmail =
        (row.contact_email || row.contactEmail || "office@atlanticdrive.bg").toString().trim() || "office@atlanticdrive.bg";

      const mailSubject = encodeURIComponent(`Интерес към обява ${listingId || ""}`);
      const consultHref = hasPhone ? `tel:${cleanPhone}` : `mailto:${contactEmail}?subject=${mailSubject}`;

      const card = document.createElement("article");
      card.className = "card";
      card.setAttribute("data-card", "");
      if (listingId) card.setAttribute("data-details-url", detailUrl);

      card.innerHTML = `
        <div class="card__media" data-role="media">
          <img src="${firstPhotoUrl}" alt="${escapeHtml(title)}" loading="lazy">
          ${badgeText ? `<span class="badge">${escapeHtml(badgeText)}</span>` : ""}
        </div>

        <div class="card__body">
          <h3 class="title">
            <span class="title__text">${escapeHtml(title)}</span>
            ${titleFlagHtml}
          </h3>

          ${priceTypeText ? `
            <div class="${priceTypeClass}">
              <span class="price-type__dot" aria-hidden="true"></span>
              <span class="price-type__txt">${escapeHtml(priceTypeText)}</span>
            </div>
          ` : ""}

          <div class="meta">
            ${makeName ? `<span>${escapeHtml(makeName)}</span>` : ""}
            ${modelName ? `<span>${escapeHtml(modelName)}</span>` : ""}
            ${fuelName ? `<span>${escapeHtml(fuelName)}</span>` : ""}
          </div>

          <div class="row">
            <div class="price">
              ${price}
              ${priceBgn ? `<div class="price__bgn" style="opacity:.65;font-size:.85em;line-height:1.1;margin-top:2px;">${priceBgn}</div>` : ""}
            </div>
            <div class="actions">
              <a class="btn ghost btn-consult" href="${consultHref}">Консултация</a>
              <a class="btn btn-details" href="${detailUrl}" data-details-url="${detailUrl}">Детайли</a>
            </div>
          </div>
        </div>
      `;

      card.addEventListener("click", (e) => {
        if (e.target.closest(".btn-details")) return;
        if (e.target.closest(".btn.ghost")) return;
        if (e.target.closest(".card__media")) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
      });

      setTimeout(() => card.classList.add("visible"), 40 * (idx % 6));
      frag.appendChild(card);
    });

    cardsWrap.appendChild(frag);
    if (countEl) countEl.textContent = String(list.length);
  }

  // пускаме началните обяви
  loadLatestListings();

  // =====================================================================
  // SUBMIT -> catalog.html (само makeId, modelId, yearFrom, yearTo)
  // =====================================================================
  if (form) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();

      normalizeYears(yearFromSel, yearToSel);

      const makeId  = (makeSel?.value || "").trim();
      const modelId = makeId && modelSel && !modelSel.disabled ? (modelSel.value || "").trim() : "";

      const yf = numOrEmpty(yearFromSel?.value);
      const yt = numOrEmpty(yearToSel?.value);

      const qs = new URLSearchParams();
      if (makeId)  qs.set("makeId", makeId);
      if (modelId) qs.set("modelId", modelId);
      if (yf) qs.set("yearFrom", yf);
      if (yt) qs.set("yearTo", yt);

      const url = "catalog.html" + (qs.toString() ? "?" + qs.toString() : "");
      window.location.href = url;
    });
  }

  // =====================================================================
  // CLEAR
  // =====================================================================
  clearBtn?.addEventListener("click", () => {
    if (makeSel) makeSel.value = "";
    if (modelSel) {
      modelSel.innerHTML = `<option value="">Модел</option>`;
      modelSel.disabled = true;
    }
    if (yearFromSel) yearFromSel.value = "";
    if (yearToSel)   yearToSel.value   = "";

    // чистим URL параметрите на началната
    history.replaceState(null, "", location.pathname);

    loadLatestListings();
  });

  // =====================================================================
  // UI ефекти
  // =====================================================================

  // footer year
  (() => {
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  })();

  // steps reveal
  (() => {
    const items = Array.from(document.querySelectorAll(".steps__item"));
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(el => el.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const idx = items.indexOf(entry.target);
        entry.target.style.transitionDelay = `${Math.min(idx * 80, 400)}ms`;
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.25 });

    items.forEach(el => io.observe(el));
  })();

  // hero video
  (() => {
    const video = document.getElementById("heroVideo");
    const fallback = document.querySelector(".hero-fallback");
    if (!video) return;

    const showFallback = () => {
      video.style.display = "none";
      if (fallback) fallback.style.display = "block";
    };

    const tryPlay = () => {
      const p = video.play?.();
      if (p && typeof p.then === "function") p.catch(() => showFallback());
    };

    video.addEventListener("error", showFallback);
    video.addEventListener("stalled", () => { setTimeout(showFallback, 1200); });

    if ("IntersectionObserver" in window) {
      const ob = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) { tryPlay(); ob.disconnect(); }
        });
      }, { threshold: 0.2 });
      ob.observe(video);
    } else {
      tryPlay();
    }

    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq && mq.matches) showFallback();
  })();

  // about counter
  (() => {
    const sec = document.querySelector(".about--minimal");
    if (!sec || !("IntersectionObserver" in window)) return;

    const num = sec.querySelector(".about-min__num.count");
    if (!num) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;

        const to = parseInt(num.getAttribute("data-to") || "0", 10);
        const suffix = num.getAttribute("data-suffix") || "";
        const dur = 1100;
        let start = null;
        const ease = t => 1 - Math.pow(1 - t, 3);

        const step = ts => {
          if (!start) start = ts;
          const p = Math.min(1, (ts - start) / dur);
          num.textContent = Math.round(ease(p) * to) + suffix;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);

        io.disconnect();
      });
    }, { threshold: 0.25 });

    io.observe(sec);
  })();

  // FAQ (само един отворен)
  (() => {
    const items = Array.from(document.querySelectorAll(".faq__item"));
    if (!items.length) return;

    items.forEach(d => {
      d.addEventListener("toggle", () => {
        if (d.open) items.forEach(x => (x !== d) && (x.open = false));
      });
    });

    const hash = location.hash.replace("#", "");
    if (hash) {
      const target = document.getElementById(hash);
      if (target && target.classList.contains("faq__item")) {
        target.open = true;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  })();

  // =====================================================================
  // Drawer: форма + контакти + избор на офис
  // =====================================================================
  (() => {
    if (!drawer || !backdrop) return;

    // контейнер за "Бърза връзка" – вътре ще има само бутон "Обади се"
    contactsBox = document.createElement("div");
    contactsBox.id = "cbContacts";
    contactsBox.className = "cb-contacts cb-contacts--call-only";
    contactsBox.style.display = "none";
    drawer.appendChild(contactsBox);

    if (cForm) cForm.style.display = "block";

    const openDrawer = () => {
      if (fab) {
        fab.classList.add("is-hidden");
        fab.setAttribute("aria-hidden", "true");
      }
      backdrop.hidden = false;
      drawer.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        backdrop.classList.add("is-on");
        drawer.classList.add("is-on");
      });
    };

    const closeDrawer = () => {
      backdrop.classList.remove("is-on");
      drawer.classList.remove("is-on");
      drawer.setAttribute("aria-hidden", "true");
      setTimeout(() => { backdrop.hidden = true; }, 260);
      if (fab) {
        setTimeout(() => {
          fab.classList.remove("is-hidden");
          fab.removeAttribute("aria-hidden");
        }, 260);
      }
    };

    // NAV бутона → форма
    if (topMailBtn) {
      topMailBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (cForm) cForm.style.display = "block";
        if (contactsBox) contactsBox.style.display = "none";
        openDrawer();
        const name = document.getElementById("cbName");
        setTimeout(() => name?.focus(), 120);
      });
    }

    // FAB → статични контакти (само бутон "Обади се")
    if (fab) {
      fab.addEventListener("click", async () => {
        if (cForm) cForm.style.display = "none";
        if (contactsBox) contactsBox.style.display = "block";
        fab.classList.add("is-hidden");
        fab.setAttribute("aria-hidden", "true");
        const contacts = await loadContacts();
        renderContacts(contacts);
        openDrawer();
      });
    }

    // backdrop / X / cancel
    backdrop.addEventListener("click", closeDrawer);
    closeBtn?.addEventListener("click", closeDrawer);
    cancelBtn?.addEventListener("click", closeDrawer);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !backdrop.hidden) closeDrawer();
    });

    // submit на формата (остави запитване) -> /api/public/clients
    if (cForm) {
      function setFieldState(el, msg) {
        const wrap = el.closest(".cb-field") || el.parentElement;
        const err = wrap?.querySelector(".cb-err");
        const hasErr = !!msg;

        if (err) err.textContent = msg || "";
        el.setAttribute("aria-invalid", hasErr ? "true" : "false");

        if (wrap) {
          wrap.classList.toggle("has-error", hasErr);
          wrap.classList.toggle("has-ok", !hasErr && el.value.trim().length > 0);

          if (hasErr) {
            wrap.classList.remove("shake");
            void wrap.offsetWidth;
            wrap.classList.add("shake");
          }
        }
      }

      const onlyDigitsPlus = (s) => String(s || "").replace(/[^\d+]/g, "");
      const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

      function validateName(value) {
        const v = String(value || "").trim().replace(/\s+/g, " ");
        if (!v) return "Моля, попълни име и фамилия";

        const parts = v.split(" ").filter(Boolean);
        if (parts.length < 2) return "Добави фамилия (пример: Иван Иванов)";
        if (parts.some(p => p.length < 2)) return "Името е прекалено кратко";

        if (!/^[A-Za-zА-Яа-яЁёІіЇїЄєЪъЬь'\-.\s]+$/.test(v)) {
          return "Използвай само букви (и тире/апостроф при нужда)";
        }
        return "";
      }

      function validatePhone(value) {
        const raw = String(value || "").trim();
        if (!raw) return "Моля, попълни телефон";

        const cleaned = onlyDigitsPlus(raw);
        const digits = onlyDigits(cleaned);

        if (digits.length < 9) return "Телефонът е прекалено кратък";
        if (digits.length > 13) return "Телефонът е прекалено дълъг";

        const allSame = /^(\d)\1+$/.test(digits);
        if (allSame) return "Телефонът изглежда невалиден";

        if (digits.length === 10 && !digits.startsWith("0")) {
          return "За BG номер започни с 0 (пример: 088...)";
        }

        if (cleaned.startsWith("+359")) {
          if (!/^\+359\d{8,9}$/.test(cleaned)) return "Невалиден формат +359";
        }

        if (digits.startsWith("08") && !/^08\d{8}$/.test(digits)) {
          return "Невалиден BG мобилен номер";
        }

        return "";
      }

      function validateEmail(value) {
        const v = String(value || "").trim();
        if (!v) return "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Невалиден имейл";
        return "";
      }

      function validateYear(value) {
        const v = String(value || "").trim();
        if (!v) return "";
        const n = Number(v);
        const current = new Date().getFullYear();
        if (!Number.isInteger(n)) return "Годината трябва да е число";
        if (n < 1950 || n > current + 1) return `Годината трябва да е между 1950 и ${current + 1}`;
        return "";
      }

      function validateBudget(value) {
        const raw = String(value || "").trim();
        if (!raw) return "";
        const cleaned = raw.replace(/\s+/g, "").replace(",", ".");
        const n = Number(cleaned);
        if (!Number.isFinite(n)) return "Бюджетът трябва да е число";
        if (n <= 0) return "Бюджетът трябва да е положителен";
        return "";
      }

      const validators = {
        cbName:   validateName,
        cbPhone:  validatePhone,
        cbEmail:  validateEmail,
        cbYear:   validateYear,
        cbBudget: validateBudget,
      };

      function validateOne(el) {
        const vfn = validators[el.id];
        if (!vfn) return true;
        const msg = vfn(el.value);
        setFieldState(el, msg);
        return !msg;
      }

      function validateAll() {
        let ok = true;
        Object.keys(validators).forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          if (!validateOne(el)) ok = false;
        });
        return ok;
      }

      ["blur", "change"].forEach((evName) => {
        cForm.addEventListener(evName, (e) => {
          const el = e.target;
          if (!(el instanceof HTMLElement)) return;
          if (!validators[el.id]) return;
          validateOne(el);
        }, true);
      });

      // ==========================================================
      // ✅ АНТИ-СПАМ SUBMIT + LOADING (само JS, без HTML/CSS файлове)
      // ==========================================================
      let isSubmitting = false;
      let submitEl = null;        // button[type=submit] или input[type=submit]
      let inputSpinner = null;    // ако submit е INPUT, слагаме отделен spinner

      function ensureSubmitEl() {
        if (submitEl) return submitEl;

        submitEl =
          cForm.querySelector('button[type="submit"]') ||
          cForm.querySelector('input[type="submit"]');

        if (!submitEl) return null;

        // inject CSS само веднъж
        if (!document.getElementById("cbSubmitLoaderStyle")) {
          const st = document.createElement("style");
          st.id = "cbSubmitLoaderStyle";
          st.textContent = `
            /* submit loading - injected by JS */
            #cbForm button[type="submit"].is-loading,
            #cbForm input[type="submit"].is-loading {
              pointer-events: none !important;
            }
            #cbForm button[type="submit"].is-loading::after{
              content:"";
              display:inline-block;
              width:16px;height:16px;
              border:2px solid currentColor;
              border-right-color:transparent;
              border-radius:50%;
              margin-left:10px;
              vertical-align:-3px;
              animation: cbSpin .75s linear infinite;
            }
            #cbForm .cb-submit-spinner{
              display:inline-block;
              width:16px;height:16px;
              border:2px solid currentColor;
              border-right-color:transparent;
              border-radius:50%;
              margin-left:10px;
              vertical-align:-3px;
              animation: cbSpin .75s linear infinite;
            }
            @keyframes cbSpin { to { transform: rotate(360deg); } }
          `;
          document.head.appendChild(st);
        }

        // ако submit е INPUT, няма ::after -> добавяме отделен <span>
        if (submitEl.tagName === "INPUT") {
          inputSpinner = document.createElement("span");
          inputSpinner.className = "cb-submit-spinner";
          inputSpinner.hidden = true;
          inputSpinner.setAttribute("aria-hidden", "true");
          submitEl.insertAdjacentElement("afterend", inputSpinner);
        }

        return submitEl;
      }

      function setSubmitting(on) {
        const btn = ensureSubmitEl();

        if (on) {
          isSubmitting = true;
          cForm.setAttribute("aria-busy", "true");

          if (btn) {
            btn.disabled = true;
            btn.classList.add("is-loading");
            btn.setAttribute("aria-disabled", "true");
          }
          if (inputSpinner) inputSpinner.hidden = false;
        } else {
          isSubmitting = false;
          cForm.removeAttribute("aria-busy");

          if (btn) {
            btn.disabled = false;
            btn.classList.remove("is-loading");
            btn.removeAttribute("aria-disabled");
          }
          if (inputSpinner) inputSpinner.hidden = true;
        }
      }

      function unlockWithDelay(ms = 0) {
        setTimeout(() => setSubmitting(false), Math.max(0, ms));
      }

      // ==========================================================

      cForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // ако вече пращаме -> режем
        if (isSubmitting) return;

        // валидирай
        if (!validateAll()) return;

        // заключи + покажи loading
        setSubmitting(true);

        const name        = document.getElementById("cbName");
        const phone       = document.getElementById("cbPhone");
        const emailInput  = document.getElementById("cbEmail");
        const brand       = document.getElementById("cbBrand");
        const model       = document.getElementById("cbModel");
        const yearInput   = document.getElementById("cbYear");
        const budgetInput = document.getElementById("cbBudget");
        const desc        = document.getElementById("cbDesc");

        const nameVal   = name.value.trim().replace(/\s+/g, " ");
        const phoneVal  = phone.value.trim();
        const emailVal  = (emailInput?.value || "").trim();
        const brandVal  = (brand?.value || "").trim();
        const modelVal  = (model?.value || "").trim();
        const descVal   = (desc?.value || "").trim();

        const yearRaw   = (yearInput?.value || "").trim();
        const budgetRaw = (budgetInput?.value || "").replace(/\s+/g, "");

        const yearNum   = yearRaw ? Number(yearRaw) : null;
        const budgetNum = budgetRaw ? Number(budgetRaw) : null;

        const yearLine = yearNum ? String(yearNum) : "-";
        const budgetLine = budgetNum
          ? budgetNum.toLocaleString("bg-BG")
          : "-";

        const message =
`Име и фамилия: ${nameVal}
Телефон: ${phoneVal}
Имейл: ${emailVal || "-"}
Марка: ${brandVal || "-"}
Модел: ${modelVal || "-"}
Година от: ${yearLine}
Бюджет: ${budgetLine}

Кратко описание:
${descVal || "-"}`;

        try {
          if (hasApi && typeof window.AD_API.apiPost === "function") {
            await window.AD_API.apiPost("/api/public/clients", {
              Name: nameVal,
              Phone: phoneVal,
              Email: emailVal || null,
              DesiredMakeName: brandVal || null,
              DesiredModelName: modelVal || null,
              DesiredYear: yearNum,
              BudgetMaxAmount: budgetNum,
              InitialNote: message
            });

            cForm.reset();

            Object.keys(validators).forEach((id) => {
              const el = document.getElementById(id);
              if (!el) return;
              setFieldState(el, "");
            });

            closeDrawer();
            showToast("Заявката е изпратена. Благодарим!");
          } else {
            // fallback mailto
            const toEmail = "office@atlanticdrive.bg";
            const subject = encodeURIComponent(`Запитване — Atlantic Drive`);
            const body = encodeURIComponent(message);
            window.location.href = `mailto:${toEmail}?subject=${subject}&body=${body}`;

            // при mailto няма реален async "край", държим заключено малко,
            // за да не се натиска 10 пъти
            unlockWithDelay(2200);
            return;
          }

          // нормално отключване (малък delay да няма мигане)
          unlockWithDelay(250);
        } catch (err) {
          console.error("Грешка при създаване на клиент:", err);
          showToast("Възникна грешка. Опитайте отново или звъннете по телефона.");
          unlockWithDelay(150);
        }
      });
    }

    // ----- контакти ----- (статични)
    let CONTACTS_CACHE = null;

    async function loadContacts() {
      if (CONTACTS_CACHE) return CONTACTS_CACHE;
      CONTACTS_CACHE = STATIC_CONTACTS;
      return CONTACTS_CACHE;
    }

    // само един голям бутон "ОБАДИ СЕ"
    function renderContacts(list) {
      if (!contactsBox) return;
      contactsBox.innerHTML = "";

      const first = list && list.length ? list[0] : {};
      const rawPhone = (first.phone || "").toString().trim();
      const phone = rawPhone.replace(/[^\d+]/g, "") || "0888123456";

      const wrap = document.createElement("div");
      wrap.className = "cb-call-only";

      const btn = document.createElement("a");
      btn.className = "btn btn-call-full";
      btn.href = "tel:" + phone;
      btn.textContent = "Обади се";

      wrap.appendChild(btn);
      contactsBox.appendChild(wrap);
    }
  })();

  // =====================================================================
  // Клик по цялото поле на филтъра (мобилни)
  // =====================================================================
  (() => {
    const clickFields = document.querySelectorAll(".field--click");
    if (!clickFields.length) return;

    clickFields.forEach(f => {
      const ctrl = f.querySelector("select, input");
      if (!ctrl) return;

      f.addEventListener("click", (e) => {
        if (e.target === ctrl) return;
        ctrl.focus();
        if (ctrl.tagName === "SELECT") {
          const evt = new MouseEvent("mousedown", { bubbles: true });
          ctrl.dispatchEvent(evt);
        }
      });
    });
  })();

  // MOBILE CARDS CAROUSEL – фокус върху централната карта
  (function () {
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    if (!isMobile) return;

    const cardsContainer = document.querySelector('.cards-grid');
    if (!cardsContainer) return;

    const observer = new MutationObserver(() => {
      const cards = cardsContainer.querySelectorAll('.card');
      if (cards.length === 0) return;

      observer.disconnect();
      initCarousel(cardsContainer);
    });

    observer.observe(cardsContainer, { childList: true });

    function initCarousel(container) {
      const cards = Array.from(container.querySelectorAll('.card'));
      if (!cards.length) return;

      cards[0].classList.add('is-active');

      let scrollTimeout;

      function updateActiveCard() {
        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;

        let best = null;
        let bestDist = Infinity;

        cards.forEach(card => {
          const cRect = card.getBoundingClientRect();
          const cardCenter = cRect.left + cRect.width / 2;
          const dist = Math.abs(cardCenter - centerX);

          if (dist < bestDist) {
            bestDist = dist;
            best = card;
          }
        });

        if (!best) return;

        cards.forEach(c => c.classList.remove('is-active'));
        best.classList.add('is-active');

        const targetCenter = best.offsetLeft + best.offsetWidth / 2;
        const scrollLeft = targetCenter - container.clientWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }

      function onScroll() {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(updateActiveCard, 90);
      }

      container.addEventListener('scroll', onScroll, { passive: true });
    }
  })();

});

document.addEventListener('DOMContentLoaded', () => {
  if (!('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  function setupReveal(selector, extraClasses = []) {
    document.querySelectorAll(selector).forEach((el, idx) => {
      el.classList.add('reveal', ...extraClasses);
      el.style.transitionDelay = (idx * 60) + 'ms';
      io.observe(el);
    });
  }

  // заглавие и „Нови обяви“
  setupReveal('.inventory .section-head', ['reveal--right']);

  // картите
  setupReveal('.cards-grid .card', ['reveal--scale']);

  // band под картите
  setupReveal('.band');

  // ABOUT блок
  setupReveal('.about-min__wrap > *');
  setupReveal('.benefit-card');

  // FAQ
  setupReveal('.faq__item');
});

document.addEventListener("DOMContentLoaded", () => {
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  const links = Array.from(document.querySelectorAll(".menu a"));

  links.forEach(a => a.classList.remove("is-active"));

  const active = links.find(a => {
    const href = (a.getAttribute("href") || "").toLowerCase();

    if (href.startsWith("#")) return false;

    const clean = href.split("#")[0].split("?")[0];
    return clean === path;
  });

  if (active) active.classList.add("is-active");
});
