# Giveaway → Google Sheet

## Вече е готово
- **Таблица:** „Atlantic Drive — Giveaway (записвания)“
  <https://docs.google.com/spreadsheets/d/1byZoSQys6Q1TfcF9wBIlj6GHX8LruIIjE1l0IgSOP4Y/edit>
  (празна е — листът `Giveaway` и заглавията се създават сами при първото записване)
- **Кодът:** [`Code.gs`](Code.gs) в този проект, а копие за копиране от телефон/друг компютър стои и в Drive:
  „Atlantic Drive — Giveaway Apps Script (Code.gs).txt“
- ID-то на таблицата вече е записано в кода (`SPREADSHEET_ID`).

## Статус: работи ✅

Deploy-нат е и е тестван на 12.09.2026:

| Тест | Резултат |
| --- | --- |
| GET на `/exec` | `{"ok":true,"service":"AtlanticDrive Giveaway"}` |
| Записване | ред в лист `Giveaway` + `{"ok":true,"status":"created"}` |
| Същият телефон пак | `{"status":"duplicate","field":"phone"}` |
| Същият Instagram, друг телефон | `{"status":"duplicate","field":"instagram"}` |
| Невалидни данни | `{"status":"invalid","field":"firstName"}` |
| CORS | `access-control-allow-origin: *` — сайтът чете отговора |

Линкът вече е в [`js/giveaway-config.js`](../js/giveaway-config.js).

> В таблицата има един тестов ред (Тест Тестов, кампания `test`) — изтрий го.

## Проверка
- Отвори `/exec` линка в браузър → трябва да върне
  `{"ok":true,"service":"AtlanticDrive Giveaway", ...}`
- Попълни формата на `giveaway.html` → нов ред в листа `Giveaway`.
- Опитай пак със същия телефон или Instagram → трябва да излезе „Ти вече си се записал“.

## Полезно
- **Имейл при всяко записване:** сложи адрес в `NOTIFY_EMAIL` горе в кода.
- **Теглене на победител:** в Apps Script избери функцията `drawWinner` → ▶ Run.
  Записва в лист „Победители“.
- **Дубликати** се хващат по телефон (последните 9 цифри), Instagram профил и имейл.

> ⚠️ След всяка промяна в кода: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**,
> иначе сайтът вика старата версия.
