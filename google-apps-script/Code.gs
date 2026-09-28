/**
 * ATLANTIC DRIVE – GIVEAWAY → GOOGLE SHEET
 * ------------------------------------------------------------------
 * Приема записванията от giveaway.html, проверява за дубликати
 * (по телефон, Instagram профил и имейл) и ги записва в таблицата.
 *
 * Deploy: Deploy → New deployment → Web app
 *         Execute as: Me
 *         Who has access: Anyone
 * Копирай "/exec" линка в js/giveaway-config.js → endpoint
 */

/* ====================== НАСТРОЙКИ ====================== */
// Таблица "Atlantic Drive — Giveaway (записвания)"
var SPREADSHEET_ID = '1byZoSQys6Q1TfcF9wBIlj6GHX8LruIIjE1l0IgSOP4Y';
var SHEET_NAME   = 'Giveaway';                 // име на листа в таблицата
var NOTIFY_EMAIL = '';                         // напр. 'office@atlanticdrive.bg' (празно = без имейли)
var HEADERS = [
  'Дата и час', 'Име', 'Фамилия', 'Телефон', 'Имейл', 'Instagram',
  'Последва IG', 'Влезе във Viber група', 'Покани 2 приятели', 'Съгласие GDPR',
  'Кампания', 'Източник', 'Страница', 'User Agent'
];

/* ====================== ENTRY POINTS ====================== */
function doGet(e) {
  // Бърза проверка дали деплойментът работи + проверка на дубликат по ?check=
  var q = (e && e.parameter) ? e.parameter : {};
  if (q.check) {
    var dup = findDuplicate_({
      phone: q.check,
      instagram: q.check,
      email: q.check
    });
    return json_({ ok: true, exists: !!dup, field: dup ? dup.field : null });
  }
  return json_({ ok: true, service: 'AtlanticDrive Giveaway', time: new Date().toISOString() });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, status: 'busy', message: 'Сървърът е зает. Опитай пак след няколко секунди.' });
  }

  try {
    var data = parseBody_(e);

    var rec = {
      firstName: cleanText_(data.firstName, 40),
      lastName:  cleanText_(data.lastName, 40),
      phone:     normPhone_(data.phone),
      email:     String(data.email || '').trim().toLowerCase(),
      instagram: normInstagram_(data.instagram),
      followedIg:     !!data.followedIg,
      joinedViber:    !!(data.joinedViber || data.joinedFb),   // joinedFb – стар вариант
      invitedFriends: !!data.invitedFriends,
      consent:        !!data.consent,
      campaign:   cleanText_(data.campaign, 60) || 'giveaway',
      source:     cleanText_(data.source, 200),
      page:       cleanText_(data.page, 200),
      userAgent:  cleanText_(data.userAgent, 300)
    };

    /* ---- сървърна валидация ---- */
    var bad = validate_(rec);
    if (bad) return json_({ ok: false, status: 'invalid', field: bad.field, message: bad.message });

    /* ---- проверка за дубликат ---- */
    var dup = findDuplicate_(rec);
    if (dup) {
      return json_({
        ok: false,
        status: 'duplicate',
        field: dup.field,
        message: 'Ти вече си се записал – не може да участваш два пъти.'
      });
    }

    /* ---- запис ---- */
    var sheet = getSheet_();
    sheet.appendRow([
      new Date(),
      rec.firstName,
      rec.lastName,
      "'" + rec.phone,          // апостроф = Sheets да не реже "+"
      rec.email,
      rec.instagram,
      rec.followedIg ? 'Да' : 'Не',
      rec.joinedViber ? 'Да' : 'Не',
      rec.invitedFriends ? 'Да' : 'Не',
      rec.consent ? 'Да' : 'Не',
      rec.campaign,
      rec.source,
      rec.page,
      rec.userAgent
    ]);

    notify_(rec);

    return json_({ ok: true, status: 'created' });

  } catch (err) {
    return json_({ ok: false, status: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ====================== HELPERS ====================== */
function parseBody_(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) { /* form-encoded */ }
  }
  return (e.parameter || {});
}

/** Таблицата – работи и когато скриптът е закачен за нея, и като самостоятелен проект. */
function ss_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (err) { /* standalone */ }
  if (!ss && SPREADSHEET_ID) ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss) throw new Error('Липсва таблица: задай SPREADSHEET_ID.');
  return ss;
}

function getSheet_() {
  var ss = ss_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    writeHeaders_(sheet);
  } else if (sheet.getLastRow() === 1) {
    // само заглавен ред – обновяваме го, ако колоните са се променили
    var cur = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].join('|');
    if (cur !== HEADERS.join('|')) writeHeaders_(sheet);
  }
  return sheet;
}

function writeHeaders_(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length)
       .setFontWeight('bold')
       .setBackground('#061d4b')
       .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function cleanText_(v, max) {
  var s = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
  return s.length > max ? s.substring(0, max) : s;
}

function normPhone_(v) {
  var d = String(v || '').replace(/[^\d+]/g, '');
  d = d.replace(/^00/, '+');
  if (d.indexOf('+359') === 0)      d = '+359' + d.substring(4).replace(/^0+/, '');
  else if (d.indexOf('359') === 0)  d = '+359' + d.substring(3).replace(/^0+/, '');
  else if (d.indexOf('0') === 0)    d = '+359' + d.substring(1);
  else if (d.indexOf('+') !== 0)    d = '+359' + d;
  return d;
}

function phoneKey_(v) {
  var digits = String(v || '').replace(/\D/g, '');
  return digits.length > 9 ? digits.slice(-9) : digits;   // сравняваме последните 9 цифри
}

function normInstagram_(v) {
  var s = String(v || '').trim();
  s = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  s = s.replace(/^instagram\.com\//i, '');
  s = s.split('?')[0].split('#')[0];
  s = s.replace(/\/+$/, '').replace(/^@+/, '');
  return s.toLowerCase();
}

function validate_(r) {
  if (!r.firstName || r.firstName.length < 2)
    return { field: 'firstName', message: 'Невалидно име.' };
  if (!r.lastName || r.lastName.length < 2)
    return { field: 'lastName', message: 'Невалидна фамилия.' };
  if (!/^\+\d{8,15}$/.test(r.phone))
    return { field: 'phone', message: 'Невалиден телефонен номер.' };
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(r.email))
    return { field: 'email', message: 'Невалиден имейл адрес.' };
  if (!/^[a-z0-9._]{2,30}$/.test(r.instagram))
    return { field: 'instagram', message: 'Невалиден Instagram профил.' };
  if (!r.consent)
    return { field: 'consent', message: 'Липсва съгласие за обработка на данните.' };
  return null;
}

/**
 * Търси съществуващ участник по телефон (последни 9 цифри),
 * Instagram профил или имейл. Връща {field: '...'} или null.
 */
function findDuplicate_(rec) {
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return null;

  // колони: D=телефон(4), E=имейл(5), F=instagram(6)
  var values = sheet.getRange(2, 4, last - 1, 3).getValues();

  var pKey = phoneKey_(rec.phone);
  var ig   = normInstagram_(rec.instagram);
  var mail = String(rec.email || '').trim().toLowerCase();

  for (var i = 0; i < values.length; i++) {
    var rowPhone = phoneKey_(values[i][0]);
    var rowMail  = String(values[i][1] || '').trim().toLowerCase();
    var rowIg    = normInstagram_(values[i][2]);

    if (pKey && rowPhone && pKey === rowPhone) return { field: 'phone', row: i + 2 };
    if (ig   && rowIg   && ig   === rowIg)     return { field: 'instagram', row: i + 2 };
    if (mail && rowMail && mail === rowMail)   return { field: 'email', row: i + 2 };
  }
  return null;
}

function notify_(rec) {
  if (!NOTIFY_EMAIL) return;
  try {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: 'Ново участие в giveaway: ' + rec.firstName + ' ' + rec.lastName,
      htmlBody:
        '<b>Име:</b> ' + rec.firstName + ' ' + rec.lastName + '<br>' +
        '<b>Телефон:</b> ' + rec.phone + '<br>' +
        '<b>Имейл:</b> ' + rec.email + '<br>' +
        '<b>Instagram:</b> @' + rec.instagram + '<br>' +
        '<b>Кампания:</b> ' + rec.campaign
    });
  } catch (err) { /* без имейл – не проваляме записа */ }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ====================== ЕКСТРИ ====================== */
/**
 * ЕДНОКРАТНО: оправя заглавния ред и мества старите редове (13 колони)
 * към новата подредба (14 колони – с "Покани 2 приятели").
 * Пусни я веднъж от редактора: избери fixSheet → ▶ Run. Не изисква нов Deploy.
 */
function fixSheet() {
  var sheet = ss_().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Няма лист "' + SHEET_NAME + '".');

  var last = sheet.getLastRow();
  var moved = 0;

  // 1) старите редове: вкарваме празна клетка на позицията на "Покани 2 приятели" (колона 9)
  if (last > 1) {
    var rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      // ред в стар формат: 14-тата клетка е празна, а 13-тата съдържа данни
      if (r[13] === '' && r[12] !== '') {
        var fixed = r.slice(0, 8);            // до "Влезе във Viber група"
        fixed.push('Не');                     // Покани 2 приятели – неизвестно
        fixed = fixed.concat(r.slice(8, 13)); // останалото се измества надясно
        sheet.getRange(i + 2, 1, 1, HEADERS.length).setValues([fixed]);
        moved++;
      }
    }
  }

  // 2) заглавният ред
  writeHeaders_(sheet);
  sheet.autoResizeColumns(1, HEADERS.length);

  var msg = 'Заглавията са обновени. Преместени стари реда: ' + moved;
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (err) { /* без UI – виж Logs */ }
  return msg;
}


/** Тегли случаен победител измежду участниците и го маркира в лист "Победители". */
function drawWinner() {
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last < 2) throw new Error('Няма участници.');

  var rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var pick = rows[Math.floor(Math.random() * rows.length)];

  var ss = ss_();
  var win = ss.getSheetByName('Победители') || ss.insertSheet('Победители');
  if (win.getLastRow() === 0) win.appendRow(['Изтеглен на'].concat(HEADERS));
  win.appendRow([new Date()].concat(pick));

  var text = 'Победител: ' + pick[1] + ' ' + pick[2] +
             '\nТелефон: ' + pick[3] + '\nInstagram: @' + pick[5];
  Logger.log(text);
  try { SpreadsheetApp.getUi().alert(text); } catch (err) { /* без UI – виж Logs */ }
  return text;
}
