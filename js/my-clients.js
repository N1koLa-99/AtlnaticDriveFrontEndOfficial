// === CONFIG ===
const API_BASE_CLIENTS =
  (window.API_BASE && typeof window.API_BASE === "string")
    ? window.API_BASE
    : (location.hostname === "localhost" || location.hostname === "127.0.0.1"
        ? "https://atlanticdrive-api-bzh6dqbhb8fzh0gf.westeurope-01.azurewebsites.net"
        : "https://atlanticdrive-api-bzh6dqbhb8fzh0gf.westeurope-01.azurewebsites.net");

const LOGIN_PAGE_CLIENTS =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "logIn.html"
    : "/logIn.html";

const MY_LISTINGS_PAGE_CLIENTS =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "my-listings.html"
    : "/my-listings.html";

// === AUTH ===
const rawAuthClients = localStorage.getItem("auth");
if (!rawAuthClients) location.href = LOGIN_PAGE_CLIENTS;
const authClients = JSON.parse(rawAuthClients || "{}");

function jwtExpClients(token) {
  try {
    return JSON.parse(atob(token.split(".")[1])).exp || 0;
  } catch {
    return 0;
  }
}

function isExpiredClients(token) {
  const exp = jwtExpClients(token);
  const now = Math.floor(Date.now() / 1000);
  return exp && exp < now - 5;
}

function forceLogoutClients() {
  localStorage.removeItem("auth");
  localStorage.removeItem("user");
  location.href = LOGIN_PAGE_CLIENTS;
}

if (!authClients?.token || isExpiredClients(authClients.token)) {
  forceLogoutClients();
}

// === AUTH FETCH ===
async function authFetchClients(url, options = {}) {
  const a = JSON.parse(localStorage.getItem("auth") || "{}");
  const headers = new Headers(options.headers || {});
  if (a?.token) headers.set("Authorization", "Bearer " + a.token);

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    forceLogoutClients();
    throw new Error("Unauthorized");
  }
  return res;
}

// === DOM CACHES ===
const btnLogoutClients = document.getElementById("btnLogout");
const btnBackClients = document.getElementById("btnBack");
const btnNewClient = document.getElementById("btnNewClient");

const statusClients = document.getElementById("clientsStatus");
const tblClients = document.getElementById("tblClients"); // вече го няма, но не пречи
const tbodyClients = document.getElementById("tbodyClients");

// модал за нов клиент
const clientModal = document.getElementById("clientModal");
const clientNameEl = document.getElementById("clientName");
const clientPhoneEl = document.getElementById("clientPhone");
const clientEmailEl = document.getElementById("clientEmail");
const clientMakeEl = document.getElementById("clientMake");
const clientModelEl = document.getElementById("clientModel");
const clientYearEl = document.getElementById("clientYear");
const clientBudgetEl = document.getElementById("clientBudget");
const clientCurrencyEl = document.getElementById("clientCurrency");
const clientNoteEl = document.getElementById("clientNote");
const clientSave = document.getElementById("clientSave");
const clientCancel = document.getElementById("clientCancel");
const clientModalErr = document.getElementById("clientModalErr");

// НОВО – търсачка по телефон
const inputClientPhoneSearch = document.getElementById("clientPhoneSearch");
const btnClientPhoneSearchClear = document.getElementById("clientPhoneSearchClear");

btnLogoutClients?.addEventListener("click", forceLogoutClients);
btnBackClients?.addEventListener("click", () => {
  window.location.href = MY_LISTINGS_PAGE_CLIENTS;
});

btnNewClient?.addEventListener("click", () => {
  openClientModal();
});

// === КОНТЕЙНЕР ЗА КАРТИТЕ ===
let clientsListEl = document.getElementById("clientsList");
if (!clientsListEl) {
  const wrap = document.querySelector(".clients-panel") || document.body;
  clientsListEl = document.createElement("div");
  clientsListEl.id = "clientsList";
  clientsListEl.className = "clients-list";
  wrap.appendChild(clientsListEl);
}

// скриваме старата таблица, ако случайно я има
if (tblClients) {
  tblClients.style.display = "none";
}

// === HELPERS ===
function escapeHtmlClients(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDateBGClients(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatCurrencyBGNClients(amount, currCode) {
  if (amount == null) return "";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  const txt = n.toLocaleString("bg-BG", { maximumFractionDigits: 0 });
  const c = (currCode || "BGN").toUpperCase();
  if (c === "BGN") return `${txt} лв.`;
  if (c === "EUR") return `€${txt}`;
  return `${txt} ${c}`;
}

function normalizePhoneClients(phone) {
  if (!phone) return "";
  return String(phone).replace(/[^\d+]/g, "");
}

// ЧЕТЕНЕ НА ГРЕШКА ОТ API (JSON / TEXT)
async function readApiErrorClients(res, fallback) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  try {
    if (ct.includes("application/json")) {
      const j = await res.json();
      return j?.message || j?.title || j?.error || fallback;
    }

    const t = await res.text().catch(() => "");
    if (!t) return fallback;

    // понякога връща JSON, но не е application/json
    try {
      const j = JSON.parse(t);
      return j?.message || j?.title || j?.error || t;
    } catch {
      return t;
    }
  } catch {
    return fallback;
  }
}

// Показваме съобщение вътре в картата (в span.client-note-msg)
function setInlineMsg(cardEl, leadId, text, isError) {
  const msgEl = cardEl?.querySelector(`.client-note-msg[data-lead-id="${leadId}"]`);
  if (!msgEl) return false;

  msgEl.textContent = text || "";
  msgEl.classList.toggle("error", !!isError);
  return true;
}

// клиент – HTML за име + контакти (ползваме го в картата)
function formatClientCellClients(row) {
  const name =
    row.customer_name ||
    row.customerName ||
    row.name ||
    "-";

  const phoneRaw =
    row.customer_phone ||
    row.customerPhone ||
    row.phone ||
    "";

  const emailRaw =
    row.customer_email ||
    row.customerEmail ||
    row.email ||
    "";

  const phone = phoneRaw ? String(phoneRaw).trim() : "";
  const email = emailRaw ? String(emailRaw).trim() : "";

  const phoneHref = phone ? normalizePhoneClients(phone) : "";

  const phoneHtml = phone
    ? `<a href="tel:${phoneHref}" class="lead-client__link">${escapeHtmlClients(phone)}</a>`
    : "";

  const emailHtml = email
    ? `<a href="mailto:${email}" class="lead-client__link">${escapeHtmlClients(email)}</a>`
    : "";

  const sep = phone && email ? `<span class="lead-client__sep">·</span>` : "";

  return `
    <div class="lead-client">
      <div class="lead-client__name">${escapeHtmlClients(name)}</div>
      ${(phone || email) ? `
      <div class="lead-client__contacts">
        ${phoneHtml}
        ${sep}
        ${emailHtml}
      </div>
      ` : `<div class="lead-client__contacts muted">Няма контакт</div>`}
    </div>
  `;
}

// === ТЪРСАЧКА ПО ТЕЛЕФОН (филтър върху картите) ===
function applyClientPhoneFilter() {
  if (!clientsListEl) return;

  const raw = inputClientPhoneSearch?.value || "";
  const query = normalizePhoneClients(raw);

  const cards = clientsListEl.querySelectorAll(".client-card");
  let visible = 0;

  cards.forEach((card) => {
    const cardPhone = card.dataset.phone || "";
    if (!query || !cardPhone || cardPhone.includes(query)) {
      card.style.display = "";
      visible++;
    } else {
      card.style.display = "none";
    }
  });

  if (!statusClients) return;

  if (!query) {
    statusClients.textContent = "";
  } else if (!visible) {
    statusClients.textContent = "Няма клиенти с такъв телефон.";
  } else {
    statusClients.textContent = `Намерени: ${visible}`;
  }
}

inputClientPhoneSearch?.addEventListener("input", () => {
  applyClientPhoneFilter();
});

btnClientPhoneSearchClear?.addEventListener("click", () => {
  if (!inputClientPhoneSearch) return;
  inputClientPhoneSearch.value = "";
  applyClientPhoneFilter();
  inputClientPhoneSearch.focus();
});

// === ЗАРЕЖДАНЕ НА БЕЛЕЖКИ ЗА ДАДЕН КЛИЕНТ ===
async function loadClientNotes(leadId, listEl) {
  if (!leadId || !listEl) return;

  listEl.textContent = "Зареждане на бележките...";
  listEl.classList.add("muted");

  try {
    const res = await authFetchClients(
      `${API_BASE_CLIENTS}/api/leads/${encodeURIComponent(leadId)}/notes`,
      { headers: { Accept: "application/json" } }
    );

    if (!res.ok) {
      listEl.textContent = "Грешка при зареждане на бележките.";
      return;
    }

    const data = await res.json();

    if (!Array.isArray(data) || !data.length) {
      listEl.textContent = "Няма бележки за този клиент.";
      return;
    }

    const html = data
      .map((n) => {
        const createdAt = n.createdAt || n.created_at || "";
        const author = n.created_by_name || n.createdByName || "Неизвестен";
        const text = n.note_text || n.noteText || "";
        const noteId = n.note_id || n.noteId;

        return `
        <div class="lead-note-item" data-note-id="${noteId}">
          <div class="lead-note-header">
            <span class="lead-note-author">${escapeHtmlClients(author)}</span>
            <span class="lead-note-date">${createdAt ? formatDateBGClients(createdAt) : ""}</span>
          </div>
          <div class="lead-note-text">${escapeHtmlClients(text)}</div>
          <div class="lead-note-actions">
            <button
              type="button"
              class="btn-note-delete"
              data-lead-id="${leadId}"
              data-note-id="${noteId}"
            >
              Изтрий бележка
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    listEl.classList.remove("muted");
    listEl.innerHTML = html;
  } catch (err) {
    console.error("Грешка при зареждане на бележките за клиент", err);
    listEl.textContent = "Грешка при зареждане на бележките.";
  }
}

// === ЗАПИС НА БЕЛЕЖКА ЗА КЛИЕНТ ===
async function saveClientNote(leadId, noteText, msgEl, listEl, textarea) {
  if (!leadId) {
    if (msgEl) {
      msgEl.textContent = "Липсва ID на клиента.";
      msgEl.classList.add("error");
    }
    return;
  }

  if (!noteText.trim()) {
    if (msgEl) {
      msgEl.textContent = "Бележката е празна.";
      msgEl.classList.add("error");
    }
    return;
  }

  try {
    if (msgEl) {
      msgEl.textContent = "Записвам...";
      msgEl.classList.remove("error");
    }

    const res = await authFetchClients(
      `${API_BASE_CLIENTS}/api/leads/${encodeURIComponent(leadId)}/notes`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: noteText })
      }
    );

    if (!res.ok) {
      const msg =
        res.status === 403
          ? await readApiErrorClients(res, "Нямаш права да добавяш бележки.")
          : await readApiErrorClients(res, "Грешка при запис на бележката.");

      throw new Error(msg);
    }

    if (textarea) {
      textarea.value = "";
    }

    if (listEl) {
      await loadClientNotes(leadId, listEl);
    }

    if (msgEl) {
      msgEl.textContent = "Записано.";
      msgEl.classList.remove("error");
    }
  } catch (err) {
    console.error(err);
    if (msgEl) {
      msgEl.textContent = err.message || "Грешка при запис.";
      msgEl.classList.add("error");
    }
  }
}

// === ИЗТРИВАНЕ НА БЕЛЕЖКА ЗА КЛИЕНТ ===
async function deleteClientNote(leadId, noteId, msgEl, listEl) {
  if (!leadId || !noteId) return;

  const ok = window.confirm("Сигурен ли си, че искаш да изтриеш тази бележка?");
  if (!ok) return;

  try {
    if (msgEl) {
      msgEl.textContent = "Трия бележката...";
      msgEl.classList.remove("error");
    }

    const url = `${API_BASE_CLIENTS}/api/leads/${encodeURIComponent(
      leadId
    )}/notes/${encodeURIComponent(noteId)}`;

    const res = await authFetchClients(url, {
      method: "DELETE",
      headers: { Accept: "application/json" }
    });

    if (!(res.ok || res.status === 204)) {
      const msg =
        res.status === 403
          ? await readApiErrorClients(res, "Нямаш права да триеш бележки.")
          : await readApiErrorClients(res, "Грешка при изтриване на бележката.");

      throw new Error(msg);
    }

    if (listEl) {
      await loadClientNotes(leadId, listEl);
    }

    if (msgEl) {
      msgEl.textContent = "Бележката е изтрита.";
      msgEl.classList.remove("error");
    }
  } catch (err) {
    console.error(err);
    if (msgEl) {
      msgEl.textContent = err.message || "Грешка при изтриване.";
      msgEl.classList.add("error");
    }
  }
}

// === ИЗТРИВАНЕ НА ЦЕЛИЯ КЛИЕНТ (LEAD) ===
async function deleteClientLead(leadId, cardEl) {
  if (!leadId) return;

  const ok = window.confirm(
    "Сигурен ли си, че искаш да изтриеш този клиент и всички бележки към него?"
  );
  if (!ok) return;

  const url = `${API_BASE_CLIENTS}/api/leads/${encodeURIComponent(leadId)}`;

  try {
    // показваме статус вътре в картата (ако има къде)
    setInlineMsg(cardEl, leadId, "Трия клиента...", false);

    const res = await authFetchClients(url, {
      method: "DELETE",
      headers: { Accept: "application/json" }
    });

    // OK случаи
    if (res.ok || res.status === 204) {
      if (cardEl && cardEl.parentNode) {
        cardEl.parentNode.removeChild(cardEl);
      }
      if (clientsListEl && clientsListEl.children.length === 0 && statusClients) {
        statusClients.textContent = "Нямаш клиенти.";
      }
      return;
    }

    // Ако вече не съществува – махаме картата и продължаваме
    if (res.status === 404) {
      if (cardEl && cardEl.parentNode) {
        cardEl.parentNode.removeChild(cardEl);
      }
      if (clientsListEl && clientsListEl.children.length === 0 && statusClients) {
        statusClients.textContent = "Нямаш клиенти.";
      }
      return;
    }

    // Forbidden – това е твоят case
    if (res.status === 403) {
      const msg = await readApiErrorClients(res, "Нямаш права да изтриеш този клиент.");
      if (!setInlineMsg(cardEl, leadId, msg, true)) {
        alert(msg);
      }
      return;
    }

    // Други грешки
    const msg = await readApiErrorClients(res, "Грешка при изтриване на клиента.");
    if (!setInlineMsg(cardEl, leadId, msg, true)) {
      alert(msg);
    }
  } catch (err) {
    console.error(err);
    const msg = err?.message || "Грешка при изтриване на клиента.";
    if (!setInlineMsg(cardEl, leadId, msg, true)) {
      alert(msg);
    }
  }
}

// === LOAD CLIENTS – рендерира КАРТИ, не таблица ===
async function loadClients() {
  if (!statusClients) return;
  statusClients.textContent = "Зареждане...";

  if (clientsListEl) clientsListEl.innerHTML = "";

  try {
    const qs = new URLSearchParams({
      skip: "0",
      take: "200"
    });

    const res = await authFetchClients(
      `${API_BASE_CLIENTS}/api/clients?${qs.toString()}`,
      { headers: { Accept: "application/json" } }
    );

    if (!res.ok) {
      statusClients.textContent = "Не успях да заредя клиентите.";
      return;
    }

    const data = await res.json();

    // поддържаме и масив, и { items: [...] }
    let rows = [];
    if (Array.isArray(data)) {
      rows = data;
    } else if (data && Array.isArray(data.items)) {
      rows = data.items;
    }

    if (!rows.length) {
      statusClients.textContent = "Нямаш клиенти.";
      return;
    }

    const frag = document.createDocumentFragment();

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const createdAt =
        row.createdAt ||
        row.created_at ||
        row.createdOn ||
        row.created_on ||
        "";

      const leadId = row.lead_id || row.leadId || "";

      // телефон за data-атрибут (за търсачката)
      const phoneRaw =
        row.customer_phone ||
        row.customerPhone ||
        row.phone ||
        "";
      const phone = phoneRaw ? String(phoneRaw).trim() : "";
      const normPhone = normalizePhoneClients(phone);

      const card = document.createElement("article");
      card.className = "client-card";
      card.dataset.leadId = leadId;
      card.dataset.phone = normPhone || "";

      const clientHtml = formatClientCellClients(row);
      const dateText = createdAt ? formatDateBGClients(createdAt) : "";

      card.innerHTML = `
        <header class="client-card__header">
          <div class="client-card__index">${idx + 1}</div>
          <div class="client-card__main">
            ${clientHtml}
          </div>
          <div class="client-card__meta">
            <div class="client-card__date">${dateText}</div>
            <button
              type="button"
              class="client-card__toggle"
              aria-expanded="false"
            >
              Детайли
            </button>
          </div>
        </header>

        <div class="client-card__body" hidden>
          <div class="client-card__notes">
            <div
              class="lead-notes-list lead-notes-list--compact"
              data-lead-id="${leadId}"
            >
              Зареждане на бележките...
            </div>

            <div class="client-note-box">
              <textarea
                class="client-note-input"
                rows="2"
                placeholder="Нова бележка за този клиент..."
                data-lead-id="${leadId}"
              ></textarea>
              <div class="client-note-actions">
                <button
                  type="button"
                  class="btn-note-save"
                  data-lead-id="${leadId}"
                >Запази</button>
                <button
                  type="button"
                  class="btn-client-delete"
                  data-lead-id="${leadId}"
                >Изтрий клиента</button>
                <span
                  class="client-note-msg"
                  data-lead-id="${leadId}"
                ></span>
              </div>
            </div>
          </div>
        </div>
      `;

      // зареждаме бележките
      const notesList = card.querySelector(
        '.lead-notes-list[data-lead-id="' + leadId + '"]'
      );
      if (notesList) {
        loadClientNotes(leadId, notesList);
      }

      frag.appendChild(card);
    }

    if (clientsListEl) {
      clientsListEl.appendChild(frag);
    }

    // отваряме първата карта
    const firstCardBody = clientsListEl?.querySelector(".client-card__body");
    const firstToggle = clientsListEl?.querySelector(".client-card__toggle");
    if (firstCardBody && firstToggle) {
      firstCardBody.hidden = false;
      firstToggle.setAttribute("aria-expanded", "true");
    }

    // ако има активен филтър по телефон – прилагаме го върху новите карти
    if (inputClientPhoneSearch && inputClientPhoneSearch.value) {
      applyClientPhoneFilter();
    } else {
      statusClients.textContent = "";
    }
  } catch (err) {
    console.error(err);
    statusClients.textContent = "Грешка при зареждане на клиентите.";
  }
}

// === NEW CLIENT MODAL ===
function openClientModal() {
  if (!clientModal) return;
  clientNameEl.value = "";
  clientPhoneEl.value = "";
  clientEmailEl.value = "";
  clientMakeEl.value = "";
  clientModelEl.value = "";
  clientYearEl.value = "";
  clientBudgetEl.value = "";
  clientCurrencyEl.value = "BGN";
  clientNoteEl.value = "";
  clientModalErr.style.display = "none";
  clientModal.style.display = "flex";
}

function closeClientModal() {
  if (!clientModal) return;
  clientModal.style.display = "none";
}

clientCancel?.addEventListener("click", () => {
  closeClientModal();
});

// === СЪЗДАВАНЕ НА КЛИЕНТ ===
clientSave?.addEventListener("click", async () => {
  const name = clientNameEl.value.trim();
  const phone = clientPhoneEl.value.trim();
  const email = clientEmailEl.value.trim();
  const make = clientMakeEl.value.trim();
  const model = clientModelEl.value.trim();
  const yearRaw = clientYearEl.value.trim();
  const budgetRaw = clientBudgetEl.value.trim();
  const currency = clientCurrencyEl.value || "BGN";
  const note = clientNoteEl.value.trim();

  if (!name) {
    clientModalErr.textContent = "Името е задължително.";
    clientModalErr.style.display = "block";
    return;
  }

  if (!phone) {
    clientModalErr.textContent = "Телефонът е задължителен.";
    clientModalErr.style.display = "block";
    return;
  }

  const year = yearRaw ? Number(yearRaw) : null;
  const budget = budgetRaw ? Number(budgetRaw.replace(/\s+/g, "")) : null;

  const yearLine = year ? String(year) : "-";
  const budgetLine = budget
    ? `${budget.toLocaleString("bg-BG")} ${currency}`
    : "-";

  const message =
`Име и фамилия: ${name}
Телефон: ${phone}
Марка: ${make || "-"}
Модел: ${model || "-"}
Година от: ${yearLine}
Бюджет: ${budgetLine}

Кратко описание:
${note || "-"}`;

  const body = {
    Name: name,
    Phone: phone,
    Email: email || null,
    DesiredMakeName: make || null,
    DesiredModelName: model || null,
    DesiredYear: year,
    BudgetMaxAmount: budget,
    BudgetCurrencyCode: currency,
    InitialNote: message
  };

  try {
    const res = await authFetchClients(`${API_BASE_CLIENTS}/api/clients`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      // 403
      if (res.status === 403) {
        const msg = await readApiErrorClients(res, "Нямаш права да създаваш клиенти.");
        clientModalErr.textContent = msg;
        clientModalErr.style.display = "block";
        return;
      }

      const txt = await res.text().catch(() => "");
      let msg = "Грешка при създаване на клиента.";

      if (res.status === 409) {
        // по-приятно съобщение при дублиран телефон – ползваме payload-а от API-то, ако го има
        msg = "Вече има клиент с този телефонен номер.";
        if (txt) {
          try {
            const json = JSON.parse(txt);
            const assignedToName = json.assignedToName || json.assigned_to_name;
            const customerName = json.customerName || json.customer_name;
            const customerPhone = json.customerPhone || json.customer_phone;

            const parts = [];
            if (assignedToName) parts.push(`Отговорник: ${assignedToName}`);
            if (customerName) parts.push(`Клиент: ${customerName}`);
            if (customerPhone) parts.push(`Телефон: ${customerPhone}`);

            if (parts.length) msg += "\n\n" + parts.join("\n");
          } catch {
            // ако не е JSON – оставяме базовото съобщение
          }
        }
      } else if (txt) {
        try {
          const json = JSON.parse(txt);
          if (json && json.message) msg = json.message;
        } catch {
          if (txt.length < 300) msg = txt;
        }
      }

      clientModalErr.textContent = msg;
      clientModalErr.style.display = "block";
      return;
    }

    closeClientModal();
    await loadClients();
  } catch (err) {
    console.error(err);
    clientModalErr.textContent = err.message || "Грешка при създаване.";
    clientModalErr.style.display = "block";
  }
});

// === EVENT DELEGATION ЗА КАРТИТЕ ===
document.addEventListener("click", (e) => {
  // toggle на картата (детайли)
  const toggleBtn = e.target.closest(".client-card__toggle");
  if (toggleBtn) {
    const card = toggleBtn.closest(".client-card");
    if (!card) return;
    const body = card.querySelector(".client-card__body");
    if (!body) return;
    const isHidden = body.hidden;
    body.hidden = !isHidden;
    toggleBtn.setAttribute("aria-expanded", String(!isHidden));
    return;
  }

  // запис на бележка
  const btnSave = e.target.closest(".btn-note-save");
  if (btnSave) {
    const leadId = btnSave.dataset.leadId;
    const card = btnSave.closest(".client-card");
    if (!card) return;

    const textarea = card.querySelector(
      '.client-note-input[data-lead-id="' + leadId + '"]'
    );
    const msgEl = card.querySelector(
      '.client-note-msg[data-lead-id="' + leadId + '"]'
    );
    const listEl = card.querySelector(
      '.lead-notes-list[data-lead-id="' + leadId + '"]'
    );

    const text = textarea ? textarea.value : "";
    saveClientNote(leadId, text, msgEl, listEl, textarea);
    return;
  }

  // триене на бележка
  const btnDeleteNote = e.target.closest(".btn-note-delete");
  if (btnDeleteNote) {
    const leadId = btnDeleteNote.dataset.leadId;
    const noteId = btnDeleteNote.dataset.noteId;
    const card = btnDeleteNote.closest(".client-card");
    if (!card) return;

    const msgEl = card.querySelector(
      '.client-note-msg[data-lead-id="' + leadId + '"]'
    );
    const listEl = card.querySelector(
      '.lead-notes-list[data-lead-id="' + leadId + '"]'
    );

    deleteClientNote(leadId, noteId, msgEl, listEl);
    return;
  }

  // триене на клиента (card)
  const btnDeleteClient = e.target.closest(".btn-client-delete");
  if (btnDeleteClient) {
    const leadId = btnDeleteClient.dataset.leadId;
    const card = btnDeleteClient.closest(".client-card");
    deleteClientLead(leadId, card);
  }
});

// === INIT ===
loadClients();
