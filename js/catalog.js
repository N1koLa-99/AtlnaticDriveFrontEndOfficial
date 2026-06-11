// js/catalog.js
// Каталог: филтри, сортиране, зареждане, чипове (мобилен UX)
// + PRICE STACK (EUR main + BGN faded) + PRICE TYPE badge (final/estimate)
// + mini search inputs over Brand/Model facets (auto-inject if missing)
//
// ✅ OPTIMIZED (less server load):
// - NO API calls on every keypress for range inputs
// - request dedupe (same filters => no new call)
// - longer debounce for apply
// - color input doesn't spam API while typing
// - debounced MutationObserver in quick search

document.addEventListener("DOMContentLoaded", () => {
  // ====== Contact UI интеграция (унифицирано "Остави запитване") ======
  try {
    if (window.AD_ContactUI && typeof window.AD_ContactUI.init === "function") {
      window.AD_ContactUI.init({
        topMailBtn: ".nav .cta",
        fabBtn: ".fab-contact",
        offices: {
          "AtlanticDrive - София": "sofia@atlanticdrive.bg",
          "AtlanticDrive - Пловдив": "plovdiv@atlanticdrive.bg",
          "AtlanticDrive - Горубляне": "sofia@atlanticdrive.bg",
        },
      });
    }
  } catch (e) {
    console.warn("Contact UI init skipped:", e);
  }
  // ------- DOM -------
  const cardsWrap = document.getElementById("cards");
  const resultCountEl = document.getElementById("resultCount");
  const chipsActive = document.getElementById("activeChips");
  const emptyState = document.getElementById("emptyState");
  const btnLoadMore = document.getElementById("btnLoadMore");
  const btnApply = document.getElementById("btnApply");
  const btnClear = document.getElementById("btnClear");
  const sortSel = document.getElementById("sortSelect");
  const modelSearch = document.getElementById("modelSearch");
  const brandSearch = document.getElementById("brandSearch"); // търсачка за марки
  const viewGrid = document.getElementById("viewGrid");
  const viewList = document.getElementById("viewList");

  const facetBrand = document.getElementById("facetBrand");
  const facetModel = document.getElementById("facetModel");
  const fuelUl = document.getElementById("facetFuel");
  const gearboxUl = document.getElementById("facetGearbox");
  const facetFeatures = document.getElementById("facetFeatures");

  const yearFromEl = document.getElementById("yearFrom");
  const yearToEl = document.getElementById("yearTo");
  const kmMinEl = document.getElementById("kmMin");
  const kmMaxEl = document.getElementById("kmMax");

  // новите филтри
  const bodyTypeSel = document.getElementById("bodyTypeId");
  const colorInput = document.getElementById("color");
  const engineFromEl = document.getElementById("engineFromCc");
  const engineToEl = document.getElementById("engineToCc");
  const powerFromEl = document.getElementById("powerFromHp");
  const powerToEl = document.getElementById("powerToHp");
  const originSel = document.getElementById("origin");

  // маркираме кои UL са single-select за мобилните чипове
  if (facetBrand) facetBrand.dataset.single = "1"; // Марка – single
  if (facetModel) facetModel.dataset.single = "1"; // Модел – също single

  // ====== <details> фасети (за отваряне/затваряне) ======
  const findFacetByTitle = (title) => {
    return Array.from(document.querySelectorAll(".facets .facet")).find((d) => {
      const s = d.querySelector(":scope > summary");
      return s && s.textContent.trim().toLowerCase() === title.toLowerCase();
    });
  };
  const dBrand = findFacetByTitle("марка");
  const dModel = findFacetByTitle("модел");
  const dYear = findFacetByTitle("година");

  // Sheets (мобилен)
  const sheetBrandList = document.getElementById("sheetBrandList");
  const sheetModelList = document.getElementById("sheetModelList");
  const confirmYearBtn = document.getElementById("confirmYear");
  const confirmKmBtn = document.getElementById("confirmKm");
  const yearFromProxy = document.getElementById("yearFrom_proxy");
  const yearToProxy = document.getElementById("yearTo_proxy");
  const kmMinProxy = document.getElementById("kmMin_proxy");
  const kmMaxProxy = document.getElementById("kmMax_proxy");
  const sheetFeaturesList = document.getElementById("sheetFeaturesList");

  const bodyTypeProxy = document.getElementById("bodyTypeId_proxy");
  const originProxy = document.getElementById("origin_proxy");
  const engineFromProxy = document.getElementById("engineFrom_proxy");
  const engineToProxy = document.getElementById("engineTo_proxy");
  const powerFromProxy = document.getElementById("powerFrom_proxy");
  const powerToProxy = document.getElementById("powerTo_proxy");

  const confirmBodyBtn = document.getElementById("confirmBody");
  const confirmEngineBtn = document.getElementById("confirmEngine");
  const confirmPowerBtn = document.getElementById("confirmPower");
  const confirmOriginBtn = document.getElementById("confirmOrigin");

  const hasApi = typeof window.AD_API === "object" && window.AD_API !== null;
  const PAGE_SIZE = 12;

  // ------- Lookups mapping -------
  const maps = {
    fuelByName: new Map(), // "дизел" -> 2
    gearboxByName: new Map(), // "автоматик" -> 2
    fuelIdToName: new Map(), // "2" -> "Дизел"
    gearboxIdToName: new Map(), // "3" -> "Автоматик"
  };

  // ID-та от URL, които ще чекнем след като имаме lookups/рендер
  let initialFuelIds = [];
  let initialGearboxIds = [];

  // ------- State -------
  const state = {
    skip: 0,
    take: PAGE_SIZE,
    items: [],
    reqToken: 0, // ✅ защита от стари заявки
    filters: {
      makeId: "",
      modelId: "", // single (за API)
      modelIds: [], // ще е 0 или 1, защото моделите са single
      modelNames: [],
      yearFrom: "",
      yearTo: "",
      kmMin: "",
      kmMax: "",
      priceFrom: "",
      priceTo: "",
      fuelIds: [],
      gearboxIds: [],
      fuelNames: [],
      gearboxNames: [],

      bodyTypeId: "",
      color: "",
      engineFromCc: "",
      engineToCc: "",
      powerFromHp: "",
      powerToHp: "",
      origin: "",

      featureIds: [],
      featureNames: [],
    },
    sort: "new",
    view: "grid",
    currentModelBrandId: "",
  };


  const mqMobile = window.matchMedia("(max-width: 980.98px), (hover: none) and (pointer: coarse)");
let isMobile = mqMobile.matches;

function refreshResponsive() {
  const next = mqMobile.matches;
  const changed = next !== isMobile;
  isMobile = next;

  if (isMobile) {
    state.view = "grid";
    if (cardsWrap) cardsWrap.dataset.view = "grid";
    if (viewGrid) { viewGrid.checked = true; viewGrid.disabled = true; }
    if (viewList) { viewList.checked = false; viewList.disabled = true; }
    hideViewToggleOnMobile();
  } else {
    if (viewGrid) viewGrid.disabled = false;
    if (viewList) viewList.disabled = false;
  }

  // ако искаш при ротация да се оправя рендера:
  if (changed && state.items?.length) rerenderForView();
}

// initial: само веднъж, преди init()
refreshResponsive();

mqMobile.addEventListener?.("change", refreshResponsive);
window.addEventListener("pageshow", (e) => {
  if (e.persisted) refreshResponsive();
});

  // ===== Load shedding / request dedupe =====
  const APPLY_DEBOUNCE_MS = 350; // беше 120
  const TYPING_APPLY_DEBOUNCE_MS = 850; // за live typing (по-рядко)
  const MIN_COLOR_CHARS = 3; // цвят: не apply ако < 3

  let lastReqKey = ""; // стабилен ключ на последната заявка (за dedupe)

  function buildReqKey() {
    // правим стабилен key от реалната API заявка (skip=0, take=PAGE_SIZE)
    // сортираме масиви да не зависи от реда на кликовете
    const req = mapFiltersToApi(state.filters, state.sort, 0, PAGE_SIZE);
    const stable = JSON.parse(JSON.stringify(req));
    ["fuel", "gearbox", "features"].forEach((k) => {
      if (Array.isArray(stable[k])) stable[k] = stable[k].slice().sort((a, b) => a - b);
    });
    return JSON.stringify(stable);
  }

  function shouldApplyNow(el) {
    if (!el) return true;
    const id = el.id || "";
    const v = (el.value || "").trim();

    // година: чакаме 4 цифри или празно
    if (id === "yearFrom" || id === "yearTo") return v === "" || /^\d{4}$/.test(v);

    // числови диапазони: чакаме поне 2 цифри или празно
    if (
      ["kmMin", "kmMax", "engineFromCc", "engineToCc", "powerFromHp", "powerToHp"].includes(id)
    ) {
      return v === "" || /^\d{2,}$/.test(v);
    }

    // цвят: чакаме 3+ символа или празно
    if (id === "color") return v === "" || v.length >= MIN_COLOR_CHARS;

    return true;
  }

  function uiOnlyUpdate() {
    updateChipBarLabels();
    reconcileFacets(false);
  }

  function runApply(fromInit = false) {
    collectFacetFilters();

    const key = buildReqKey();
    // ✅ dedupe: ако е 100% същата заявка (и не е init), не пращаме нов call
    if (!fromInit && key === lastReqKey) {
      syncSheetMirrors();
      reconcileFacets(false);
      return;
    }
    lastReqKey = key;

    applyFilters(fromInit);
    syncSheetMirrors();
    reconcileFacets(false);
  }

  // ✅ AUTO APPLY (по-рядко) + dedupe
  const autoApply = debounce(() => runApply(false), APPLY_DEBOUNCE_MS);

  // ✅ typing apply (само ако input-ът е "валиден" за apply)
  const autoApplyTyping = debounce((srcEl) => {
    if (!shouldApplyNow(srcEl)) return;
    runApply(false);
  }, TYPING_APPLY_DEBOUNCE_MS);

  // ===== Facets open/close логика =====
  const hasChecked = (ul) => !!(ul && ul.querySelector('input[type="checkbox"]:checked'));
  const hasYear = () => {
    const yf = ((yearFromEl && yearFromEl.value) || "").trim();
    const yt = ((yearToEl && yearToEl.value) || "").trim();
    return !!(yf || yt);
  };

  function reconcileFacets(initial = false) {
    if (dBrand) dBrand.open = true; // винаги отворена "Марка"

    const brandSelected = hasChecked(facetBrand);
    const modelSelected = hasChecked(facetModel);

    if (dModel) dModel.open = brandSelected || modelSelected;
    if (dYear) dYear.open = hasYear();

    // Първоначално: ако нищо не е избрано – затвори останалите
    if (initial && !brandSelected && !modelSelected && !hasYear()) {
      document.querySelectorAll(".facets .facet").forEach((f) => {
        if (f !== dBrand) f.open = false;
      });
      if (dBrand) dBrand.open = true;
    }
  }

  // =============== INIT =================
  (async function init() {
    initFromQuery(); // URL (вкл. fuel / gearbox / features)
    await Promise.all([loadLookups(), loadFacets()]);
    stampIdsOnFacetCheckboxes(); // fuel/gearbox
    preselectFuelGearboxFromQuery();
    rebuildActiveChips();
    updateChipBarLabels();
    syncSheetMirrors();
    reconcileFacets(true);

    // ===== MOBILE: винаги GRID по дефолт (и скриваме/заключваме toggle-а) =====
    if (isMobile) {
      state.view = "grid";
      if (viewGrid) {
        viewGrid.checked = true;
        viewGrid.disabled = true;
      }
      if (viewList) {
        viewList.checked = false;
        viewList.disabled = true;
      }
      hideViewToggleOnMobile();
    }

    // Инициализираме изгледа според state.view
    if (cardsWrap) cardsWrap.dataset.view = state.view;
    if (state.view === "list" && !isMobile) {
      if (viewList) viewList.checked = true;
    } else {
      if (viewGrid) viewGrid.checked = true;
    }

    applyFilters(true);
    mobileFocusStyling();
    initMobileAutoHideCatalogHead();
  })();

  // ------- Lookups -------
  async function loadLookups() {
    try {
      if (!hasApi || typeof AD_API.getLookups !== "function") return;
      const res = await AD_API.getLookups();

      // fuel_types: [{id,name}]
      (res?.fuel_types || []).forEach((f) => {
        const id = Number(f.id),
          name = String(f.name || "").trim();
        if (!Number.isInteger(id) || !name) return;
        maps.fuelByName.set(name.toLowerCase(), id);
        maps.fuelIdToName.set(String(id), name);
      });

      // transmissions: [{id,name}]
      (res?.transmissions || []).forEach((t) => {
        const id = Number(t.id),
          name = String(t.name || "").trim();
        if (!Number.isInteger(id) || !name) return;
        maps.gearboxByName.set(name.toLowerCase(), id);
        maps.gearboxIdToName.set(String(id), name);
      });

      // body_types -> селект + мобилен proxy
      if (bodyTypeSel) {
        const opts = ['<option value="">Всички</option>'];
        (res?.body_types || []).forEach((b) => {
          opts.push(`<option value="${escapeHtml(String(b.id))}">${escapeHtml(b.name)}</option>`);
        });
        const html = opts.join("");
        bodyTypeSel.innerHTML = html;
        if (bodyTypeProxy) bodyTypeProxy.innerHTML = html;
      }
    } catch (e) {
      console.warn("Lookups error:", e);
    }
  }

  // Щампова data-id на чекбоксите според името им (fuel/gearbox)
  function stampIdsOnFacetCheckboxes() {
    const stamp = (ul, nameToId) => {
      if (!ul) return;
      ul.querySelectorAll('input[type="checkbox"]').forEach((inp) => {
        if (inp.dataset.id && /^\d+$/.test(inp.dataset.id)) return;
        const labelTxt = (inp.parentElement?.textContent || inp.value || "").trim().toLowerCase();
        const id = nameToId.get(labelTxt);
        if (Number.isInteger(id)) inp.dataset.id = String(id);
      });
    };
    stamp(fuelUl, maps.fuelByName);
    stamp(gearboxUl, maps.gearboxByName);
  }

  // =============== FACETS =================
  async function loadFacets() {
    // Марки
    let makes = [];
    try {
      if (hasApi && typeof AD_API.getMakes === "function") {
        const apiMakes = await AD_API.getMakes();
        makes = apiMakes.map((m) => ({ id: String(m.id), name: m.name }));
      }
    } catch {
      makes = [];
    }

    renderBrandFacet(makes);
    attachAutoApply(fuelUl);
    attachAutoApply(gearboxUl);

    // екстри
    await loadFeaturesFacet();

    // ====== Mini search над Марка/Модел (auto-inject ако липсват input-и) ======
    ensureFacetSearchInputs();

    // input-и за диапазони + новите филтри (✅ без spam към API на всяко натискане)
    const rangeInputs = [yearFromEl, yearToEl, kmMinEl, kmMaxEl, engineFromEl, engineToEl, powerFromEl, powerToEl];

    rangeInputs.forEach((inp) => {
      if (!inp) return;

      // UI updates while typing (без API)
      inp.addEventListener(
        "input",
        debounce(() => {
          uiOnlyUpdate();
          // ако вече е "валидно" (пример: 2020), може да apply след като спре да пише
          autoApplyTyping(inp);
        }, 80)
      );

      // apply on change/blur (dedupe ще пази от двойни)
      inp.addEventListener("change", () => {
        if (shouldApplyNow(inp)) autoApply();
      });

      inp.addEventListener("blur", () => {
        if (shouldApplyNow(inp)) autoApply();
      });
    });

    // селекти (bodyType, origin): apply само на change
    [bodyTypeSel, originSel].forEach((inp) => {
      if (!inp) return;
      inp.addEventListener("change", () => {
        autoApply();
        reconcileFacets(false);
      });
    });

    // color: UI update докато пишеш, apply по-рядко
    if (colorInput) {
      colorInput.addEventListener(
        "input",
        debounce(() => {
          uiOnlyUpdate();
          autoApplyTyping(colorInput);
        }, 100)
      );
      colorInput.addEventListener("change", () => autoApply());
      colorInput.addEventListener("blur", () => {
        if (shouldApplyNow(colorInput)) autoApply();
      });
    }

    // търсачка за модели
    if (facetModel) {
      const input = document.getElementById("modelSearch");
      if (input) {
        input.addEventListener("input", () => {
          const q = input.value.trim().toLowerCase();
          [...facetModel.querySelectorAll("li")].forEach((li) => {
            const txt = li.textContent.toLowerCase();
            li.style.display = txt.includes(q) ? "" : "none";
          });
        });
      }
    }

    // търсачка за марки
    if (facetBrand) {
      const input = document.getElementById("brandSearch");
      if (input) {
        input.addEventListener("input", () => {
          const q = input.value.trim().toLowerCase();
          [...facetBrand.querySelectorAll("li")].forEach((li) => {
            const txt = li.textContent.toLowerCase();
            li.style.display = txt.includes(q) ? "" : "none";
          });
        });
      }
    }

    buildChipsFromChecklist(facetBrand, sheetBrandList);
    buildChipsFromChecklist(facetModel, sheetModelList);

    if (yearFromEl?.value) yearFromProxy.value = yearFromEl.value;
    if (yearToEl?.value) yearToProxy.value = yearToEl.value;
    if (kmMinEl?.value) kmMinProxy.value = kmMinEl.value;
    if (kmMaxEl?.value) kmMaxProxy.value = kmMaxEl.value;

    if (engineFromEl?.value && engineFromProxy) engineFromProxy.value = engineFromEl.value;
    if (engineToEl?.value && engineToProxy) engineToProxy.value = engineToEl.value;
    if (powerFromEl?.value && powerFromProxy) powerFromProxy.value = powerFromEl.value;
    if (powerToEl?.value && powerToProxy) powerToProxy.value = powerToEl.value;

    if (bodyTypeSel?.value && bodyTypeProxy) bodyTypeProxy.value = bodyTypeSel.value;
    if (originSel?.value && originProxy) originProxy.value = originSel.value;

    confirmYearBtn?.addEventListener("click", () => {
      copyVal(yearFromProxy, yearFromEl, true);
      copyVal(yearToProxy, yearToEl, true);
      reconcileFacets(false);
      // apply ще дойде от change/blur
    });
    confirmKmBtn?.addEventListener("click", () => {
      copyVal(kmMinProxy, kmMinEl, true);
      copyVal(kmMaxProxy, kmMaxEl, true);
      // apply ще дойде от change/blur
    });

    confirmBodyBtn?.addEventListener("click", () => {
      if (bodyTypeProxy && bodyTypeSel) {
        bodyTypeSel.value = bodyTypeProxy.value;
        bodyTypeSel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    confirmOriginBtn?.addEventListener("click", () => {
      if (originProxy && originSel) {
        originSel.value = originProxy.value;
        originSel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    confirmEngineBtn?.addEventListener("click", () => {
      copyVal(engineFromProxy, engineFromEl, true);
      copyVal(engineToProxy, engineToEl, true);
    });

    confirmPowerBtn?.addEventListener("click", () => {
      copyVal(powerFromProxy, powerFromEl, true);
      copyVal(powerToProxy, powerToEl, true);
    });

    // На мобилен: .sheet__confirm вече НЕ е нужен за apply (филтрите се прилагат веднага)
    document.querySelectorAll(".sheet__confirm").forEach((btn) => {
      btn.addEventListener("click", () => {
        syncSheetMirrors();
        reconcileFacets(false);
      });
    });
  }

  function ensureFacetSearchInputs() {
    // Ако нямаш input-и в HTML, ги добавяме в brand/model facet body.
    const inject = (detailsEl, inputId, placeholder) => {
      if (!detailsEl) return;
      if (document.getElementById(inputId)) return;

      const body = detailsEl.querySelector(".facet__body") || detailsEl;
      // ако вече има .facet__search – ползваме него
      let wrap = body.querySelector(".facet__search");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "facet__search";
        // сложи най-отгоре в body
        body.insertBefore(wrap, body.firstChild);
      }

      // ако wrap вече има input – не пипай
      if (wrap.querySelector("input")) {
        const ex = wrap.querySelector("input");
        if (ex && !ex.id) ex.id = inputId;
        return;
      }

      const input = document.createElement("input");
      input.type = "text";
      input.id = inputId;
      input.placeholder = placeholder;
      input.autocomplete = "off";
      input.spellcheck = false;
      wrap.appendChild(input);
    };

    inject(dBrand, "brandSearch", "Търси марка…");
    inject(dModel, "modelSearch", "Търси модел…");
  }

  async function loadFeaturesFacet() {
    if (!facetFeatures) return;
    try {
      if (!hasApi || typeof AD_API.getListingFeatures !== "function") {
        facetFeatures.innerHTML = `<li class="muted">Няма данни за екстри.</li>`;
        if (sheetFeaturesList) sheetFeaturesList.innerHTML = `<p class="muted">Няма данни за екстри.</p>`;
        return;
      }
      const rows = await AD_API.getListingFeatures();
      if (!rows || !rows.length) {
        facetFeatures.innerHTML = `<li class="muted">Няма данни за екстри.</li>`;
        if (sheetFeaturesList) sheetFeaturesList.innerHTML = `<p class="muted">Няма данни за екстри.</p>`;
        return;
      }

      facetFeatures.innerHTML = rows
        .map((r) => {
          const id = r.featureId ?? r.id;
          const name = r.name ?? "";
          return `
          <li>
            <label>
              <input type="checkbox" value="${escapeHtml(String(id))}" data-name="${escapeHtml(name)}">
              ${escapeHtml(name)}
            </label>
          </li>`;
        })
        .join("");

      attachAutoApply(facetFeatures);

      if (sheetFeaturesList) {
        buildChipsFromChecklist(facetFeatures, sheetFeaturesList);
      }
    } catch (e) {
      console.warn("Features facet error:", e);
      facetFeatures.innerHTML = `<li class="muted">Няма данни за екстри.</li>`;
      if (sheetFeaturesList) sheetFeaturesList.innerHTML = `<p class="muted">Няма данни за екстри.</p>`;
    }
  }

  function renderBrandFacet(makes) {
    if (!facetBrand) return;

    // сортиране по азбучен ред (bg)
    if (Array.isArray(makes) && makes.length) {
      makes = makes
        .slice()
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "bg-BG", { sensitivity: "base" }));
    }

    facetBrand.innerHTML = makes.length
      ? makes
          .map(
            (m) => `
        <li>
          <label>
            <input type="checkbox" value="${escapeHtml(m.id)}" data-name="${escapeHtml(m.name)}">
            ${escapeHtml(m.name)}
          </label>
        </li>`
          )
          .join("")
      : `<li class="muted">Няма данни за марки.</li>`;

    facetBrand.addEventListener("change", async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;

      [...facetBrand.querySelectorAll("input[type=checkbox]")].forEach((b) => {
        if (b !== target) b.checked = false;
      });

      state.filters.makeId = target.checked ? target.value : "";
      // смяна на марка -> чистим всички модели
      state.filters.modelId = "";
      state.filters.modelIds = [];
      state.filters.modelNames = [];
      await loadModelsForBrand(state.filters.makeId);

      // ✅ прилагаме (dedupe ще пази)
      autoApply();
      reconcileFacets(false);
    });

    if (state.filters.makeId) {
      const toCheck = facetBrand.querySelector(`input[value="${CSS.escape(state.filters.makeId)}"]`);
      if (toCheck) toCheck.checked = true;
      loadModelsForBrand(state.filters.makeId, true);
    } else {
      if (facetModel) {
        facetModel.innerHTML = `<li class="muted">Избери марка, за да видиш моделите.</li>`;
        buildChipsFromChecklist(facetModel, sheetModelList);
      }
    }
  }

  async function loadModelsForBrand(makeId, keepSelection = false) {
    if (!facetModel) return;

    if (state.currentModelBrandId === makeId && !keepSelection) return;
    state.currentModelBrandId = makeId;
    facetModel.innerHTML = `<li class="muted">Зареждане…</li>`;

    let models = [];
    if (makeId) {
      try {
        if (hasApi && typeof AD_API.getModels === "function") {
          const res = await AD_API.getModels(makeId);
          models = res.map((m) => ({ id: String(m.id), name: m.name }));
        }
      } catch {
        models = [];
      }
    }

    if (models.length) {
      // сортиране моделите по азбучен ред
      models.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "bg-BG", { sensitivity: "base" })
      );
    }

    if (!models.length) {
      state.filters.modelId = "";
      state.filters.modelIds = [];
      state.filters.modelNames = [];
      facetModel.innerHTML = `<li class="muted">Няма модели.</li>`;
      buildChipsFromChecklist(facetModel, sheetModelList);
      reconcileFacets(false);
      return;
    }

    facetModel.innerHTML = models
      .map(
        (m) => `
      <li>
        <label>
          <input type="checkbox" value="${escapeHtml(m.id)}" data-name="${escapeHtml(m.name)}">
          ${escapeHtml(m.name)}
        </label>
      </li>`
      )
      .join("");

    // При запазен selection – чекваме съответния чекбокс
    if (keepSelection && Array.isArray(state.filters.modelIds) && state.filters.modelIds.length) {
      const idsSet = new Set(state.filters.modelIds.map((id) => String(id)));
      facetModel.querySelectorAll('input[type="checkbox"]').forEach((inp) => {
        inp.checked = idsSet.has(inp.value);
      });
    } else if (keepSelection && state.filters.modelId) {
      const toCheck = facetModel.querySelector(`input[value="${CSS.escape(state.filters.modelId)}"]`);
      if (toCheck) toCheck.checked = true;
    }

    // слушаме промени – но вече правим SINGLE select
    facetModel.onchange = handleModelChange;

    buildChipsFromChecklist(facetModel, sheetModelList);
    syncSheetMirrors();
    rebuildActiveChips();
    updateChipBarLabels();
    reconcileFacets(false);

    // ако има търсачка – при смяна на марка чистим текста, за да не “скрие” всичко
    const ms = document.getElementById("modelSearch");
    if (ms) ms.value = "";
  }

  // МОДЕЛ – single select (като марка)
  function handleModelChange(e) {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;

    // разчекваме всички други модели
    [...facetModel.querySelectorAll('input[type="checkbox"]')].forEach((b) => {
      if (b !== target) b.checked = false;
    });

    // ✅ прилагаме (dedupe ще пази)
    autoApply();
    reconcileFacets(false);
  }

  function attachAutoApply(ul) {
    if (!ul) return;
    ul.addEventListener("change", () => {
      autoApply();
    });
  }

  // ===== Предварително чекване на fuel/gearbox по ID от URL =====
  function preselectFuelGearboxFromQuery() {
    const checkById = (ul, ids, idToNameMap) => {
      if (!ul || !ids?.length) return [];
      const namesMarked = [];
      ids.forEach((id) => {
        const idStr = String(id);
        const name = idToNameMap.get(idStr) || "";
        // 1) data-id=ID
        let box = ul.querySelector(`input[type="checkbox"][data-id="${CSS.escape(idStr)}"]`);
        // 2) value=ID
        if (!box) box = ul.querySelector(`input[type="checkbox"][value="${CSS.escape(idStr)}"]`);
        // 3) по текст, ако нямаме id върху чекбокса
        if (!box && name) {
          box = [...ul.querySelectorAll('input[type="checkbox"]')].find((i) => {
            const txt = (i.parentElement?.textContent || i.value || "").trim();
            return txt.toLowerCase() === name.toLowerCase();
          });
        }
        if (box && !box.checked) {
          box.checked = true;
          namesMarked.push((box.parentElement?.textContent || name || "").trim());
        }
      });
      return namesMarked;
    };

    const fuelNames = checkById(fuelUl, state.filters.fuelIds, maps.fuelIdToName);
    const gearboxNames = checkById(gearboxUl, state.filters.gearboxIds, maps.gearboxIdToName);

    if (fuelNames.length) state.filters.fuelNames = fuelNames;
    if (gearboxNames.length) state.filters.gearboxNames = gearboxNames;
  }

  // =============== BUTTONS ===============
  btnApply?.addEventListener("click", () => {
    autoApply();
  });

  btnClear?.addEventListener("click", () => {
    // reset dedupe key (да не блокира след clear)
    lastReqKey = "";

    state.filters = {
      makeId: "",
      modelId: "",
      modelIds: [],
      modelNames: [],
      yearFrom: "",
      yearTo: "",
      kmMin: "",
      kmMax: "",
      priceFrom: "",
      priceTo: "",
      fuelIds: [],
      gearboxIds: [],
      fuelNames: [],
      gearboxNames: [],
      bodyTypeId: "",
      color: "",
      engineFromCc: "",
      engineToCc: "",
      powerFromHp: "",
      powerToHp: "",
      origin: "",
      featureIds: [],
      featureNames: [],
    };
    state.currentModelBrandId = "";
    [...document.querySelectorAll(".facets input[type=checkbox]")].forEach((i) => (i.checked = false));
    if (yearFromEl) yearFromEl.value = "";
    if (yearToEl) yearToEl.value = "";
    if (kmMinEl) kmMinEl.value = "";
    if (kmMaxEl) kmMaxEl.value = "";

    if (bodyTypeSel) bodyTypeSel.value = "";
    if (originSel) originSel.value = "";
    if (colorInput) colorInput.value = "";
    if (engineFromEl) engineFromEl.value = "";
    if (engineToEl) engineToEl.value = "";
    if (powerFromEl) powerFromEl.value = "";
    if (powerToEl) powerToEl.value = "";

    if (bodyTypeProxy) bodyTypeProxy.value = "";
    if (originProxy) originProxy.value = "";
    if (engineFromProxy) engineFromProxy.value = "";
    if (engineToProxy) engineToProxy.value = "";
    if (powerFromProxy) powerFromProxy.value = "";
    if (powerToProxy) powerToProxy.value = "";
    if (yearFromProxy) yearFromProxy.value = "";
    if (yearToProxy) yearToProxy.value = "";
    if (kmMinProxy) kmMinProxy.value = "";
    if (kmMaxProxy) kmMaxProxy.value = "";

    const bs = document.getElementById("brandSearch");
    const ms = document.getElementById("modelSearch");
    if (ms) ms.value = "";
    if (bs) bs.value = "";

    if (facetModel) {
      facetModel.innerHTML = `<li class="muted">Избери марка, за да видиш моделите.</li>`;
      buildChipsFromChecklist(facetModel, sheetModelList);
    }
    rebuildActiveChips();
    updateChipBarLabels();
    applyFilters(false);
    syncSheetMirrors();
    reconcileFacets(true);

    // MOBILE: пак форсираме grid и крие toggle (ако някъде се е появил)
    if (isMobile) {
      setView("grid");
      hideViewToggleOnMobile();
    }
  });

  sortSel?.addEventListener("change", () => {
    // sort change е различна заявка => reset dedupe key
    lastReqKey = "";
    state.sort = sortSel.value;
    applyFilters(false);
  });

  // Разрешаваме превключването Grid/List САМО на десктоп.
  if (!isMobile) {
    viewGrid?.addEventListener("change", () => setView("grid"));
    viewList?.addEventListener("change", () => setView("list"));
  } else {
    // На мобилен: заключено на grid
    if (viewGrid) {
      viewGrid.checked = true;
      viewGrid.disabled = true;
    }
    if (viewList) {
      viewList.checked = false;
      viewList.disabled = true;
    }
  }

  function setView(v) {
    // На мобилен винаги grid, каквото и да натиснат
    if (isMobile) v = "grid";

    state.view = v;
    if (cardsWrap) cardsWrap.dataset.view = v;

    // синк на toggles ако съществуват
    if (viewGrid) viewGrid.checked = v === "grid";
    if (viewList) viewList.checked = v === "list";

    rerenderForView();
  }

  function rerenderForView() {
    if (!cardsWrap) return;
    if (!state.items.length) return; // още няма заредени обяви
    const current = state.items.slice();
    cardsWrap.innerHTML = "";
    renderListings(current);
  }

  function hideViewToggleOnMobile() {
    if (!isMobile) return;

    const wrap =
      (viewGrid && viewGrid.closest(".view-toggle")) ||
      (viewList && viewList.closest(".view-toggle")) ||
      (viewGrid && viewGrid.closest("[data-role='view-toggle']")) ||
      (viewList && viewList.closest("[data-role='view-toggle']")) ||
      (viewGrid && viewGrid.closest(".catalog-view")) ||
      (viewList && viewList.closest(".catalog-view")) ||
      (viewGrid && viewGrid.closest(".catalog-toolbar")) ||
      (viewList && viewList.closest(".catalog-toolbar")) ||
      (viewGrid && viewGrid.parentElement) ||
      (viewList && viewList.parentElement);

    if (wrap) wrap.style.display = "none";
  }

  btnLoadMore?.addEventListener("click", () => loadMore());

  // =============== CORE ===============
  function collectFacetFilters() {
    const getChecked = (ul) => [...(ul?.querySelectorAll('input[type="checkbox"]:checked') || [])];

    // make
    const brandBox = facetBrand?.querySelector("input:checked");
    state.filters.makeId = brandBox ? brandBox.value : "";

    // models – single
    const modelBoxes = facetModel ? [...facetModel.querySelectorAll('input[type="checkbox"]:checked')] : [];
    const modelIds = modelBoxes.map((i) => Number((i.value || "").trim())).filter(Number.isInteger);
    const modelNames = modelBoxes.map((i) => i.dataset.name || (i.parentElement?.textContent || "").trim());

    state.filters.modelIds = modelIds;
    state.filters.modelNames = modelNames;
    state.filters.modelId = modelIds.length === 1 ? String(modelIds[0]) : "";

    // ranges
    state.filters.yearFrom = (yearFromEl?.value || "").trim();
    state.filters.yearTo = (yearToEl?.value || "").trim();
    state.filters.kmMin = (kmMinEl?.value || "").trim();
    state.filters.kmMax = (kmMaxEl?.value || "").trim();

    // нови диапазони / селекти
    state.filters.bodyTypeId = (bodyTypeSel?.value || "").trim();
    state.filters.color = (colorInput?.value || "").trim();
    state.filters.engineFromCc = (engineFromEl?.value || "").trim();
    state.filters.engineToCc = (engineToEl?.value || "").trim();
    state.filters.powerFromHp = (powerFromEl?.value || "").trim();
    state.filters.powerToHp = (powerToEl?.value || "").trim();
    state.filters.origin = (originSel?.value || "").trim();

    // FUEL: предпочитаме data-id; fallback към име -> ID
    const fuelBoxes = getChecked(fuelUl);
    const fuelIds = fuelBoxes
      .map((i) => {
        const id = (i.dataset.id || "").trim();
        if (/^\d+$/.test(id)) return Number(id);
        const name = (i.parentElement?.textContent || i.value || "").trim().toLowerCase();
        return maps.fuelByName.get(name);
      })
      .filter(Number.isInteger);
    state.filters.fuelIds = fuelIds;
    state.filters.fuelNames = fuelBoxes.map((i) => (i.parentElement?.textContent || i.value || "").trim());

    // GEARBOX
    const gbBoxes = getChecked(gearboxUl);
    const gbIds = gbBoxes
      .map((i) => {
        const id = (i.dataset.id || "").trim();
        if (/^\d+$/.test(id)) return Number(id);
        const name = (i.parentElement?.textContent || i.value || "").trim().toLowerCase();
        return maps.gearboxByName.get(name);
      })
      .filter(Number.isInteger);
    state.filters.gearboxIds = gbIds;
    state.filters.gearboxNames = gbBoxes.map((i) => (i.parentElement?.textContent || i.value || "").trim());

    // FEATURES
    const featBoxes = getChecked(facetFeatures);
    const featIds = featBoxes.map((i) => Number((i.value || "").trim())).filter(Number.isInteger);
    state.filters.featureIds = featIds;
    state.filters.featureNames = featBoxes.map((i) => (i.parentElement?.textContent || "").trim());

    rebuildActiveChips();
    updateChipBarLabels();
    pushQuery();
  }

  async function applyFilters(fromInit) {
    // ✅ нов токен за всяко “ново” филтриране
    state.reqToken++;
    const token = state.reqToken;

    state.skip = fromInit ? state.skip : 0;
    state.items = [];
    await loadMore(true, token);
  }

  async function loadMore(reset = false, token = state.reqToken) {
    try {
      const rows = await fetchListings({
        skip: state.skip,
        take: state.take,
        filters: state.filters,
        sort: state.sort,
      });

      // ✅ ако междувременно има нов apply — игнорирай този резултат
      if (token !== state.reqToken) return;

      if (reset && cardsWrap) cardsWrap.innerHTML = "";
      renderListings(rows);

      state.items = state.items.concat(rows);
      state.skip += rows.length;

      const noResults = state.skip === 0 && rows.length === 0;
      if (emptyState) emptyState.style.display = noResults ? "block" : "none";
      if (btnLoadMore) btnLoadMore.style.display = rows.length < state.take ? "none" : "inline-flex";
      if (resultCountEl) resultCountEl.textContent = String(state.skip);
    } catch (e) {
      if (token !== state.reqToken) return;

      console.warn("Грешка при зареждане:", e);
      if (cardsWrap) cardsWrap.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      if (btnLoadMore) btnLoadMore.style.display = "none";
      if (resultCountEl) resultCountEl.textContent = "0";
    }
  }

  async function fetchListings({ skip, take, filters, sort }) {
    let rows = [];
    if (hasApi && typeof AD_API.getPublicListings === "function") {
      const req = mapFiltersToApi(filters, sort, skip, take);
      rows = await AD_API.getPublicListings(req);
    }
    if (!Array.isArray(rows)) rows = [];

    // --- Клиентски филтър по НЯКОЛКО модела ---
    const idsArr = Array.isArray(filters.modelIds) ? filters.modelIds.map(Number).filter(Number.isInteger) : [];
    const namesArr = Array.isArray(filters.modelNames)
      ? filters.modelNames.map((n) => String(n).trim().toLowerCase()).filter(Boolean)
      : [];

    // при single select няма да влезе (дължината е 0 или 1)
    if (idsArr.length > 1 || namesArr.length > 1) {
      const idsSet = new Set(idsArr);
      const namesSet = new Set(namesArr);

      rows = rows.filter((row) => {
        const mId = Number(row.model_id ?? row.modelId ?? row.modelID ?? (row.model && row.model.id) ?? 0);
        const mNameRaw = row.model_name ?? row.model ?? (row.model && (row.model.name || row.model.model_name)) ?? "";
        const mName = String(mNameRaw).trim().toLowerCase();

        const okById = idsSet.size ? idsSet.has(mId) : false;
        const okByName = namesSet.size ? mName && namesSet.has(mName) : false;

        return okById || okByName;
      });
    }

    return rows;
  }

  function mapFiltersToApi(filters, sort, skip, take) {
    const req = { skip, take, sort };

    if (filters.makeId) req.makeId = Number(filters.makeId);

    // modelId – подаваме само ако има точно 1 избран модел
    if (filters.modelId) req.modelId = Number(filters.modelId);

    if (filters.yearFrom) req.yearFrom = Number(filters.yearFrom);
    if (filters.yearTo) req.yearTo = Number(filters.yearTo);
    if (filters.kmMin) req.kmMin = Number(filters.kmMin);
    if (filters.kmMax) req.kmMax = Number(filters.kmMax);
    if (filters.priceFrom) req.priceFrom = Number(filters.priceFrom);
    if (filters.priceTo) req.priceTo = Number(filters.priceTo);

    if (filters.bodyTypeId) req.bodyTypeId = Number(filters.bodyTypeId);
    if (filters.color) req.color = filters.color;
    if (filters.engineFromCc) req.engineFromCc = Number(filters.engineFromCc);
    if (filters.engineToCc) req.engineToCc = Number(filters.engineToCc);
    if (filters.powerFromHp) req.powerFromHp = Number(filters.powerFromHp);
    if (filters.powerToHp) req.powerToHp = Number(filters.powerToHp);
    if (filters.origin) req.origin = filters.origin;

    if (Array.isArray(filters.fuelIds) && filters.fuelIds.length)
      req.fuel = filters.fuelIds.map(Number).filter(Number.isInteger);

    if (Array.isArray(filters.gearboxIds) && filters.gearboxIds.length)
      req.gearbox = filters.gearboxIds.map(Number).filter(Number.isInteger);

    if (Array.isArray(filters.featureIds) && filters.featureIds.length)
      req.features = filters.featureIds.map(Number).filter(Number.isInteger);

    return req;
  }

// =========================
// ORIGIN FLAGS (Catalog cards) — FIXED
// =========================
const ORIGIN_FLAGS = {
  usa:    { src: "Images/USAFlag.webp",   alt: "САЩ" },
  canada: { src: "Images/canadaFlag.png", alt: "Канада" },
  korea:  { src: "Images/Korea.png",      alt: "Южна Корея" },
  uae:    { src: "Images/UAE.webp",       alt: "ОАЕ" },
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
    s.includes("сащ") || s.includes("u.s") || s === "us" ||
    s.includes("usa") || s.includes("united states") || s.includes("america") || s.includes("америка")
  ) return "usa";

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
  // 1) директни полета (каквито вече пробваш)
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

  // 2) fallback: сканираме целия row за "origin/country/market/source"
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
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRowFeatureNames(row) {
  let arr = [];
  if (Array.isArray(row.features)) arr = row.features;
  else if (row.features_json) arr = safeParseJSON(row.features_json);
  else if (row.featuresJson) arr = safeParseJSON(row.featuresJson);

  return arr
    .map((f) => (typeof f === "string" ? f : (f?.name || f?.feature_name || f?.title || "")))
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

// ✅ САМО от твоите полета/екстри (без title)
function getHighlightBadges(row, max = 3) {
  const out = [];
  const add = (v) => {
    const s = String(v || "").trim();
    if (!s) return;
    if (out.some((x) => x.toLowerCase() === s.toLowerCase())) return;
    out.push(s);
  };

  // 1) твоя “главен” бейдж
  add(row.main_feature_name || row.main_feature || row.feature_primary || row.top_feature);

  // 2) екстри от DB (features / features_json)
  for (const n of getRowFeatureNames(row)) {
    if (out.length >= max) break;
    add(n);
  }

  return out.slice(0, max);
}



// =============== РЕНДЕР НА ОБЯВИ (ЕДИНСТВЕН) ===============
function renderListings(list) {
  if (!cardsWrap) return;

  if (!list || !list.length) {
    if (!state.items.length) {
      cardsWrap.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      if (resultCountEl) resultCountEl.textContent = "0";
    }
    return;
  }

  const frag = document.createDocumentFragment();

  list.forEach((row, idx) => {
    const photosJson = row.photos_json ? safeParseJSON(row.photos_json) : null;
    const firstPhotoUrl =
      (photosJson && photosJson.length ? (photosJson.find((p) => p.is_cover) || photosJson[0]).url : null) ||
      row.cover_photo_url ||
      row.coverPhotoUrl ||
      row.photo_url ||
      row.cover_url ||
      row.main_photo ||
      row.image_url ||
      "Images/placeholder-car.png";

    const titleParts = [];
    if (row.year || row.production_year) titleParts.push(String(row.year || row.production_year));
    if (row.make || row.make_name) titleParts.push(String(row.make || row.make_name));
    if (row.model || row.model_name) titleParts.push(String(row.model || row.model_name));

    const fallbackTitle = titleParts.join(" ") || "Автомобил";
    const title = row.title || fallbackTitle;

    const year = row.year || row.production_year || "";
    const mileage = row.mileage_km || row.km || "";

    const listingId = row.listing_id || row.id;
    const detailUrl = listingId ? `detail.html?id=${listingId}` : `detail.html`;

    // ----- secondary specs -----
    const secondarySpecs = [];
    if (year) secondarySpecs.push(`<span>${escapeHtml(year)} г.</span>`);
    if (mileage) secondarySpecs.push(`<span>${formatKm(mileage)}</span>`);

    const gearboxTxt = row.transmission || row.transmission_name || row.gearbox || row.gearbox_name || "";
    if (gearboxTxt) secondarySpecs.push(`<span>${escapeHtml(gearboxTxt)}</span>`);

    const bodyTxt = row.body_type || row.body_type_name || row.body || "";
    if (bodyTxt) secondarySpecs.push(`<span>${escapeHtml(bodyTxt)}</span>`);

    const hp = row.power_hp || row.hp || row.horsepower || "";
    if (hp) secondarySpecs.push(`<span>${escapeHtml(String(hp))} к.с.</span>`);

    const cc = row.engine_cc || row.engine_volume_cc || row.displacement_cc || "";
    if (cc) secondarySpecs.push(`<span>${escapeHtml(String(cc))} куб.</span>`);

    // ✅ Mobile: флагът е последен чип
    if (isMobile) {
      const f = getFlagMetaHtml(row);
      if (f) secondarySpecs.push(f);
    }

    // ✅ Desktop: флагът е след заглавието (на мобилен НЕ)
    const titleFlagHtml = !isMobile ? getFlagImgHtml(row) : "";

    // ✅ BADGES: само от DB (никакъв title fallback)
    const badges = getHighlightBadges(row, 3); // тази функция вече е "без title"
    const badgesHtml = badges.length
      ? `<div class="badges">
          ${badges.map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join("")}
         </div>`
      : "";

    // ====== PRICE STACK + TYPE ======
    const rawAmount = row.price_amount ?? row.priceAmount ?? row.price ?? row.amount ?? null;
    const rawCurr = row.currency_code ?? row.currencyCode ?? row.currency ?? "EUR";

    const priceType = getPriceType(row);
    const priceTypeHtml = priceType
      ? `<div class="price-type price-type--${priceType}">
          <span class="price-type__dot"></span>
          ${priceType === "final" ? "Крайна цена" : "Прогнозна цена"}
        </div>`
      : "";

    const norm = normalizePrice(rawAmount, rawCurr);

    let priceHtml = "";
    if (!norm) {
      priceHtml = `
        <div class="price-stack">
          <div class="price-eur">по договаряне</div>
          ${priceTypeHtml}
        </div>
      `;
    } else {
      const eurTxt = "€" + formatInt(norm.eur);
      const bgnTxt = "(" + formatInt(norm.bgn) + " лв.)";
      priceHtml = `
        <div class="price-stack">
          <div class="price-stack2">
            <div class="price-eur">${eurTxt}</div>
            <div class="price-bgn">${bgnTxt}</div>
          </div>
          ${priceTypeHtml}
        </div>
      `;
    }

    const card = document.createElement("article");
    card.className = "card";
    if (listingId) card.setAttribute("data-details-url", detailUrl);

    card.innerHTML = `
      <div class="card__media" data-role="media">
        <img src="${firstPhotoUrl}" alt="${escapeHtml(title)}" loading="lazy">
        ${badgesHtml}
      </div>

      <div class="card__body">
        <h3 class="title">
          <span class="title__text">${escapeHtml(title)}</span>
          ${titleFlagHtml}
        </h3>

        ${
          (isMobile || state.view === "list") && secondarySpecs.length
            ? `<div class="meta meta-secondary">${secondarySpecs.join("")}</div>`
            : ""
        }

        <div class="row">
          <div class="price">${priceHtml}</div>
          <div class="actions">
            <a class="btn ghost" href="${detailUrl}" data-details-url="${detailUrl}">Детайл</a>
          </div>
        </div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn")) return;
      if (!detailUrl) return;
      window.location.href = detailUrl;
    });

    setTimeout(() => card.classList.add("visible"), 40 * (idx % 6));
    frag.appendChild(card);
  });

  cardsWrap.appendChild(frag);
}





  // =============== Chipbar: активни чипове ===============
  function rebuildActiveChips() {
    if (!chipsActive) return;
    chipsActive.innerHTML = "";

    const addChip = (label, onClear) => {
      const el = document.createElement("button");
      el.className = "tag";
      el.type = "button";
      el.textContent = label + " ×";
      el.addEventListener("click", onClear);
      chipsActive.appendChild(el);
    };

    // Марка
    const brandBox = facetBrand?.querySelector("input:checked");
    if (brandBox) {
      const label = brandBox.dataset.name || (brandBox.parentElement?.textContent || "").trim();
      addChip(label, () => {
        // reset dedupe за да не "засече" ако се върнеш към същото
        lastReqKey = "";

        brandBox.checked = false;
        state.filters.makeId = "";
        state.filters.modelId = "";
        state.filters.modelIds = [];
        state.filters.modelNames = [];
        state.currentModelBrandId = "";
        if (facetModel) {
          facetModel.innerHTML = `<li class="muted">Избери марка, за да видиш моделите.</li>`;
          buildChipsFromChecklist(facetModel, sheetModelList);
        }
        applyFilters(false);
        updateChipBarLabels();
        syncSheetMirrors();
        reconcileFacets(false);

        if (isMobile) {
          setView("grid");
          hideViewToggleOnMobile();
        }
      });
    }

    // Модели – само 1
    if (facetModel) {
      const modelBoxes = [...facetModel.querySelectorAll('input[type="checkbox"]:checked')];
      modelBoxes.forEach((box) => {
        const name = box.dataset.name || (box.parentElement?.textContent || "").trim();
        if (!name) return;
        addChip(name, () => {
          box.checked = false;
          autoApply();
          updateChipBarLabels();
          syncSheetMirrors();
          reconcileFacets(false);
        });
      });
    }

    // Години
    if (yearFromEl?.value)
      addChip(`≥ ${yearFromEl.value}`, () => {
        yearFromEl.value = "";
        state.filters.yearFrom = "";
        autoApply();
        updateChipBarLabels();
        reconcileFacets(false);
      });
    if (yearToEl?.value)
      addChip(`≤ ${yearToEl.value}`, () => {
        yearToEl.value = "";
        state.filters.yearTo = "";
        autoApply();
        updateChipBarLabels();
        reconcileFacets(false);
      });

    // Километри
    if (kmMinEl?.value)
      addChip(`км ≥ ${formatInt(kmMinEl.value)}`, () => {
        kmMinEl.value = "";
        state.filters.kmMin = "";
        autoApply();
        updateChipBarLabels();
      });
    if (kmMaxEl?.value)
      addChip(`км ≤ ${formatInt(kmMaxEl.value)}`, () => {
        kmMaxEl.value = "";
        state.filters.kmMax = "";
        autoApply();
        updateChipBarLabels();
      });

    // Цена
    if (state.filters.priceFrom)
      addChip(`цена ≥ ${formatInt(state.filters.priceFrom)} €`, () => {
        state.filters.priceFrom = "";
        autoApply();
        pushQuery();
      });
    if (state.filters.priceTo)
      addChip(`цена ≤ ${formatInt(state.filters.priceTo)} €`, () => {
        state.filters.priceTo = "";
        autoApply();
        pushQuery();
      });

    // Гориво
    (state.filters.fuelNames || []).forEach((name) => {
      addChip(name, () => {
        const box = [...fuelUl.querySelectorAll("input[type=checkbox]")].find(
          (i) => (i.parentElement.textContent || i.value || "").trim() === name
        );
        if (box) box.checked = false;
        autoApply();
        syncSheetMirrors();
      });
    });

    // Скорости
    (state.filters.gearboxNames || []).forEach((name) => {
      addChip(name, () => {
        const box = [...gearboxUl.querySelectorAll("input[type=checkbox]")].find(
          (i) => (i.parentElement.textContent || i.value || "").trim() === name
        );
        if (box) box.checked = false;
        autoApply();
        syncSheetMirrors();
      });
    });

    // Екстри
    (state.filters.featureNames || []).forEach((name) => {
      addChip(name, () => {
        const box = [...facetFeatures.querySelectorAll("input[type=checkbox]")].find(
          (i) => (i.parentElement.textContent || "").trim() === name
        );
        if (box) box.checked = false;
        autoApply();
        syncSheetMirrors();
      });
    });

    // Body type
    if (state.filters.bodyTypeId && bodyTypeSel) {
      const txt = bodyTypeSel.options[bodyTypeSel.selectedIndex]?.text || "Тип купе";
      addChip(txt, () => {
        bodyTypeSel.value = "";
        state.filters.bodyTypeId = "";
        autoApply();
        updateChipBarLabels();
      });
    }

    // Origin
    if (state.filters.origin && originSel) {
      const txt = originSel.options[originSel.selectedIndex]?.text || "Произход";
      addChip(txt, () => {
        originSel.value = "";
        state.filters.origin = "";
        autoApply();
        updateChipBarLabels();
      });
    }

    // Color
    if (state.filters.color) {
      addChip(state.filters.color, () => {
        colorInput.value = "";
        state.filters.color = "";
        autoApply();
        updateChipBarLabels();
      });
    }
  }

  // Надписи в бързите чипове
  function updateChipBarLabels() {
    const setChipLabel = (chipId, base, values) => {
      const el = document.getElementById(chipId);
      if (!el) return;
      if (!values || !values.length) {
        el.textContent = base;
        el.classList.remove("chip--filled");
        return;
      }

      let label;
      const safeVals = values.map((v) => String(v));

      if (safeVals.length === 1) {
        label = escapeHtml(safeVals[0]);
      } else if (safeVals.length === 2) {
        label = `${escapeHtml(safeVals[0])}, ${escapeHtml(safeVals[1])}`;
      } else {
        label = `${escapeHtml(safeVals[0])} +${safeVals.length - 1}`;
      }

      el.innerHTML = `<span class="chip__base">${base}:</span> <strong class="chip__val">${label}</strong>`;
      el.classList.add("chip--filled");
    };

    const brandNames = facetBrand
      ? [...facetBrand.querySelectorAll("input:checked")].map(
          (i) => i.dataset.name || (i.parentElement?.textContent || "").trim()
        )
      : [];
    const modelNames = facetModel
      ? [...facetModel.querySelectorAll("input:checked")].map(
          (i) => i.dataset.name || (i.parentElement?.textContent || "").trim()
        )
      : [];

    setChipLabel("chipBrand", "Марка", brandNames);
    setChipLabel("chipModel", "Модел", modelNames);
    setChipLabel("chipFuel", "Гориво", state.filters.fuelNames);
    setChipLabel("chipGearbox", "Скорости", state.filters.gearboxNames);

    // Година
    const yA = (yearFromEl?.value || "").trim(),
      yB = (yearToEl?.value || "").trim();
    const chipY = document.getElementById("chipYear");
    if (chipY) {
      if (!yA && !yB) {
        chipY.textContent = "Година";
        chipY.classList.remove("chip--filled");
      } else {
        const v = yA && yB ? `${yA}–${yB}` : yA ? `≥${yA}` : `≤${yB}`;
        chipY.innerHTML = `<span class="chip__base">Година:</span> <strong class="chip__val">${v}</strong>`;
        chipY.classList.add("chip--filled");
      }
    }

    // Километри
    const kA = (kmMinEl?.value || "").trim(),
      kB = (kmMaxEl?.value || "").trim();
    const chipK = document.getElementById("chipKm");
    if (chipK) {
      if (!kA && !kB) {
        chipK.textContent = "Километри";
        chipK.classList.remove("chip--filled");
      } else {
        const v = kA && kB ? `${formatInt(kA)}–${formatInt(kB)}` : kA ? `≥${formatInt(kA)}` : `≤${formatInt(kB)}`;
        chipK.innerHTML = `<span class="chip__base">Километри:</span> <strong class="chip__val">${v}</strong>`;
        chipK.classList.add("chip--filled");
      }
    }

    // Кубатура
    const chipEngine = document.getElementById("chipEngine");
    if (chipEngine) {
      const eA = (engineFromEl?.value || "").trim();
      const eB = (engineToEl?.value || "").trim();
      if (!eA && !eB) {
        chipEngine.textContent = "Кубатура";
        chipEngine.classList.remove("chip--filled");
      } else {
        const v =
          eA && eB
            ? `${formatInt(eA)}–${formatInt(eB)} cc`
            : eA
            ? `≥${formatInt(eA)} cc`
            : `≤${formatInt(eB)} cc`;
        chipEngine.innerHTML = `<span class="chip__base">Кубатура:</span> <strong class="chip__val">${v}</strong>`;
        chipEngine.classList.add("chip--filled");
      }
    }

    // Мощност
    const chipPower = document.getElementById("chipPower");
    if (chipPower) {
      const pA = (powerFromEl?.value || "").trim();
      const pB = (powerToEl?.value || "").trim();
      if (!pA && !pB) {
        chipPower.textContent = "Мощност";
        chipPower.classList.remove("chip--filled");
      } else {
        const v =
          pA && pB
            ? `${formatInt(pA)}–${formatInt(pB)} к.с.`
            : pA
            ? `≥${formatInt(pA)} к.с.`
            : `≤${formatInt(pB)} к.с.`;
        chipPower.innerHTML = `<span class="chip__base">Мощност:</span> <strong class="chip__val">${v}</strong>`;
        chipPower.classList.add("chip--filled");
      }
    }

    // Тип купе
    const chipBody = document.getElementById("chipBody");
    if (chipBody) {
      if (!state.filters.bodyTypeId || !bodyTypeSel || !bodyTypeSel.value) {
        chipBody.textContent = "Тип купе";
        chipBody.classList.remove("chip--filled");
      } else {
        const txt = bodyTypeSel.options[bodyTypeSel.selectedIndex]?.text || "Тип купе";
        chipBody.innerHTML = `<span class="chip__base">Тип купе:</span> <strong class="chip__val">${escapeHtml(
          txt
        )}</strong>`;
        chipBody.classList.add("chip--filled");
      }
    }

    // Произход
    const chipOrigin = document.getElementById("chipOrigin");
    if (chipOrigin) {
      if (!state.filters.origin || !originSel || !originSel.value) {
        chipOrigin.textContent = "Произход";
        chipOrigin.classList.remove("chip--filled");
      } else {
        const txt = originSel.options[originSel.selectedIndex]?.text || "Произход";
        chipOrigin.innerHTML = `<span class="chip__base">Произход:</span> <strong class="chip__val">${escapeHtml(
          txt
        )}</strong>`;
        chipOrigin.classList.add("chip--filled");
      }
    }

    // Екстри
    const chipExtras = document.getElementById("chipExtras");
    if (chipExtras) {
      const feats = state.filters.featureNames || [];
      if (!feats.length) {
        chipExtras.textContent = "Екстри";
        chipExtras.classList.remove("chip--filled");
      } else {
        const first = feats[0];
        const more = feats.length > 1 ? ` +${feats.length - 1}` : "";
        chipExtras.innerHTML = `<span class="chip__base">Екстри:</span> <strong class="chip__val">${escapeHtml(
          first
        )}</strong>${more}`;
        chipExtras.classList.add("chip--filled");
      }
    }
  }

  // =============== Sheets / Chip mirror ===============
  function buildChipsFromChecklist(srcUL, dst) {
    if (!srcUL || !dst) return;
    dst.innerHTML = "";

    const isSingle = srcUL.dataset.single === "1";
    const inputs = srcUL.querySelectorAll('input[type="checkbox"]');

    inputs.forEach((inp) => {
      const txt = (inp.parentElement.textContent || inp.value || "").trim();
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip chip--select";
      btn.innerHTML = `<span>${escapeHtml(txt)}</span>`;
      if (inp.checked) btn.classList.add("chip--active");

      btn.addEventListener("click", () => {
        if (isSingle) {
          const willSelect = !inp.checked;

          inputs.forEach((other) => {
            other.checked = false;
          });
          dst.querySelectorAll(".chip").forEach((ch) => ch.classList.remove("chip--active"));

          if (willSelect) {
            inp.checked = true;
            btn.classList.add("chip--active");
          } else {
            inp.checked = false;
          }
        } else {
          inp.checked = !inp.checked;
          btn.classList.toggle("chip--active", inp.checked);
        }

        inp.dispatchEvent(new Event("change", { bubbles: true }));
      });

      dst.appendChild(btn);
    });
  }

  function syncSheetMirrors() {
    document.querySelectorAll(".sheet label[for]").forEach((lbl) => {
      const id = lbl.getAttribute("for");
      const input = document.getElementById(id);
      if (!input) return;

      if (input.type === "checkbox") {
        lbl.classList.toggle("chip--active", input.checked);

        if (!input.dataset.sheetBound) {
          input.addEventListener("change", () => {
            lbl.classList.toggle("chip--active", input.checked);
          });
          input.dataset.sheetBound = "1";
        }
      }
    });
  }

  function copyVal(from, to, trigger) {
    if (!from || !to) return;
    to.value = from.value;
    if (trigger) {
      to.dispatchEvent(new Event("input", { bubbles: true }));
      to.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // =============== Query string ===============
  function initFromQuery() {
    const qs = new URLSearchParams(location.search);
    state.filters.makeId = qs.get("makeId") || "";
    state.filters.yearFrom = qs.get("yearFrom") || "";
    state.filters.yearTo = qs.get("yearTo") || "";
    state.filters.kmMin = qs.get("kmMin") || "";
    state.filters.kmMax = qs.get("kmMax") || "";
    state.filters.priceFrom = qs.get("priceFrom") || "";
    state.filters.priceTo = qs.get("priceTo") || "";

    state.filters.bodyTypeId = qs.get("bodyTypeId") || "";
    state.filters.color = qs.get("color") || "";
    state.filters.engineFromCc = qs.get("engineFromCc") || "";
    state.filters.engineToCc = qs.get("engineToCc") || "";
    state.filters.powerFromHp = qs.get("powerFromHp") || "";
    state.filters.powerToHp = qs.get("powerToHp") || "";
    state.filters.origin = qs.get("origin") || "";

    initialFuelIds = qs.getAll("fuel").map((x) => Number(x)).filter(Number.isInteger);
    initialGearboxIds = qs.getAll("gearbox").map((x) => Number(x)).filter(Number.isInteger);
    state.filters.fuelIds = initialFuelIds.slice();
    state.filters.gearboxIds = initialGearboxIds.slice();

    const featuresFromQs = qs.getAll("features").map((x) => Number(x)).filter(Number.isInteger);
    state.filters.featureIds = featuresFromQs;

    const sort = qs.get("sort");
    if (sort) {
      state.sort = sort;
      if (sortSel) sortSel.value = sort;
    }

    if (state.filters.yearFrom && yearFromEl) yearFromEl.value = state.filters.yearFrom;
    if (state.filters.yearTo && yearToEl) yearToEl.value = state.filters.yearTo;
    if (state.filters.kmMin && kmMinEl) kmMinEl.value = state.filters.kmMin;
    if (state.filters.kmMax && kmMaxEl) kmMaxEl.value = state.filters.kmMax;

    if (state.filters.bodyTypeId && bodyTypeSel) bodyTypeSel.value = state.filters.bodyTypeId;
    if (state.filters.origin && originSel) originSel.value = state.filters.origin;
    if (state.filters.color && colorInput) colorInput.value = state.filters.color;
    if (state.filters.engineFromCc && engineFromEl) engineFromEl.value = state.filters.engineFromCc;
    if (state.filters.engineToCc && engineToEl) engineToEl.value = state.filters.engineToCc;
    if (state.filters.powerFromHp && powerFromEl) powerFromEl.value = state.filters.powerFromHp;
    if (state.filters.powerToHp && powerToEl) powerToEl.value = state.filters.powerToHp;

    if (yearFromProxy && state.filters.yearFrom) yearFromProxy.value = state.filters.yearFrom;
    if (yearToProxy && state.filters.yearTo) yearToProxy.value = state.filters.yearTo;
    if (kmMinProxy && state.filters.kmMin) kmMinProxy.value = state.filters.kmMin;
    if (kmMaxProxy && state.filters.kmMax) kmMaxProxy.value = state.filters.kmMax;

    if (bodyTypeProxy && state.filters.bodyTypeId) bodyTypeProxy.value = state.filters.bodyTypeId;
    if (originProxy && state.filters.origin) originProxy.value = state.filters.origin;

    if (engineFromProxy && state.filters.engineFromCc) engineFromProxy.value = state.filters.engineFromCc;
    if (engineToProxy && state.filters.engineToCc) engineToProxy.value = state.filters.engineToCc;
    if (powerFromProxy && state.filters.powerFromHp) powerFromProxy.value = state.filters.powerFromHp;
    if (powerToProxy && state.filters.powerToHp) powerToProxy.value = state.filters.powerToHp;
  }

  function pushQuery() {
    const qs = new URLSearchParams();
    const f = state.filters;

    if (f.makeId) qs.set("makeId", f.makeId);

    if (f.yearFrom) qs.set("yearFrom", f.yearFrom);
    if (f.yearTo) qs.set("yearTo", f.yearTo);
    if (f.kmMin) qs.set("kmMin", f.kmMin);
    if (f.kmMax) qs.set("kmMax", f.kmMax);
    if (f.priceFrom) qs.set("priceFrom", f.priceFrom);
    if (f.priceTo) qs.set("priceTo", f.priceTo);

    if (f.bodyTypeId) qs.set("bodyTypeId", f.bodyTypeId);
    if (f.color) qs.set("color", f.color);
    if (f.engineFromCc) qs.set("engineFromCc", f.engineFromCc);
    if (f.engineToCc) qs.set("engineToCc", f.engineToCc);
    if (f.powerFromHp) qs.set("powerFromHp", f.powerFromHp);
    if (f.powerToHp) qs.set("powerToHp", f.powerToHp);
    if (f.origin) qs.set("origin", f.origin);

    (f.fuelIds || []).forEach((id) => qs.append("fuel", String(id)));
    (f.gearboxIds || []).forEach((id) => qs.append("gearbox", String(id)));
    (f.featureIds || []).forEach((id) => qs.append("features", String(id)));

    if (state.sort && state.sort !== "new") qs.set("sort", state.sort);

    const url = "catalog.html" + (qs.toString() ? "?" + qs.toString() : "");
    history.replaceState(null, "", url);
  }

  // =============== Utils ===============
  function debounce(fn, ms = 150) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function safeParseJSON(str) {
    try {
      const v = JSON.parse(str);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatInt(v) {
    const n = Number(v || 0);
    return n ? n.toLocaleString("bg-BG", { maximumFractionDigits: 0 }) : "0";
  }

  function formatKm(km) {
    const n = Number(km);
    if (!n) return "";
    return n.toLocaleString("bg-BG") + " км";
  }

  // ===== PRICE HELPERS =====
  const EUR_TO_BGN = 1.95583;

  function normalizePrice(amount, currency) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return null;

    const c = String(currency || "EUR").trim().toUpperCase();

    if (c === "EUR" || c === "€") {
      return {
        eur: Math.round(n),
        bgn: Math.round(n * EUR_TO_BGN),
      };
    }

    if (c === "BGN" || c === "ЛВ" || c === "LV" || c === "ЛЕВА") {
      return {
        eur: Math.round(n / EUR_TO_BGN),
        bgn: Math.round(n),
      };
    }

    // unknown -> treat as EUR, пак да имаш и BGN
    return {
      eur: Math.round(n),
      bgn: Math.round(n * EUR_TO_BGN),
    };
  }

  // Връща "final" | "estimate" | null
  function getPriceType(row) {
    const v =
      row.price_type ??
      row.priceType ??
      row.price_kind ??
      row.priceKind ??
      row.is_price_final ??
      row.isPriceFinal ??
      row.price_is_final ??
      row.priceIsFinal ??
      row.final_price ??
      row.finalPrice ??
      row.is_final ??
      row.isFinal ??
      null;

    if (typeof v === "boolean") return v ? "final" : "estimate";

    const s = String(v || "").trim().toLowerCase();
    if (!s) return null;

    // мапване на най-чести варианти
    if (["final", "fixed", "exact", "крайна", "окончателна", "true", "1", "yes"].includes(s)) return "final";
    if (["estimate", "estimated", "approx", "provisional", "прогнозна", "ориентировъчна", "false", "0", "no"].includes(s))
      return "estimate";

    // ако идва като "2"/"3" и т.н. – не гадая, по-добре null
    return null;
  }

  function mobileFocusStyling() {
    document.body.addEventListener(
      "touchstart",
      (e) => {
        const chip = e.target.closest(".chip, .tag, .btn");
        if (!chip) return;
        chip.classList.add("is-touched");
        setTimeout(() => chip.classList.remove("is-touched"), 180);
      },
      { passive: true }
    );
  }

  // =============== Mobile: auto-hide филтри + сортиране ===============
  function initMobileAutoHideCatalogHead() {
    if (!isMobile) return;

    const filters = document.querySelector(".catalog-filters");
    const toolbar = document.querySelector(".catalog-toolbar");
    const targets = [filters, toolbar].filter(Boolean);
    if (!targets.length) return;

    let lastY = window.scrollY;
    let hidden = false;
    let ticking = false;

    function setHidden(h) {
      if (hidden === h) return;
      hidden = h;
      targets.forEach((el) => {
        el.classList.toggle("is-hidden-mobile", h);
      });
    }

    function handleScroll() {
      const currentY = window.scrollY;
      const delta = currentY - lastY;

      if (Math.abs(delta) < 5) {
        lastY = currentY;
        ticking = false;
        return;
      }

      if (delta > 0 && currentY > 80) setHidden(true);
      if (delta < 0) setHidden(false);

      lastY = currentY;
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(handleScroll);
        }
      },
      { passive: true }
    );
  }
});

// =========================
// Quick search (cards) - mobile + desktop
// =========================
(function quickSearchCards() {
  // guard да не се инжектира 2 пъти
  if (document.getElementById("mQuickSearch")) return;

  const cardsWrap = document.getElementById("cards");
  if (!cardsWrap) return;

  const resultsSection = cardsWrap.closest(".results") || cardsWrap.parentElement;
  if (!resultsSection) return;

  // UI
  const bar = document.createElement("div");
  bar.className = "m-quicksearch";
  bar.innerHTML = `
    <div class="m-quicksearch__row">
      <input class="m-quicksearch__input" id="mQuickSearch"
        type="search" inputmode="search" autocomplete="off"
        placeholder="Търси: BMW 6 / X6M / M6 / Audi A6…">
      <button class="m-quicksearch__clear" id="mQuickClear" type="button" aria-label="Изчисти">✕</button>
    </div>
  `;
  resultsSection.insertBefore(bar, cardsWrap);

  const input = bar.querySelector("#mQuickSearch");
  const clearBtn = bar.querySelector("#mQuickClear");
  const emptyState = document.getElementById("emptyState");

  // normalize кирилица/латиница + х/h/x -> x, г -> g (и няколко бонуса)
  const charMap = {
    х: "x",
    Х: "x",
    h: "x",
    H: "x",
    x: "x",
    X: "x",
    г: "g",
    Г: "g",

    // бонус (по форма)
    а: "a",
    А: "a",
    е: "e",
    Е: "e",
    к: "k",
    К: "k",
    м: "m",
    М: "m",
    н: "n",
    Н: "n",
    о: "o",
    О: "o",
    р: "r",
    Р: "r",
    с: "s",
    С: "s",
    т: "t",
    Т: "t",
    у: "u",
    У: "u",
  };

  function norm(s) {
    return (s || "")
      .trim()
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u2010-\u2015]/g, "-") // тирета -> "-"
      .replace(/[a-z0-9а-я]/gi, (ch) => charMap[ch] ?? ch) // мап
      .replace(/[^a-z0-9]+/gi, " ") // само лат + цифри
      .replace(/([a-z])(\d)/g, "$1 $2") // буква+цифра -> разделяне
      .replace(/(\d)([a-z])/g, "$1 $2") // цифра+буква -> разделяне
      .replace(/\s+/g, " ")
      .trim();
  }

  function indexCards() {
    const cards = cardsWrap.querySelectorAll(".card");
    cards.forEach((card) => {
      if (card.dataset.qindex) return;
      card.dataset.qindex = norm(card.innerText || card.textContent || "");
    });
  }

  function apply() {
    indexCards();

    const q = norm(input.value);
    const tokens = q ? q.split(" ").filter(Boolean) : [];

    let shown = 0;
    const cards = cardsWrap.querySelectorAll(".card");

    cards.forEach((card) => {
      const hay = card.dataset.qindex || "";
      const ok = tokens.length === 0 || tokens.every((t) => hay.includes(t));
      card.style.display = ok ? "" : "none";
      if (ok) shown++;
    });

    if (emptyState) emptyState.classList.toggle("hidden", shown > 0);
  }

  // debounce input
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 80);
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    apply();
    input.focus();
  });

  // ✅ debounced observer (по-малко CPU на мобилни)
  let obsT = null;
  const obs = new MutationObserver(() => {
    clearTimeout(obsT);
    obsT = setTimeout(() => {
      cardsWrap.querySelectorAll(".card").forEach((c) => {
        delete c.dataset.qindex;
      });
      apply();
    }, 120);
  });
  obs.observe(cardsWrap, { childList: true, subtree: true });

  apply();

  
})();
// =========================
// Active chips: always remove visually on ×
// =========================
(function () {
  const wrap = document.getElementById('activeChips');
  if (!wrap) return;

  wrap.addEventListener('click', function (e) {
    const x = e.target.closest('.chip__x');
    if (!x) return;

    const chip = x.closest('.chip');
    if (!chip) return;

    chip.classList.add('is-removing');
    setTimeout(() => {
      chip.remove();
    }, 160);
  });
})();
