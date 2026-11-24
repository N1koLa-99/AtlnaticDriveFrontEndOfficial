// js/zapitvane.js
// Самостоятелна форма за запитване (линк за Meta реклами).
// Праща към същия endpoint като "Бърза връзка": /api/public/clients
// Lead към Meta Pixel се праща САМО след успешен отговор от API-то.

document.addEventListener("DOMContentLoaded", () => {
  const form      = document.getElementById("cbForm");
  const successEl = document.getElementById("lpSuccess");
  const errorEl   = document.getElementById("lpError");
  const submitBtn = form?.querySelector('button[type="submit"]');
  if (!form) return;

  // ---------- UTM от рекламата ----------
  const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];

  function readUtm() {
    const qs = new URLSearchParams(location.search);
    const found = {};
    UTM_KEYS.forEach((k) => {
      const v = qs.get(k);
      if (v) found[k] = v.slice(0, 200);
    });

    // пазим ги за сесията, ако човекът презареди страницата
    try {
      if (Object.keys(found).length) sessionStorage.setItem("ad_utm", JSON.stringify(found));
      else return JSON.parse(sessionStorage.getItem("ad_utm") || "{}");
    } catch (_) { /* private mode */ }

    return found;
  }

  const utm = readUtm();

  // ---------- валидация (същата като в popup-а) ----------
  const onlyDigitsPlus = (s) => String(s || "").replace(/[^\d+]/g, "");
  const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

  function validateName(value) {
    const v = String(value || "").trim().replace(/\s+/g, " ");
    if (!v) return "Моля, попълни име и фамилия";
    const parts = v.split(" ").filter(Boolean);
    if (parts.length < 2) return "Добави фамилия (пример: Иван Иванов)";
    if (parts.some((p) => p.length < 2)) return "Името е прекалено кратко";
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
    if (/^(\d)\1+$/.test(digits)) return "Телефонът изглежда невалиден";
    if (digits.length === 10 && !digits.startsWith("0")) return "За BG номер започни с 0 (пример: 088...)";
    if (cleaned.startsWith("+359") && !/^\+359\d{8,9}$/.test(cleaned)) return "Невалиден формат +359";
    if (digits.startsWith("08") && !/^08\d{8}$/.test(digits)) return "Невалиден BG мобилен номер";
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
    const n = Number(raw.replace(/\s+/g, "").replace(",", "."));
    if (!Number.isFinite(n)) return "Бюджетът трябва да е число";
    if (n <= 0) return "Бюджетът трябва да е положителен";
    return "";
  }

  const validators = {
    cbName: validateName,
    cbPhone: validatePhone,
    cbEmail: validateEmail,
    cbYear: validateYear,
    cbBudget: validateBudget,
  };

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

  function validateOne(el) {
    const fn = validators[el.id];
    if (!fn) return true;
    const msg = fn(el.value);
    setFieldState(el, msg);
    return !msg;
  }

  function validateAll() {
    let ok = true;
    let firstBad = null;
    Object.keys(validators).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!validateOne(el)) {
        ok = false;
        if (!firstBad) firstBad = el;
      }
    });
    if (firstBad) firstBad.focus();
    return ok;
  }

  ["blur", "change"].forEach((evName) => {
    form.addEventListener(evName, (e) => {
      const el = e.target;
      if (el instanceof HTMLElement && validators[el.id]) validateOne(el);
    }, true);
  });

  // ---------- submit ----------
  let isSubmitting = false;

  function setSubmitting(on) {
    isSubmitting = on;
    if (!submitBtn) return;
    submitBtn.disabled = on;
    submitBtn.classList.toggle("is-loading", on);
  }

  function showError(on) {
    if (!errorEl) return;
    if (on) {
      errorEl.innerHTML = 'Нещо се обърка и заявката не мина. Опитайте пак или звъннете на <a href="tel:+359878119140">0878 119 140</a>.';
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;
    }
  }

  const val = (id) => (document.getElementById(id)?.value || "").trim();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    showError(false);
    if (!validateAll()) return;

    setSubmitting(true);

    const nameVal   = val("cbName").replace(/\s+/g, " ");
    const phoneVal  = val("cbPhone");
    const emailVal  = val("cbEmail");
    const brandVal  = val("cbBrand");
    const modelVal  = val("cbModel");
    const descVal   = val("cbDesc");
    const yearRaw   = val("cbYear");
    const budgetRaw = val("cbBudget").replace(/\s+/g, "");

    const yearNum   = yearRaw ? Number(yearRaw) : null;
    const budgetNum = budgetRaw ? Number(budgetRaw.replace(",", ".")) : null;

    const utmLines = Object.keys(utm).length
      ? "\n" + Object.entries(utm).map(([k, v]) => `${k}: ${v}`).join("\n")
      : "";

    const message =
`Източник: Meta реклама (страница за запитване)${utmLines}

Име и фамилия: ${nameVal}
Телефон: ${phoneVal}
Имейл: ${emailVal || "-"}
Марка: ${brandVal || "-"}
Модел: ${modelVal || "-"}
Година от: ${yearNum ? String(yearNum) : "-"}
Бюджет: ${budgetNum ? budgetNum.toLocaleString("bg-BG") : "-"}

Кратко описание:
${descVal || "-"}`;

    try {
      if (!window.AD_API || typeof window.AD_API.apiPost !== "function") {
        throw new Error("API не е заредено");
      }

      // apiPost хвърля грешка при всеки не-2xx отговор
      await window.AD_API.apiPost("/api/public/clients", {
        Name: nameVal,
        Phone: phoneVal,
        Email: emailVal || null,
        DesiredMakeName: brandVal || null,
        DesiredModelName: modelVal || null,
        DesiredYear: yearNum,
        BudgetMaxAmount: budgetNum,
        InitialNote: message,
      });

      // ✅ успешно записано -> Lead към Meta
      if (typeof window.adTrackLead === "function") {
        window.adTrackLead({ content_name: "Страница за запитване" });
      }

      form.hidden = true;
      if (successEl) successEl.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Грешка при изпращане на запитване:", err);
      showError(true);
      setSubmitting(false);
    }
  });
});
