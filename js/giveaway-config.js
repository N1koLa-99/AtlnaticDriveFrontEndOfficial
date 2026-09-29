// js/giveaway-config.js
// ====================================================================
//  ЕДИНСТВЕНОТО МЯСТО, КОЕТО ТРЯБВА ДА РЕДАКТИРАШ ЗА GIVEAWAY-А
// ====================================================================
window.GIVEAWAY_CONFIG = {
  /* 1) ⚠️ ЗАДЪЛЖИТЕЛНО: линкът от Google Apps Script (Deploy → Web app → /exec)
        Виж google-apps-script/README.md за стъпките. */
  endpoint: "https://script.google.com/macros/s/AKfycbynlB_nMa_QY0P6G2JTpZU7ONSOd4WCLK17hROKgObqRBp0g2wWnEEr2Cgx0VwBl7aaYQ/exec",

  /* 2) Текстове на кампанията */
  campaign:  "giveaway-2026",
  title:     "Спечели Camaro-то на Atlantic Drive",
  prize:     "Победителят ще бъде изтеглен при достигане на 40 000 последователя в Instagram.",
  shortLine: "Участвай безплатно — 1 минута ти трябва.",

  /* 3) Краен срок (ISO формат). Остави "" ако не искаш брояч. */
  endsAt: "",

  /* 4) Линкове */
  instagram:     "https://www.instagram.com/atlanticdrive.bg/",
  viberGroup:    "https://invite.viber.com/?g2=AQAaOoCebDf4zVT0EzjmzOnTO9J52skYypKr6bxJ4LrDqJR0LybVtbddJgtjqrae",

  /* 5) Поведение на pop-up-а */
  popupDelayMs:     7000,  // след колко ms да изскочи (7 сек.)
  popupCta:         "Участвай", // текст на бутона в pop-up-а
  popupHeadline:    "Спечели|Camaro-то", // редовете се делят с "|", последният е в златно
  popupKicker:      "Atlantic Drive представя",
  popupVideo:       ["Images/giveaway/camaro-video.mp4"], // клипът вляво в pop-up-а
  popupImage:       "",    // резервна снимка, ако няма клип
  popupSpecs: [            // редовете под текста: [етикет, стойност]
    ["Участие", "Безплатно"],
    ["Време", "Под 1 минута"]
  ],
  popupTape: ["Giveaway", "Chevrolet Camaro", "Atlantic Drive", "Участвай безплатно"], // бягащата златна лента
  popupSnoozeHours: 0,     // 0 = изскача при всяко влизане; напр. 24 = веднъж на денонощие
  showFab:          true,  // кръглият плаващ бутон долу вдясно (на всички страници)
  tipShowMs:        5000,  // балончето до бутона: колко стои видимо
  tipHideMs:        3000,  // балончето до бутона: колко стои скрито
  popupOnHomeOnly:  true,  // pop-up-ът изскача само на началната страница

  /* 6) Страница с формата */
  pageUrl: "giveaway.html"
};
