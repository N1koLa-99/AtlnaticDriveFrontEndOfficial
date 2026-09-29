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
    var NOISE = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>" +
      "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter>" +
      "<rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";
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

      /* ---------- POPUP (editorial: клип + типография, черно/златно) ---------- */
      '.gw-pop-back{position:fixed;inset:0;z-index:1400;background:rgba(2,3,6,.8);',
      'backdrop-filter:blur(10px) saturate(.7);-webkit-backdrop-filter:blur(10px) saturate(.7);opacity:0;transition:opacity .5s ease}',
      '.gw-pop-back.is-in{opacity:1}',
      '.gw-pop,.gw-pop *,.gw-pop *::before,.gw-pop *::after{box-sizing:border-box}',
      '.gw-pop{position:fixed;inset:0;z-index:1401;display:grid;grid-template-columns:minmax(0,1fr);place-items:center;padding:20px;pointer-events:none}',
      '.gw-pop__card{--gold:#ffd21f;--ink:#f4f1ea;--line:rgba(244,241,234,.12);pointer-events:auto;position:relative;outline:0;',
      'display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);width:min(880px,100%);height:min(600px,calc(100svh - 40px));',
      'overflow:hidden;border-radius:4px;color:var(--ink);background:#0a0a0c;',
      'font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;',
      'box-shadow:0 40px 120px rgba(0,0,0,.7),0 0 0 1px rgba(255,210,31,.16);',
      'opacity:0;transform:translateY(28px) scale(.985);transition:opacity .5s ease,transform .8s cubic-bezier(.16,1,.3,1)}',
      '.gw-pop.is-in .gw-pop__card{opacity:1;transform:none}',

      /* затваряне */
      '.gw-pop__x{position:absolute;top:14px;right:14px;z-index:6;width:38px;height:38px;border-radius:50%;',
      'border:1px solid rgba(255,255,255,.22);background:rgba(10,10,12,.45);color:#fff;cursor:pointer;display:grid;place-items:center;',
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:transform .4s cubic-bezier(.16,1,.3,1),background .2s ease,border-color .2s ease}',
      '.gw-pop__x:hover{transform:rotate(90deg);background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.4)}',
      '.gw-pop__x:focus-visible{outline:2px solid var(--gold);outline-offset:2px}',

      /* клип */
      '.gw-pop__media{position:relative;overflow:hidden;background:radial-gradient(90% 60% at 50% 70%,rgba(255,210,31,.14),transparent 70%),#050506;',
      'clip-path:inset(100% 0 0 0);transition:clip-path 1.1s cubic-bezier(.77,0,.18,1) .1s}',
      '.gw-pop.is-in .gw-pop__media{clip-path:inset(0 0 0 0)}',
      '.gw-pop__video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 45%;',
      'opacity:0;transform:scale(1.16);transition:opacity .9s ease,transform 2.2s cubic-bezier(.16,1,.3,1)}',
      '.gw-pop__video.is-ready{opacity:1}',
      '.gw-pop.is-in .gw-pop__video{transform:scale(1.04)}',
      '.gw-pop__media::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:1;',
      'background:linear-gradient(180deg,rgba(0,0,0,.45) 0%,transparent 24%,transparent 58%,rgba(0,0,0,.82) 100%)}',
      '.gw-pop__crn{position:absolute;z-index:2;width:18px;height:18px;border:0 solid var(--gold);pointer-events:none}',
      '.gw-pop__crn--tl{top:16px;left:16px;border-top-width:1.5px;border-left-width:1.5px}',
      '.gw-pop__crn--tr{top:16px;right:16px;border-top-width:1.5px;border-right-width:1.5px}',
      '.gw-pop__brand{position:absolute;z-index:2;top:20px;left:44px;font-size:10px;font-weight:700;letter-spacing:.34em;',
      'text-transform:uppercase;color:rgba(255,255,255,.85)}',
      '.gw-pop__vert{position:absolute;z-index:2;right:18px;top:50%;transform:translateY(-50%);writing-mode:vertical-rl;',
      'font-size:9.5px;font-weight:600;letter-spacing:.42em;text-transform:uppercase;color:rgba(255,255,255,.6)}',
      '.gw-pop__cap{position:absolute;z-index:2;left:20px;bottom:54px;line-height:1.2}',
      '.gw-pop__cap small{display:block;font-size:9.5px;font-weight:700;letter-spacing:.34em;text-transform:uppercase;color:var(--gold);margin-bottom:6px}',
      '.gw-pop__cap span{display:block;font-size:22px;font-weight:900;letter-spacing:-.02em;text-transform:uppercase;color:#fff}',
      /* златна лента – покрива и водния знак на клипа */
      '.gw-pop__tape{position:absolute;z-index:3;left:0;right:0;bottom:0;overflow:hidden;max-width:100%;white-space:nowrap;padding:10px 0;',
      'background:var(--gold);color:#0a0a0c;font-size:10.5px;font-weight:800;letter-spacing:.3em;text-transform:uppercase}',
      '.gw-pop__tape div{display:inline-flex;animation:gw-tape 22s linear infinite}',
      '.gw-pop__tape span{padding-right:1.4em}',
      '@keyframes gw-tape{to{transform:translateX(-50%)}}',

      /* текст */
      '.gw-pop__body{position:relative;display:flex;flex-direction:column;min-height:0;overflow:auto;padding:30px 36px 26px;',
      'background:radial-gradient(110% 55% at 100% 0%,rgba(255,210,31,.09),transparent 60%),#0a0a0c}',
      '.gw-pop__body::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.07;background-image:' + NOISE + '}',
      '.gw-pop__body > *{position:relative}',
      '.gw-pop__top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:0 48px 16px 0;',
      'border-bottom:1px solid var(--line);font-size:10px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:rgba(244,241,234,.5)}',
      '.gw-pop__top b{color:var(--gold);font-weight:700}',
      '.gw-pop__kick{display:flex;align-items:center;gap:12px;margin:28px 0 12px;font-size:10.5px;font-weight:700;',
      'letter-spacing:.34em;text-transform:uppercase;color:var(--gold)}',
      '.gw-pop__kick::before{content:"";width:28px;height:1px;background:currentColor}',
      '.gw-pop__title{margin:0;font-weight:900;font-size:clamp(40px,5.2vw,60px);line-height:.94;letter-spacing:-.035em;text-transform:uppercase}',
      '.gw-pop__ln{display:block;overflow:hidden;padding-bottom:.08em}',
      '.gw-pop__ln > span{display:block;transform:translateY(110%);',
      'transition:transform 1s cubic-bezier(.16,1,.3,1);transition-delay:calc(var(--d,0) * 90ms + 450ms)}',
      '.gw-pop.is-in .gw-pop__ln > span{transform:none}',
      '.gw-pop__ln--accent > span{color:var(--gold)}',
      '.gw-pop__lead{margin:18px 0 0;max-width:36ch;color:rgba(244,241,234,.68);font-size:14px;line-height:1.6}',
      '.gw-pop__specs{list-style:none;margin:22px 0 0;padding:0;border-top:1px solid var(--line)}',
      '.gw-pop__specs li{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:11px 0;',
      'border-bottom:1px solid var(--line);font-size:13.5px}',
      '.gw-pop__specs span{font-size:10px;font-weight:600;letter-spacing:.26em;text-transform:uppercase;color:rgba(244,241,234,.45)}',
      '.gw-pop__specs b{font-weight:700;text-align:right;font-variant-numeric:tabular-nums}',
      '.gw-pop__cta{margin-top:auto;padding-top:24px}',
      '.gw-pop__btn{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:16px;',
      'width:100%;padding:18px 22px;border-radius:2px;background:var(--gold);color:#0a0a0c;text-decoration:none;',
      'font-size:12.5px;font-weight:800;letter-spacing:.24em;text-transform:uppercase}',
      '.gw-pop__btn::before{content:"";position:absolute;inset:0;background:#fff;transform:translateX(-101%);',
      'transition:transform .55s cubic-bezier(.77,0,.18,1)}',
      '.gw-pop__btn::after{content:"";position:absolute;top:0;bottom:0;left:-40%;width:30%;transform:skewX(-20deg);',
      'background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:gw-shine 4.2s ease-in-out 2s infinite}',
      '@keyframes gw-shine{0%,70%{left:-40%}100%{left:130%}}',
      '.gw-pop__btn:hover::before{transform:none}',
      '.gw-pop__btn:hover::after{animation:none;opacity:0}',
      '.gw-pop__btn > *{position:relative;z-index:1}',
      '.gw-pop__btn svg{flex:none;transition:transform .45s cubic-bezier(.16,1,.3,1)}',
      '.gw-pop__btn:hover svg{transform:translateX(6px)}',
      '.gw-pop__btn:focus-visible{outline:2px solid #fff;outline-offset:3px}',
      '.gw-pop__later{display:block;margin:12px auto 0;padding:6px;background:none;border:0;cursor:pointer;',
      'color:rgba(244,241,234,.45);font-size:10.5px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;transition:color .2s ease}',
      '.gw-pop__later:hover,.gw-pop__later:focus-visible{color:var(--ink)}',

      /* поетапно появяване */
      '.gw-pop [data-rv]{opacity:0;transform:translateY(14px);transition:opacity .6s ease,transform .9s cubic-bezier(.16,1,.3,1);',
      'transition-delay:calc(var(--d,0) * 80ms + 380ms)}',
      '.gw-pop.is-in [data-rv]{opacity:1;transform:none}',
      '.gw-pop.is-closing .gw-pop__card{opacity:0;transform:translateY(16px) scale(.985);transition-duration:.3s}',
      '.gw-pop.is-closing *{transition-delay:0s !important}',

      /* телефон: клипът горе, текстът отдолу */
      '@media (max-width:720px){',
      '.gw-pop{padding:10px}',
      '.gw-pop__card{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto;height:auto;max-height:calc(100svh - 20px);overflow-y:auto}',
      '.gw-pop__media{height:min(44svh,360px)}',
      '.gw-pop__body{overflow:visible;padding:22px 20px 18px}',
      '.gw-pop__top{padding-right:0}',
      '.gw-pop__kick{margin-top:20px}',
      '.gw-pop__title{font-size:clamp(34px,10.5vw,46px)}',
      '.gw-pop__lead{font-size:13.5px}',
      '.gw-pop__cap{bottom:50px}.gw-pop__cap span{font-size:19px}',
      '.gw-pop__vert,.gw-pop__crn--tr{display:none}',
      '}',
      '@media (max-width:720px) and (max-height:640px){ .gw-pop__media{height:34svh} }',

      '@media (prefers-reduced-motion: reduce){',
      '.gw-pop__card,.gw-pop__media,.gw-pop__video,.gw-pop__ln > span,.gw-pop [data-rv]{transition:opacity .2s ease !important;transform:none !important;clip-path:none !important}',
      '.gw-pop__tape div,.gw-pop__btn::after{animation:none}',
      '}'

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
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmtLeft(t) { return t.d + "д " + pad(t.h) + ":" + pad(t.m) + ":" + pad(t.s); }

  function mediaHtml() {
    var vid = CFG.popupVideo || [];
    if (typeof vid === "string") vid = [vid];
    if (vid.length) {
      var src = vid.map(function (s) {
        var type = /\.mov$/i.test(s) ? "video/quicktime" : "video/mp4";
        return '<source src="' + s + '" type="' + type + '">';
      }).join("");
      return '<video class="gw-pop__video" muted loop playsinline autoplay preload="auto" ' +
             'disablepictureinpicture aria-hidden="true">' + src + '</video>';
    }
    var img = (CFG.popupImage || "").trim();
    return img ? '<img class="gw-pop__video is-ready" src="' + img + '" alt="" aria-hidden="true">' : "";
  }

  function buildPopup() {
    if (document.querySelector(".gw-pop")) return;

    // Заглавие: редовете се делят с "|", последният е в златно
    var lines = String(CFG.popupHeadline || CFG.title || "Giveaway").split("|");
    var titleHtml = lines.map(function (txt, i) {
      var accent = lines.length > 1 && i === lines.length - 1;
      return '<span class="gw-pop__ln' + (accent ? " gw-pop__ln--accent" : "") + '" style="--d:' + i + '">' +
             '<span>' + txt + '</span></span>';
    }).join("");

    var specs = (CFG.popupSpecs || []).slice();
    var tl = timeLeft();
    if (tl) specs.push(["Остават", '<span id="gwPopTimer">' + fmtLeft(tl) + "</span>"]);
    var specsHtml = specs.length
      ? '<ul class="gw-pop__specs" data-rv style="--d:4">' + specs.map(function (s) {
          return "<li><span>" + s[0] + "</span><b>" + s[1] + "</b></li>";
        }).join("") + "</ul>"
      : "";

    var tapeWords = CFG.popupTape || ["Giveaway", "Chevrolet Camaro", "Atlantic Drive", "Участвай безплатно"];
    var tapeRun = tapeWords.map(function (w) { return "<span>" + w + "</span><span>✦</span>"; }).join("");

    var back = document.createElement("div");
    back.className = "gw-pop-back";

    var pop = document.createElement("div");
    pop.className = "gw-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-modal", "true");
    pop.setAttribute("aria-labelledby", "gwPopTitle");
    pop.innerHTML =
      '<div class="gw-pop__card" tabindex="-1">' +
        '<button class="gw-pop__x" type="button" aria-label="Затвори">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
        '</button>' +
        '<div class="gw-pop__media">' +
          mediaHtml() +
          '<i class="gw-pop__crn gw-pop__crn--tl" aria-hidden="true"></i>' +
          '<i class="gw-pop__crn gw-pop__crn--tr" aria-hidden="true"></i>' +
          '<span class="gw-pop__brand" aria-hidden="true">Atlantic Drive</span>' +
          '<span class="gw-pop__vert" aria-hidden="true">Limited · Giveaway · 2026</span>' +
          '<span class="gw-pop__cap" aria-hidden="true"><small>Наградата</small><span>Chevrolet Camaro</span></span>' +
          '<div class="gw-pop__tape" aria-hidden="true"><div>' + tapeRun + tapeRun + '</div></div>' +
        '</div>' +
        '<div class="gw-pop__body">' +
          '<div class="gw-pop__top" data-rv style="--d:0"><b>N° 01</b><span>Giveaway · 2026</span></div>' +
          '<p class="gw-pop__kick" data-rv style="--d:1">' + (CFG.popupKicker || "Giveaway") + '</p>' +
          '<h2 class="gw-pop__title" id="gwPopTitle">' + titleHtml + '</h2>' +
          '<p class="gw-pop__lead" data-rv style="--d:3">' + (CFG.prize || "") + '</p>' +
          specsHtml +
          '<div class="gw-pop__cta" data-rv style="--d:5">' +
            '<a class="gw-pop__btn" href="' + PAGE + '"><span>' + (CFG.popupCta || "Участвай") + '</span>' +
              '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>' +
            '</a>' +
            '<button class="gw-pop__later" type="button">Не сега</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(back);
    document.body.appendChild(pop);

    var root = document.documentElement;
    var prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    // Клипът се показва чак когато има кадър – без празен/черен блясък
    var video = pop.querySelector("video.gw-pop__video");
    if (video) {
      var ready = function () { video.classList.add("is-ready"); };
      video.addEventListener("loadeddata", ready);
      video.addEventListener("playing", ready);
      video.muted = true;
      var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        video.removeAttribute("autoplay");
        video.pause();
      } else {
        var p = video.play();
        if (p && p.catch) p.catch(function () { /* autoplay блокиран – остава първият кадър */ });
      }
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        back.classList.add("is-in");
        pop.classList.add("is-in");
      });
    });

    var tick = null;
    if (tl) {
      tick = setInterval(function () {
        var t = timeLeft();
        var box = document.getElementById("gwPopTimer");
        if (!box) return;
        if (!t) { box.closest("li").remove(); clearInterval(tick); return; }
        box.textContent = fmtLeft(t);
      }, 1000);
    }

    function close() {
      if (SNOOZE > 0) store(K_SNOOZ, String(Date.now() + SNOOZE));
      if (tick) clearInterval(tick);
      pop.classList.add("is-closing");
      back.classList.remove("is-in");
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
      setTimeout(function () {
        if (video) { video.pause(); video.removeAttribute("src"); }
        back.remove();
        pop.remove();
      }, 360);
    }

    function onKey(e) {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;
      // фокусът остава в прозореца
      var f = pop.querySelectorAll("a[href],button");
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    pop.querySelector(".gw-pop__x").addEventListener("click", close);
    pop.querySelector(".gw-pop__later").addEventListener("click", close);
    back.addEventListener("click", close);
    pop.addEventListener("click", function (e) { if (e.target === pop) close(); });
    document.addEventListener("keydown", onKey);

    // фокус в прозореца (за клавиатура/екранен четец), без рамка върху бутона
    pop.querySelector(".gw-pop__card").focus({ preventScroll: true });
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
