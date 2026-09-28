// js/giveaway-promo.js
// Плаващ кръгъл бутон (долу вдясно) + pop-up след N секунди.
// Самостоятелен модул – инжектира си собствения CSS, не пипа навигацията и останалия сайт.
(function () {
  "use strict";

  var CFG = window.GIVEAWAY_CONFIG || {};
  var PAGE   = CFG.pageUrl || "giveaway.html";
  var DELAY  = typeof CFG.popupDelayMs === "number" ? CFG.popupDelayMs : 10000;
  var SNOOZE = (typeof CFG.popupSnoozeHours === "number" ? CFG.popupSnoozeHours : 0) * 3600 * 1000;

  var K_DONE  = "ad_gw_registered";   // стар флаг – само го чистим при reset
  var K_SNOOZ = "ad_gw_popup_snooze"; // докога да не показваме pop-up
  var K_TIP   = "ad_gw_tip_seen";     // стар ключ – само го чистим при reset

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { /* private mode */ }
    return null;
  }


  /** ?reset=1 в адреса – изчиства паметта на браузъра (за тестове). */
  function handleReset() {
    if (!/[?&]reset=1\b/.test(location.search)) return;
    try {
      localStorage.removeItem(K_DONE);
      localStorage.removeItem(K_SNOOZ);
      localStorage.removeItem(K_TIP);
      localStorage.removeItem("ad_gw_data");
    } catch (e) { /* private mode */ }
    if (window.history && history.replaceState) {
      history.replaceState(null, "", location.pathname + location.hash);
    }
    console.info("[GIVEAWAY] Паметта на браузъра е изчистена.");
  }

  function snoozed() {
    if (SNOOZE <= 0) return false;   // 0 часа = показва се при всяко влизане
    var until = parseInt(store(K_SNOOZ) || "0", 10);
    return until && Date.now() < until;
  }

  /* ---------------- CSS ---------------- */
  function injectStyles() {
    if (document.getElementById("gwPromoStyles")) return;
    var css = [
      ':root{ --gw-fab-size:64px; --gw-fab-bottom:22px; --gw-fab-right:18px; }',

      /* ---------- FAB ---------- */
      '.gw-fab{position:fixed;right:var(--gw-fab-right);bottom:var(--gw-fab-bottom);z-index:1100;',
      'width:var(--gw-fab-size);height:var(--gw-fab-size);border-radius:50%;border:0;padding:0;cursor:pointer;',
      'display:grid;place-items:center;color:#fff;text-decoration:none;',
      'background:linear-gradient(135deg,#1f5eff 0%,#4be1ff 100%);',
      'box-shadow:0 14px 30px rgba(31,94,255,.42), 0 2px 8px rgba(3,12,38,.35), inset 0 1px 0 rgba(255,255,255,.35);',
      'opacity:0;transform:translateY(18px) scale(.85);',
      'transition:opacity .4s ease, transform .4s cubic-bezier(.2,.9,.3,1.3), box-shadow .2s ease;}',
      '.gw-fab.is-in{opacity:1;transform:translateY(0) scale(1)}',
      '.gw-fab:hover{box-shadow:0 18px 38px rgba(31,94,255,.55), 0 2px 10px rgba(3,12,38,.4)}',
      '.gw-fab:active{transform:scale(.94)}',
      '.gw-fab:focus-visible{outline:3px solid #fff;outline-offset:3px}',

      /* иконата се клати */
      '.gw-fab__ico{display:block;font-size:30px;line-height:1;transform-origin:50% 15%;',
      'filter:drop-shadow(0 2px 4px rgba(0,0,0,.28));animation:gw-swing 3.4s ease-in-out infinite}',
      '@keyframes gw-swing{',
      '0%,62%,100%{transform:rotate(0)}',
      '66%{transform:rotate(-16deg)}70%{transform:rotate(13deg)}',
      '74%{transform:rotate(-10deg)}78%{transform:rotate(8deg)}',
      '82%{transform:rotate(-5deg)}86%{transform:rotate(3deg)}90%{transform:rotate(0)}}',

      /* пулсиращи кръгове */
      '.gw-fab__ring{position:absolute;inset:0;border-radius:50%;pointer-events:none;',
      'border:2px solid rgba(75,225,255,.55);animation:gw-ring 2.6s cubic-bezier(.2,.6,.4,1) infinite}',
      '.gw-fab__ring--2{animation-delay:1.3s}',
      '@keyframes gw-ring{0%{transform:scale(1);opacity:.7}70%{transform:scale(1.65);opacity:0}100%{opacity:0}}',

      /* точка "ново" */
      '.gw-fab__dot{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;',
      'background:#ff4d6d;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)}',

      /* балонче с текст */
      '.gw-tip{position:fixed;z-index:1099;right:calc(var(--gw-fab-right) + var(--gw-fab-size) + 12px);',
      'bottom:calc(var(--gw-fab-bottom) + (var(--gw-fab-size) - 44px) / 2);',
      'max-width:230px;padding:10px 34px 10px 14px;border-radius:14px;',
      'color:#04163b;background:#fff;font-size:13.5px;font-weight:800;line-height:1.35;',
      'box-shadow:0 12px 30px rgba(3,12,38,.3);',
      'opacity:0;transform:translateX(10px) scale(.96);pointer-events:none;',
      'transition:opacity .3s ease, transform .3s cubic-bezier(.2,.9,.3,1.3)}',
      '.gw-tip.is-in{opacity:1;transform:none;pointer-events:auto}',
      '.gw-tip::after{content:"";position:absolute;right:-6px;top:50%;width:12px;height:12px;',
      'transform:translateY(-50%) rotate(45deg);background:#fff;border-radius:2px}',
      '.gw-tip small{display:block;font-weight:600;font-size:11.5px;color:#5b6b90;margin-top:2px}',
      '.gw-tip__x{position:absolute;top:5px;right:6px;width:22px;height:22px;border:0;border-radius:50%;',
      'background:rgba(6,29,75,.08);color:#3c4c72;font-size:15px;line-height:1;cursor:pointer;display:grid;place-items:center}',
      '.gw-tip__x:hover{background:rgba(6,29,75,.16)}',

      '@media (max-width:560px){',
      ':root{ --gw-fab-size:58px; --gw-fab-right:14px; }',
      '.gw-fab__ico{font-size:27px}',
      '.gw-tip{max-width:190px;font-size:12.5px;padding:9px 30px 9px 12px}',
      '}',

      '@media (prefers-reduced-motion: reduce){',
      '.gw-fab__ico{animation:none}.gw-fab__ring{display:none}',
      '.gw-fab,.gw-tip{transition:none}',
      '}',

      /* ---------- POPUP ---------- */
      '.gw-pop-back{position:fixed;inset:0;z-index:1400;background:rgba(4,14,40,.72);',
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .3s ease}',
      '.gw-pop-back.is-in{opacity:1}',
      '.gw-pop{position:fixed;inset:0;z-index:1401;display:grid;place-items:center;padding:18px;pointer-events:none}',
      '.gw-pop__card{pointer-events:auto;position:relative;width:min(520px,100%);max-height:92vh;overflow:auto;',
      'border-radius:24px;padding:30px 26px 26px;text-align:center;color:#fff;',
      'font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;',
      'background:linear-gradient(160deg,#0b2c6a 0%,#061d4b 60%,#04163b 100%);',
      'border:1px solid rgba(110,161,255,.35);box-shadow:0 30px 80px rgba(0,0,0,.55);',
      'opacity:0;transform:translateY(24px) scale(.96);transition:opacity .35s ease,transform .35s cubic-bezier(.2,.9,.3,1.2)}',
      '.gw-pop.is-in .gw-pop__card{opacity:1;transform:translateY(0) scale(1)}',
      '.gw-pop__glow{position:absolute;inset:-40% -20% auto -20%;height:320px;pointer-events:none;',
      'background:radial-gradient(closest-side,rgba(75,225,255,.28),transparent 70%)}',
      '.gw-pop__x{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.25);',
      'background:rgba(255,255,255,.08);color:#fff;font-size:20px;line-height:1;cursor:pointer;display:grid;place-items:center}',
      '.gw-pop__x:hover{background:rgba(255,255,255,.18)}',
      '.gw-pop__badge{display:inline-flex;align-items:center;gap:7px;padding:6px 14px;border-radius:999px;font-size:12px;',
      'font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#04163b;background:linear-gradient(135deg,#4be1ff,#6ea1ff)}',
      '.gw-pop__gift{font-size:52px;line-height:1;margin:14px 0 6px;display:block;animation:gw-float 3s ease-in-out infinite}',
      '.gw-pop__img{display:block;width:100%;max-width:400px;height:auto;margin:10px auto 4px;',
      'filter:drop-shadow(0 18px 26px rgba(0,0,0,.45));animation:gw-float 4s ease-in-out infinite}',
      '@media (max-width:420px){ .gw-pop__img{max-width:280px} }',
      '@keyframes gw-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}',
      '.gw-pop__title{margin:6px 0 8px;font-size:clamp(22px,4.6vw,30px);font-weight:900;line-height:1.15}',
      '.gw-pop__prize{margin:0 auto 14px;max-width:400px;color:#c9d7ff;font-size:15px;line-height:1.55}',
      '.gw-pop__timer{display:flex;justify-content:center;gap:8px;margin:16px 0 18px}',
      '.gw-pop__timer b{display:block;font-size:20px}',
      '.gw-pop__timer span{min-width:62px;padding:8px 6px;border-radius:14px;font-size:10.5px;letter-spacing:.08em;',
      'text-transform:uppercase;color:#c9d7ff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14)}',
      '.gw-pop__btn{display:block;width:100%;padding:15px 18px;border-radius:16px;border:0;cursor:pointer;',
      'font-size:16.5px;font-weight:900;color:#fff;text-decoration:none;',
      'background:linear-gradient(135deg,#1f5eff,#4be1ff);box-shadow:0 16px 34px rgba(31,94,255,.4);',
      'transition:transform .12s ease,filter .15s ease}',
      '.gw-pop__btn:hover{transform:translateY(-2px);filter:brightness(1.05)}',
      '.gw-pop__later{margin-top:12px;background:none;border:0;color:#9fb6e8;font-size:13px;cursor:pointer;text-decoration:underline}',
      '.gw-pop__later:hover{color:#fff}',
      '.gw-pop__note{margin:14px 0 0;font-size:12px;color:#8fa6d8}',
      '@media (max-width:420px){ .gw-pop__card{padding:26px 18px 20px;border-radius:20px} }'
    ].join("");

    var st = document.createElement("style");
    st.id = "gwPromoStyles";
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------------- countdown ---------------- */
  function timeLeft() {
    if (!CFG.endsAt) return null;
    var end = new Date(CFG.endsAt).getTime();
    if (isNaN(end)) return null;
    var d = end - Date.now();
    if (d <= 0) return null;
    return {
      d: Math.floor(d / 86400000),
      h: Math.floor(d / 3600000) % 24,
      m: Math.floor(d / 60000) % 60,
      s: Math.floor(d / 1000) % 60
    };
  }

  /* ---------------- FAB ---------------- */
  function placeFab() {
    // Ако на страницата има бутон за контакт долу вдясно – качваме giveaway бутона над него.
    var other = document.querySelector(".fab-contact");
    if (!other) return;

    function apply() {
      var r = other.getBoundingClientRect();
      if (!r.width || !r.height) return;   // скрит бутон – оставяме позицията по подразбиране
      var gap = 14;
      var bottomOffset = Math.max(0, window.innerHeight - r.bottom);
      document.documentElement.style.setProperty(
        "--gw-fab-bottom", (bottomOffset + r.height + gap) + "px"
      );
      var rightOffset = Math.max(0, window.innerWidth - r.right);
      document.documentElement.style.setProperty("--gw-fab-right", rightOffset + "px");
    }

    apply();
    window.addEventListener("resize", apply);
  }

  function buildFab() {
    if (CFG.showFab === false || CFG.showTopBar === false) return;
    if (document.querySelector(".gw-fab")) return;

    var fab = document.createElement("a");
    fab.className = "gw-fab";
    fab.href = PAGE;
    fab.id = "gwFab";
    fab.setAttribute("aria-label", "Участие в giveaway");
    fab.innerHTML =
      '<span class="gw-fab__ring" aria-hidden="true"></span>' +
      '<span class="gw-fab__ring gw-fab__ring--2" aria-hidden="true"></span>' +
      '<span class="gw-fab__dot" aria-hidden="true"></span>' +
      '<span class="gw-fab__ico" aria-hidden="true">🎁</span>';

    document.body.appendChild(fab);
    placeFab();
    setTimeout(function () { fab.classList.add("is-in"); }, 600);

    buildTip(fab);
  }

  function buildTip(fab) {
    var SHOW_MS = typeof CFG.tipShowMs === "number" ? CFG.tipShowMs : 5000;  // видимо
    var HIDE_MS = typeof CFG.tipHideMs === "number" ? CFG.tipHideMs : 3000;  // скрито
    var FIRST_MS = 1200;   // колко след появата на бутона тръгва цикълът

    var tip = document.createElement("div");
    tip.className = "gw-tip";
    tip.setAttribute("role", "note");
    tip.innerHTML =
      '<button class="gw-tip__x" type="button" aria-label="Скрий">&times;</button>' +
      'Участие в giveaway<small>Записването е безплатно</small>';

    document.body.appendChild(tip);

    var timer = null;
    var stopped = false;   // затворено с ✕
    var held = false;      // курсорът стои върху бутона

    function clear() { clearTimeout(timer); timer = null; }

    function showPhase() {
      if (stopped) return;
      tip.classList.add("is-in");
      clear();
      timer = setTimeout(hidePhase, SHOW_MS);
    }

    function hidePhase() {
      if (stopped) return;
      if (held) {                       // не крием, докато е под курсора
        timer = setTimeout(hidePhase, 600);
        return;
      }
      tip.classList.remove("is-in");
      clear();
      timer = setTimeout(showPhase, HIDE_MS);
    }

    // Цикълът: 5 сек. видимо → 3 сек. скрито → отначало
    timer = setTimeout(showPhase, FIRST_MS);

    // Hover/фокус – задържа балончето, докато курсорът е там
    function hold() {
      if (stopped) return;
      held = true;
      showPhase();
    }
    function release() {
      held = false;
    }

    fab.addEventListener("mouseenter", hold);
    fab.addEventListener("mouseleave", release);
    fab.addEventListener("focus", hold);
    fab.addEventListener("blur", release);
    tip.addEventListener("mouseenter", hold);
    tip.addEventListener("mouseleave", release);

    // ✕ спира цикъла до края на посещението
    tip.addEventListener("click", function (e) {
      if (e.target.closest(".gw-tip__x")) {
        e.preventDefault();
        stopped = true;
        held = false;
        clear();
        tip.classList.remove("is-in");
        return;
      }
      location.href = PAGE;
    });
  }

  /* ---------------- popup ---------------- */
  function buildPopup() {
    if (document.querySelector(".gw-pop")) return;

    var tl = timeLeft();
    var timerHtml = "";
    if (tl) {
      timerHtml =
        '<div class="gw-pop__timer" id="gwPopTimer">' +
        '<span><b data-u="d">' + tl.d + '</b>дни</span>' +
        '<span><b data-u="h">' + tl.h + '</b>часа</span>' +
        '<span><b data-u="m">' + tl.m + '</b>мин</span>' +
        '<span><b data-u="s">' + tl.s + '</b>сек</span>' +
        '</div>';
    }

    var img = (CFG.popupImage || "").trim();
    var imgHtml = img
      ? '<img class="gw-pop__img" src="' + img + '" alt="" aria-hidden="true">'
      : '<span class="gw-pop__gift" aria-hidden="true">🎁</span>';

    var back = document.createElement("div");
    back.className = "gw-pop-back";

    var pop = document.createElement("div");
    pop.className = "gw-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-modal", "true");
    pop.setAttribute("aria-labelledby", "gwPopTitle");
    pop.innerHTML =
      '<div class="gw-pop__card">' +
        '<div class="gw-pop__glow" aria-hidden="true"></div>' +
        '<button class="gw-pop__x" type="button" aria-label="Затвори">&times;</button>' +
        '<span class="gw-pop__badge">Atlantic Drive</span>' +
        imgHtml +
        '<h2 class="gw-pop__title" id="gwPopTitle">' + (CFG.title || "GIVEAWAY") + '</h2>' +
        '<p class="gw-pop__prize">' + (CFG.prize || "") + '</p>' +
        timerHtml +
        '<a class="gw-pop__btn" href="' + PAGE + '">' + (CFG.popupCta || "Участвай") + '</a>' +
        '<button class="gw-pop__later" type="button">Не сега, благодаря</button>' +
        '<p class="gw-pop__note">Записването отнема под 1 минута. Без такси и ангажименти.</p>' +
      '</div>';

    document.body.appendChild(back);
    document.body.appendChild(pop);
    requestAnimationFrame(function () {
      back.classList.add("is-in");
      pop.classList.add("is-in");
    });

    var tick = null;
    if (tl) {
      tick = setInterval(function () {
        var t = timeLeft();
        var box = document.getElementById("gwPopTimer");
        if (!box) return;
        if (!t) { box.remove(); clearInterval(tick); return; }
        box.querySelector('[data-u="d"]').textContent = t.d;
        box.querySelector('[data-u="h"]').textContent = t.h;
        box.querySelector('[data-u="m"]').textContent = t.m;
        box.querySelector('[data-u="s"]').textContent = t.s;
      }, 1000);
    }

    function close() {
      if (SNOOZE > 0) store(K_SNOOZ, String(Date.now() + SNOOZE));
      if (tick) clearInterval(tick);
      back.classList.remove("is-in");
      pop.classList.remove("is-in");
      document.removeEventListener("keydown", onKey);
      setTimeout(function () { back.remove(); pop.remove(); }, 320);
    }
    function onKey(e) { if (e.key === "Escape") close(); }

    pop.querySelector(".gw-pop__x").addEventListener("click", close);
    pop.querySelector(".gw-pop__later").addEventListener("click", close);
    back.addEventListener("click", close);
    document.addEventListener("keydown", onKey);

    var cta = pop.querySelector(".gw-pop__btn");
    if (cta) setTimeout(function () { cta.focus(); }, 380);
  }

  /* ---------------- init ---------------- */
  function isHomePage() {
    var file = location.pathname.split("/").pop().toLowerCase();
    return file === "" || file === "index.html";
  }

  function init() {
    handleReset();
    injectStyles();
    buildFab();

    if (CFG.popupOnHomeOnly !== false && !isHomePage()) return;
    if (snoozed()) return;
    setTimeout(buildPopup, DELAY);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
