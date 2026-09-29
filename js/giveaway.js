// js/giveaway.js
// Стъпков запис за играта: 1) последвай → 2) данни → 3) Viber.
// Изпраща към Google Sheet (Apps Script Web App) и проверява за дубликати.
(function () {
  "use strict";

  var CFG = window.GIVEAWAY_CONFIG || {};
  var K_DONE = "ad_gw_registered";   // стар флаг – само го чистим
  var K_DATA = "ad_gw_data";

  function $(id) { return document.getElementById(id); }
  function qa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  var form = $("gwForm");
  if (!form) return;

  var panes    = qa(".gw-pane");
  var steps    = qa(".gw-stepper__i");
  var alertBox = $("gwAlert");
  var submitBtn = $("gwSubmit");

  /* =========================================================
     1) Данни от конфигурацията
     ========================================================= */
  function applyConfig() {
    // Заглавието на страницата е в HTML-а (с жълтото "Camaro-то"); CFG.title е за pop-up-а.
    if (CFG.prize) {
      var p = $("gwPrize");
      if (p) p.textContent = CFG.prize;
    }

    var ig = CFG.instagram || "https://www.instagram.com/atlanticdrive.bg/";
    var vb = CFG.viberGroup || "#";

    setHref("gwOpenIg", ig);
    setHref("gwOpenViber", vb);
    setHref("gwViberBtn", vb);
    setHref("gwViberBtn2", vb);

    var handle = igHandleFromUrl(ig);
    if (handle) {
      var s = document.querySelector("#gwBlockIg .gw-follow__s");
      if (s) s.textContent = "@" + handle;
    }
  }

  function setHref(id, url) {
    var el = $(id);
    if (el) el.href = url;
  }

  function igHandleFromUrl(url) {
    var m = String(url || "").match(/instagram\.com\/([^\/?#]+)/i);
    return m ? m[1] : "";
  }

  /* =========================================================
     1б) Хиро с клипа: клипът → надписите остават
     ========================================================= */
  function startVideoHero() {
    var hero  = $("gwVh");
    var video = $("gwVhVideo");
    if (!hero || !video) return;

    var MAX_WAIT_MS = 12000;   // ако клипът не тръгне – показваме надписите така или иначе
    var ended = false;

    // хирото започва под фиксираната навигация и взима останалата височина
    var nav = document.querySelector(".nav");
    function fitNav() {
      if (nav) hero.style.setProperty("--gw-nav-h", nav.offsetHeight + "px");
    }
    fitNav();
    window.addEventListener("resize", fitNav);

    function showCaptions() {
      if (ended) return;
      ended = true;
      hero.classList.add("is-ended");
    }

    video.addEventListener("ended", showCaptions);

    // и последният <source> не става → направо надписите
    var sources = video.querySelectorAll("source");
    var lastSrc = sources[sources.length - 1];
    if (lastSrc) lastSrc.addEventListener("error", showCaptions);

    // предпазител: броим от момента, в който клипът реално тръгне
    var guard = setTimeout(showCaptions, MAX_WAIT_MS);
    video.addEventListener("playing", function () {
      clearTimeout(guard);
      var left = ((video.duration || 6) - video.currentTime) * 1000;
      guard = setTimeout(showCaptions, left + 2500);
    });

    var p = video.play();
    if (p && p.catch) p.catch(showCaptions);  // autoplay блокиран (напр. Low Power Mode)

    // на компютър текстът е до клипа, не върху него – показваме го веднага
    if (window.matchMedia("(min-aspect-ratio: 1/1)").matches) showCaptions();

    // бутоните в хирото скролват до секцията
    [["gwVhCta", "gwJoin"], ["gwVhHow", "gwDraw"]].forEach(function (pair) {
      var btn = $(pair[0]);
      if (btn) btn.addEventListener("click", function (e) {
        e.preventDefault();
        scrollToEl($(pair[1]));
      });
    });

    var more = hero.querySelector(".gw-vh__more");
    if (more) more.addEventListener("click", function (e) {
      e.preventDefault();
      scrollToEl($("gwMain"));
    });
  }

  // style.css слага html/body{height:100%} + overflow-x:hidden – тогава window.scrollTo
  // не мърда страницата. scrollIntoView работи с какъвто и да е контейнер;
  // отстъпът за навигацията идва от scroll-margin-top в CSS.
  function scrollToEl(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* =========================================================
     2) Колата – сменя ракурсите автоматично, точките – ръчно
     ========================================================= */
  function startCarRotator() {
    var box = $("gwCar");
    if (!box) return;
    var imgs = Array.prototype.slice.call(box.querySelectorAll(".gw-car__img"));
    var dots = Array.prototype.slice.call(box.querySelectorAll(".gw-car__dot"));
    if (imgs.length < 2) return;

    var EVERY = 4200;
    var idx = 0;
    var timer = null;

    function show(n) {
      if (n === idx) return;
      var prev = imgs[idx];
      prev.classList.remove("is-active");
      prev.classList.add("is-leaving");
      setTimeout(function () { prev.classList.remove("is-leaving"); }, 900);

      idx = (n + imgs.length) % imgs.length;
      imgs[idx].classList.add("is-active");
      dots.forEach(function (d, i) {
        d.classList.toggle("is-active", i === idx);
        if (i === idx) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
    }

    function play() {
      clearInterval(timer);
      timer = setInterval(function () { show(idx + 1); }, EVERY);
    }

    dots.forEach(function (d, i) {
      d.addEventListener("click", function () { show(i); play(); });
    });

    // свайп на телефон
    var x0 = null;
    box.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 40) return;
      show(idx + (dx < 0 ? 1 : -1));
      play();
    }, { passive: true });

    // пауза, когато табът е скрит
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) clearInterval(timer); else play();
    });

    play();
  }

  /* =========================================================
     3) Стъпки
     ========================================================= */
  var current = "1";

  function goStep(name, opts) {
    opts = opts || {};
    current = name;

    panes.forEach(function (p) {
      p.classList.toggle("is-active", p.getAttribute("data-pane") === name);
    });

    var index = name === "1" ? 1 : name === "2" ? 2 : 3;
    steps.forEach(function (s) {
      var n = parseInt(s.getAttribute("data-step"), 10);
      s.classList.toggle("is-current", n === index);
      s.classList.toggle("is-done", n < index);
      if (n === index) s.setAttribute("aria-current", "step");
      else s.removeAttribute("aria-current");
    });

    if (opts.scroll !== false) {
      scrollToEl(document.querySelector(".gw-card"));
    }
    if (opts.focus) {
      var el = $(opts.focus);
      if (el) setTimeout(function () { el.focus(); }, 280);
    }
  }

  /* ---- стъпка 1: потвърждения ---- */
  var chkIg     = $("gwFollowIg");
  var chkViber  = $("gwJoinViber");
  var chkInvite = $("gwInvited");
  var next1 = $("gwNext1");
  var hint1 = $("gwHint1");

  var STEP1 = [
    { box: chkIg,     block: $("gwBlockIg") },
    { box: chkViber,  block: $("gwBlockViber") },
    { box: chkInvite, block: $("gwBlockInvite") }
  ];

  function refreshStep1() {
    var left = 0;

    STEP1.forEach(function (item) {
      if (!item.box) return;
      if (item.block) item.block.classList.toggle("is-done", item.box.checked);
      if (!item.box.checked) left++;
    });

    var ok = left === 0;
    if (next1) next1.disabled = !ok;

    if (hint1) {
      hint1.classList.remove("is-warn");
      hint1.textContent = ok
        ? "Готово. Продължи към данните."
        : (left === 1 ? "Остана едно условие." : "Потвърди и трите, за да продължиш.");
    }
  }

  STEP1.forEach(function (item) {
    if (item.box) item.box.addEventListener("change", refreshStep1);
  });

  /* ---- споделяне на Viber линка ---- */
  var shareBtn = $("gwShareViber");
  if (shareBtn) {
    shareBtn.addEventListener("click", async function () {
      var url = CFG.viberGroup || "";
      if (!url) return;

      var label = shareBtn.innerHTML;
      function flash(text) {
        shareBtn.textContent = text;
        setTimeout(function () { shareBtn.innerHTML = label; }, 1800);
      }

      var data = {
        title: "Atlantic Drive",
        text: "Влез в Viber групата на Atlantic Drive — коли от САЩ, Канада и Корея:",
        url: url
      };

      try {
        if (navigator.share) { await navigator.share(data); return; }
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(url);
          flash("Копирано");
          return;
        }
        window.prompt("Копирай линка и го прати на приятелите си:", url);
      } catch (err) {
        // отказано споделяне – без съобщение
      }
    });
  }

  // клик върху "Отвори" не цъка чекбокса
  qa(".gw-follow__open").forEach(function (a) {
    a.addEventListener("click", function (e) { e.stopPropagation(); });
  });

  if (next1) {
    next1.addEventListener("click", function () {
      if (next1.disabled) return;
      goStep("2", { focus: "gwFirstName" });
    });
  }

  var back2 = $("gwBack2");
  if (back2) back2.addEventListener("click", function () { goStep("1"); });

  /* =========================================================
     4) Нормализация
     ========================================================= */
  function normName(v) {
    return String(v || "").trim().replace(/\s+/g, " ");
  }

  function normPhone(v) {
    var d = String(v || "").replace(/[^\d+]/g, "");
    d = d.replace(/^00/, "+");
    if (/^\+359/.test(d))     d = "+359" + d.slice(4).replace(/^0+/, "");
    else if (/^359/.test(d))  d = "+359" + d.slice(3).replace(/^0+/, "");
    else if (/^0/.test(d))    d = "+359" + d.slice(1);
    else if (!/^\+/.test(d))  d = "+359" + d;
    return d;
  }

  function normEmail(v) { return String(v || "").trim().toLowerCase(); }

  function normInstagram(v) {
    var s = String(v || "").trim();
    s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    s = s.replace(/^instagram\.com\//i, "");
    s = s.split("?")[0].split("#")[0];
    s = s.replace(/\/+$/, "").replace(/^@+/, "");
    return s.toLowerCase();
  }

  /* =========================================================
     5) Валидация
     ========================================================= */
  var NAME_RE  = /^[A-Za-zА-Яа-яЀ-ӿ' -]{2,40}$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  var IG_RE    = /^[a-z0-9._]{2,30}$/;

  var FIELDS = {
    firstName: $("gwFirstName"),
    lastName:  $("gwLastName"),
    phone:     $("gwPhone"),
    email:     $("gwEmail"),
    instagram: $("gwInstagram")
  };

  var RULES = {
    firstName: function (raw) {
      var v = normName(raw);
      if (!v) return "Въведи името си.";
      if (v.length < 2 || !NAME_RE.test(v)) return "Само букви, поне 2 знака.";
      return "";
    },
    lastName: function (raw) {
      var v = normName(raw);
      if (!v) return "Въведи фамилията си.";
      if (v.length < 2 || !NAME_RE.test(v)) return "Само букви, поне 2 знака.";
      return "";
    },
    phone: function (raw) {
      var v = String(raw || "").trim();
      if (!v) return "Въведи телефон за връзка.";
      var p = normPhone(v);
      if (/^\+359/.test(p)) {
        if (!/^\+3598[7-9]\d{7}$/.test(p)) return "Провери номера. Пример: 0888 123 456";
        return "";
      }
      if (!/^\+\d{8,15}$/.test(p)) return "Невалиден номер.";
      return "";
    },
    email: function (raw) {
      var v = normEmail(raw);
      if (!v) return "Въведи имейл.";
      if (!EMAIL_RE.test(v)) return "Провери имейла. Пример: ivan@email.com";
      return "";
    },
    instagram: function (raw) {
      var v = normInstagram(raw);
      if (!v) return "Въведи потребителското си име в Instagram.";
      if (!IG_RE.test(v)) return "Само малки букви, цифри, точка и долна черта.";
      return "";
    }
  };

  function wrapOf(input) { return input ? input.closest(".gw-f") : null; }

  function setFieldError(key, msg) {
    var input = FIELDS[key];
    var wrap = wrapOf(input);
    if (!wrap) return;
    var err = wrap.querySelector(".gw-f__err");
    if (msg) {
      wrap.classList.add("is-bad");
      if (err) err.textContent = msg;
      input.setAttribute("aria-invalid", "true");
    } else {
      wrap.classList.remove("is-bad");
      if (err) err.textContent = "";
      input.removeAttribute("aria-invalid");
    }
  }

  function validateField(key) {
    var input = FIELDS[key];
    if (!input) return true;
    var msg = RULES[key](input.value);
    setFieldError(key, msg);
    return !msg;
  }

  Object.keys(FIELDS).forEach(function (key) {
    var input = FIELDS[key];
    if (!input) return;
    input.addEventListener("blur", function () {
      if (input.value.trim()) validateField(key);
    });
    input.addEventListener("input", function () {
      var w = wrapOf(input);
      if (w && w.classList.contains("is-bad")) validateField(key);
      hideAlert();
    });
  });

  var gdpr = $("gwGdpr");
  var consentRow = $("gwConsentRow");
  if (gdpr) {
    gdpr.addEventListener("change", function () {
      if (consentRow && gdpr.checked) consentRow.classList.remove("is-bad");
      hideAlert();
    });
  }

  function validateStep2() {
    var firstBad = null;
    Object.keys(FIELDS).forEach(function (key) {
      if (!validateField(key) && !firstBad) firstBad = FIELDS[key];
    });

    if (firstBad) {
      firstBad.focus();
      return { ok: false, msg: "Провери маркираните полета." };
    }
    if (gdpr && !gdpr.checked) {
      if (consentRow) consentRow.classList.add("is-bad");
      return { ok: false, msg: "Нужно е съгласие за обработка на данните, за да те запишем." };
    }
    return { ok: true };
  }

  /* =========================================================
     6) Съобщения
     ========================================================= */
  function showAlert(msg) {
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.classList.add("is-on");
  }
  function hideAlert() {
    if (alertBox) alertBox.classList.remove("is-on");
  }
  function setBusy(on) {
    if (!submitBtn) return;
    submitBtn.disabled = on;
    submitBtn.classList.toggle("is-busy", on);
  }

  // Само за справка – НЕ блокира повторно отваряне на формата.
  // Проверката за дубликат се прави на сървъра при изпращане.
  function rememberLast(payload) {
    try {
      localStorage.setItem(K_DATA, JSON.stringify({
        instagram: payload.instagram,
        phone: payload.phone,
        at: new Date().toISOString()
      }));
    } catch (e) { /* private mode */ }
  }

  /* =========================================================
     7) Изпращане
     ========================================================= */
  function buildPayload() {
    return {
      campaign:   CFG.campaign || "giveaway",
      firstName:  normName(FIELDS.firstName.value),
      lastName:   normName(FIELDS.lastName.value),
      phone:      normPhone(FIELDS.phone.value),
      email:      normEmail(FIELDS.email.value),
      instagram:  normInstagram(FIELDS.instagram.value),
      followedIg:     !!(chkIg && chkIg.checked),
      joinedViber:    !!(chkViber && chkViber.checked),
      invitedFriends: !!(chkInvite && chkInvite.checked),
      consent:    !!(gdpr && gdpr.checked),
      source:     document.referrer || "direct",
      page:       location.href,
      userAgent:  navigator.userAgent
    };
  }

  async function send(payload) {
    var endpoint = (CFG.endpoint || "").trim();
    if (!endpoint) throw new Error("NO_ENDPOINT");

    // text/plain => "simple request", без CORS preflight към Apps Script
    var res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    var text = await res.text();
    var data = null;
    try { data = JSON.parse(text); } catch (e) { /* не е JSON */ }

    if (!data) {
      if (!res.ok) throw new Error("HTTP_" + res.status);
      return { ok: true, status: "created" };
    }
    return data;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideAlert();

    var v = validateStep2();
    if (!v.ok) { showAlert(v.msg); return; }

    var payload = buildPayload();
    setBusy(true);

    try {
      var data = await send(payload);

      if (data && data.ok) {
        rememberLast(payload);
        goStep("3");
        return;
      }

      if (data && (data.status === "duplicate" || data.code === "duplicate")) {
        rememberLast(payload);
        var by = data.field === "instagram" ? "Instagram профил"
               : data.field === "email"     ? "имейл"
               : "телефонен номер";
        showDuplicate("Вече имаме записване с този " + by +
          ". Един човек участва само веднъж, така че си в списъка.");
        return;
      }

      showAlert((data && data.message) || "Записването не мина. Опитай пак след минута.");

    } catch (err) {
      if (err && err.message === "NO_ENDPOINT") {
        showAlert("Формата още не е свързана с таблицата. Добави линка от Apps Script в js/giveaway-config.js.");
        console.warn("[GIVEAWAY] липсва GIVEAWAY_CONFIG.endpoint");
      } else {
        showAlert("Няма връзка със сървъра. Провери интернета и опитай пак, или ни пиши на office@atlanticdrive.bg.");
        console.error("[GIVEAWAY]", err);
      }
    } finally {
      setBusy(false);
    }
  });

  /* =========================================================
     8) Вече записан
     ========================================================= */
  function showDuplicate(msg, opts) {
    if (msg) {
      var t = $("gwDupTxt");
      if (t) t.textContent = msg;
    }
    goStep("dup", opts);
  }

  var another = $("gwAnother");
  if (another) {
    another.addEventListener("click", function (e) {
      e.preventDefault();
      form.reset();
      Object.keys(FIELDS).forEach(function (k) {
        var w = wrapOf(FIELDS[k]);
        if (w) w.classList.remove("is-bad");
      });
      if (consentRow) consentRow.classList.remove("is-bad");
      hideAlert();
      refreshStep1();
      goStep("1");
    });
  }

  /** ?reset=1 в адреса – изчиства паметта на браузъра (за тестове). */
  function handleReset() {
    if (!/[?&]reset=1\b/.test(location.search)) return false;
    try {
      localStorage.removeItem(K_DONE);
      localStorage.removeItem(K_DATA);
      localStorage.removeItem("ad_gw_popup_snooze");
      localStorage.removeItem("ad_gw_tip_seen");
    } catch (e) { /* private mode */ }

    // маха ?reset=1 от адреса, за да не остане в линка
    if (window.history && history.replaceState) {
      history.replaceState(null, "", location.pathname + location.hash);
    }
    console.info("[GIVEAWAY] Паметта на браузъра е изчистена.");
    return true;
  }

  /* ---------------- init ---------------- */
  applyConfig();
  startVideoHero();
  startCarRotator();
  refreshStep1();
  handleReset();
})();
