// === CONFIG ===
const API_BASE_LEADS=
  (window.API_BASE && typeof window.API_BASE === "string")
    ? window.API_BASE
    : (location.hostname === "localhost" || location.hostname === "127.0.0.1"
        ? "https://atlanticdrive-api-bzh6dqbhb8fzh0gf.westeurope-01.azurewebsites.net"
        : "https://atlanticdrive-api-bzh6dqbhb8fzh0gf.westeurope-01.azurewebsites.net");


const LOGIN_PAGE =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "logIn.html"
    : "/logIn.html";

const MY_LISTINGS_PAGE =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "my-listings.html"
    : "/my-listings.html";

// === Потребители, към които може да се пренасочва ===
let ASSIGN_USERS = [];

// helpers за потребителите
function getAssignUserById(id) {
  if (!id) return null;
  const num = Number(id);
  if (!Number.isFinite(num)) return null;
  return ASSIGN_USERS.find((u) => u.id === num) || null;
}

// === AUTH ===
const rawAuthLeads = localStorage.getItem("auth");
if (!rawAuthLeads) location.href = LOGIN_PAGE;
const authLeads = JSON.parse(rawAuthLeads || "{}");

function jwtExpLeads(token) {
  try {
    return JSON.parse(atob(token.split(".")[1])).exp || 0;
  } catch {
    return 0;
  }
}

function isExpiredLeads(token) {
  const exp = jwtExpLeads(token);
  const now = Math.floor(Date.now() / 1000);
  return exp && exp < now - 5;
}

function forceLogoutLeads() {
  localStorage.removeItem("auth");
  localStorage.removeItem("user");
  location.href = LOGIN_PAGE;
}

if (!authLeads?.token || isExpiredLeads(authLeads.token)) {
  forceLogoutLeads();
}

// === MAIN ADMIN CHECK ===
// Само global_admin се брои за „главен админ“ за тази страница
const MAIN_ADMIN_ROLES_LEADS = ["global_admin"];

function hasMainAdminRoleVal(val) {
  return !!val && MAIN_ADMIN_ROLES_LEADS.includes(String(val).toLowerCase());
}

function isMainAdminLeads() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return false;
    const a = JSON.parse(raw);

    const checkVal = (v) => hasMainAdminRoleVal(v);

    // 1) Директно в auth
    if (checkVal(a.role)) return true;
    if (Array.isArray(a.roles) && a.roles.some(checkVal)) return true;

    if (a.isGlobalAdmin === true) return true;
    if (a.isSuperAdmin === true || a.isMainAdmin === true) return true;

    // 2) Вграден user обект
    if (a.user) {
      if (checkVal(a.user.role)) return true;
      if (Array.isArray(a.user.roles) && a.user.roles.some(checkVal)) return true;

      if (a.user.isGlobalAdmin === true) return true;
      if (a.user.isSuperAdmin === true || a.user.isMainAdmin === true) return true;
    }

    // 3) В JWT payload
    if (!a.token) return false;
    const payloadStr = atob(a.token.split(".")[1] || "");
    const payload = JSON.parse(payloadStr || "{}");

    const claimRole =
      payload["role"] ||
      payload["roles"] ||
      payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];

    const rolesArr = Array.isArray(claimRole)
      ? claimRole
      : claimRole
      ? [claimRole]
      : [];

    if (rolesArr.some(checkVal)) return true;

    if (payload.isGlobalAdmin === true) return true;
    if (payload.isSuperAdmin === true || payload.isMainAdmin === true) return true;
  } catch {
    return false;
  }

  return false;
}

// Само global_admin остава на тази страница – всички други отиват към /my-listings
if (!isMainAdminLeads()) {
  location.href = MY_LISTINGS_PAGE;
}

// === AUTH FETCH ===
async function authFetchLeads(url, options = {}) {
  const a = JSON.parse(localStorage.getItem("auth") || "{}");
  const headers = new Headers(options.headers || {});
  if (a?.token) headers.set("Authorization", "Bearer " + a.token);

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    forceLogoutLeads();
    throw new Error("Unauthorized");
  }
  return res;
}

// === DOM CACHES ===
const btnLogoutLeads = document.getElementById("btnLogout");
const btnBack = document.getElementById("btnBack");
const statusLeads = document.getElementById("leadsStatus");
const tblLeads = document.getElementById("tblLeads"); // legacy, не се ползва

// нов бутон за панела с клиентите по админ/дилър
const btnToggleUserClients = document.getElementById("btnToggleUserClients");

// модал за пренасочване
const assignModal = document.getElementById("assignModal");
const assignLeadInfo = document.getElementById("assignLeadInfo");
const assignUserSelect = document.getElementById("assignUserSelect");
const assignSubmit = document.getElementById("assignSubmit");
const assignCancel = document.getElementById("assignCancel");

// панел и таблица за репорта "клиенти по потребител"
const userClientsPanel = document.getElementById("userClientsPanel");
const userClientsStatus = document.getElementById("userClientsStatus");
const tbodyUserClients = document.getElementById("tbodyUserClients");
const tblUserClients = document.getElementById("tblUserClients");

// ново – търсачка по телефон
const inputLeadPhoneSearch = document.getElementById("leadPhoneSearch");
const btnLeadPhoneSearchClear = document.getElementById("leadPhoneSearchClear");

// контейнер за картите
function getLeadsCardsContainer() {
  let container = document.getElementById("leadsCards");
  if (container) return container;

  const panel = document.querySelector(".leads-table-panel");
  container = document.createElement("div");
  container.id = "leadsCards";
  container.className = "leads-cards";

  if (panel) {
    panel.appendChild(container);
  } else {
    document.body.appendChild(container);
  }

  return container;
}

btnLogoutLeads?.addEventListener("click", forceLogoutLeads);
btnBack?.addEventListener("click", () => {
  window.location.href = MY_LISTINGS_PAGE;
});

// текст на бутона за панела
function updateUserClientsToggleLabel() {
  if (!btnToggleUserClients || !userClientsPanel) return;
  const isOpen = userClientsPanel.classList.contains("is-open");
  btnToggleUserClients.textContent = isOpen
    ? "Скрий клиентите"
    : "Клиенти по админ";
}

// === HELPERS ===
function escapeHtmlLeads(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDateBGLeads(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizePhoneLeads(phone) {
  if (!phone) return "";
  return String(phone).replace(/[^\d+]/g, "");
}

function getLeadCreatedAt(row) {
  const v =
    row.createdAt ||
    row.created_at ||
    row.createdOn ||
    row.created_on ||
    null;

  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function getAssignedUserId(row) {
  return (
    row.assigned_to ||
    row.assignedTo ||
    row.assignedToUserId ||
    null
  );
}

function setAssignedUserId(row, userId) {
  row.assigned_to = userId;
  row.assignedTo = userId;
  row.assignedToUserId = userId;
}

function getLeadIdFromRow(row) {
  return row.lead_id || row.leadId || row.id || row.Id;
}

// клиент – за детайлната част
function formatClientCell(row) {
  const name = row.customer_name || row.customerName || row.name || "-";

  const phoneRaw =
    row.customer_phone || row.customerPhone || row.phone || "";

  const emailRaw =
    row.customer_email || row.customerEmail || row.email || "";

  const phone = phoneRaw ? String(phoneRaw).trim() : "";
  const email = emailRaw ? String(emailRaw).trim() : "";

  const phoneHref = phone ? normalizePhoneLeads(phone) : "";

  const phoneHtml = phone
    ? `<a href="tel:${phoneHref}" class="lead-client__link">${escapeHtmlLeads(
        phone
      )}</a>`
    : "";

  const emailHtml = email
    ? `<a href="mailto:${email}" class="lead-client__link">${escapeHtmlLeads(
        email
      )}</a>`
    : "";

  const sep = phone && email ? `<span class="lead-client__sep">·</span>` : "";

  return `
    <div class="lead-client">
      <div class="lead-client__name">${escapeHtmlLeads(name)}</div>
      ${
        phone || email
          ? `
      <div class="lead-client__contacts">
        ${phoneHtml}
        ${sep}
        ${emailHtml}
      </div>
      `
          : `<div class="lead-client__contacts muted">Няма контакт</div>`
      }
    </div>
  `;
}

// телефонът за хедъра – приоритетно от реда, иначе от съобщението
function getLeadPrimaryPhone(row) {
  const phoneRaw =
    row.customer_phone || row.customerPhone || row.phone || "";

  let phone = phoneRaw ? String(phoneRaw).trim() : "";

  if (!phone) {
    const parsed = parseLeadMessage(row.message || row.note || "");
    phone = parsed.phone || "";
  }

  return phone;
}

// търсене / обява – чип
function formatSearchCell(row) {
  const source = (row.source || "").toString().toLowerCase();
  const listingId = row.listing_id || row.listingId || null;
  const listingTitle = row.listing_title || row.listingTitle || null;

  if (listingId || listingTitle) {
    return `
      <div class="lead-search">
        <div class="lead-chip lead-chip--listing">По обява</div>
      </div>
    `;
  }

  let label;
  if (source === "website_request") {
    label = "Търсене от сайта";
  } else if (source === "manual_admin") {
    label = "Клиент (ръчно)";
  } else {
    label = "Запитване";
  }

  return `
    <div class="lead-search">
      <div class="lead-chip lead-chip--search">${escapeHtmlLeads(label)}</div>
    </div>
  `;
}

// парсваме съобщението от формата "Бърза връзка"
function parseLeadMessage(msg) {
  const result = {
    office: null,
    fullName: null,
    phone: null,
    make: null,
    model: null,
    text: "",
  };

  if (!msg) return result;

  const raw = String(msg);
  const lines = raw.split(/\r?\n/);
  const textLines = [];
  let inDescription = false;

  const takeAfterColon = (line) =>
    line.split(":").slice(1).join(":").trim();

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();

    if (lower.startsWith("офис")) {
      result.office = takeAfterColon(line);
      continue;
    }
    if (lower.startsWith("име и фамилия") || lower.startsWith("име")) {
      result.fullName = takeAfterColon(line);
      continue;
    }
    if (lower.startsWith("телефон")) {
      result.phone = takeAfterColon(line);
      continue;
    }
    if (lower.startsWith("марка")) {
      result.make = takeAfterColon(line);
      continue;
    }
    if (lower.startsWith("модел")) {
      result.model = takeAfterColon(line);
      continue;
    }
    if (
      lower.startsWith("кратко описание") ||
      lower.startsWith("съобщение")
    ) {
      inDescription = true;
      continue;
    }

    if (inDescription) {
      textLines.push(line);
    }
  }

  let text = textLines.join("\n").trim();

  if (
    !result.office &&
    !result.fullName &&
    !result.phone &&
    !result.make &&
    !result.model &&
    !text
  ) {
    text = raw.trim();
  }

  result.text = text;
  return result;
}

// === ТЪРСАЧКА ПО ТЕЛЕФОН ===
function applyPhoneFilter() {
  const container = getLeadsCardsContainer();
  if (!container) return;

  const raw = inputLeadPhoneSearch?.value || "";
  const query = normalizePhoneLeads(raw);

  const cards = container.querySelectorAll(".lead-card");
  let visibleCount = 0;

  cards.forEach((card) => {
    const cardPhone = card.dataset.phone || "";
    if (!query || !cardPhone || cardPhone.includes(query)) {
      card.style.display = "";
      visibleCount++;
    } else {
      card.style.display = "none";
    }
  });

  if (statusLeads) {
    if (!query) {
      statusLeads.textContent = "";
    } else if (!visibleCount) {
      statusLeads.textContent = "Няма запитвания с такъв телефон.";
    } else {
      statusLeads.textContent = `Намерени: ${visibleCount}`;
    }
  }
}

// === ЗАРЕЖДАНЕ НА БЕЛЕЖКИ ЗА КОНКРЕТЕН LEAD (само четене) ===
// ВАЖНО: вече не чистим нищо – показваме бележката 1:1, както е записана.
async function loadLeadNotesForElement(leadId, containerEl) {
  if (!containerEl) return;

  containerEl.textContent = "Зареждане...";
  containerEl.classList.add("muted");

  try {
    const res = await authFetchLeads(
      `${API_BASE_LEADS}/api/leads/${encodeURIComponent(leadId)}/notes`,
      { headers: { Accept: "application/json" } }
    );

    if (!res.ok) {
      containerEl.textContent = "Грешка при зареждане на бележките.";
      return;
    }

    const data = await res.json();

    if (!Array.isArray(data) || !data.length) {
      containerEl.textContent = "Няма бележки.";
      return;
    }

    const html = data
      .map((n) => {
        const createdAt = n.createdAt || n.created_at || "";
        const author = n.created_by_name || n.createdByName || "Неизвестен";
        const rawText = n.note_text || n.noteText || "";
        const text = rawText; // без cleanLeadNoteText – показваме всичко

        return `
        <div class="lead-note-item">
          <div class="lead-note-header">
            <span class="lead-note-author">${escapeHtmlLeads(author)}</span>
            <span class="lead-note-date">${
              createdAt ? formatDateBGLeads(createdAt) : ""
            }</span>
          </div>
          <div class="lead-note-text">${escapeHtmlLeads(text)}</div>
        </div>
      `;
      })
      .join("");

    containerEl.classList.remove("muted");
    containerEl.innerHTML = html;
  } catch (err) {
    console.error("Грешка при зареждане на бележките", err);
    containerEl.textContent = "Грешка при зареждане на бележките.";
  }
}

// === ЗАРЕЖДАНЕ НА ПОЛЗВАТЕЛИТЕ ЗА ПРЕНАСОЧВАНЕ ===
async function loadAssignUsers() {
  try {
    const res = await authFetchLeads(
      `${API_BASE_LEADS}/api/leads/assign-users`,
      { headers: { Accept: "application/json" } }
    );

    if (!res.ok) {
      console.error("Не успях да заредя потребителите за пренасочване.");
      ASSIGN_USERS = [];
      return;
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      ASSIGN_USERS = [];
      return;
    }

    ASSIGN_USERS = data
      .map((u) => {
        const id = u.userId ?? u.UserId ?? u.id ?? u.Id;
        const name =
          u.fullName || u.FullName || u.email || u.Email || `User #${id}`;
        return {
          id: Number(id),
          name: String(name),
        };
      })
      .filter((u) => Number.isFinite(u.id));
  } catch (err) {
    console.error("Грешка при зареждане на assign users", err);
    ASSIGN_USERS = [];
  }
}

// Назначен на
function formatAssignedDisplay(row) {
  const id =
    row.assigned_to || row.assignedTo || row.assignedToUserId || null;

  if (!id) return "-";

  const user = getAssignUserById(id);
  if (user) return user.name;

  return `ID ${id}`;
}

// === ASSIGN ===
let CURRENT_ASSIGN_LEAD_ID = null;

async function openAssignModal(leadId, customerName, currentAssignedId) {
  CURRENT_ASSIGN_LEAD_ID = leadId;

  const labelName =
    customerName && customerName !== "-" ? customerName : `Запитване #${leadId}`;
  if (assignLeadInfo) {
    assignLeadInfo.textContent = `Запитване от: ${labelName}`;
  }

  if (!assignUserSelect) return;

  assignUserSelect.innerHTML = `<option value="">-- Без назначен --</option>`;

  if (!ASSIGN_USERS.length) {
    await loadAssignUsers();
  }

  ASSIGN_USERS.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = String(u.id);
    opt.textContent = u.name;
    assignUserSelect.appendChild(opt);
  });

  if (currentAssignedId) {
    assignUserSelect.value = String(currentAssignedId);
  } else {
    assignUserSelect.value = "";
  }

  if (assignModal) {
    assignModal.style.display = "flex";
  }
}

function closeAssignModal() {
  CURRENT_ASSIGN_LEAD_ID = null;
  if (assignModal) assignModal.style.display = "none";
  if (assignUserSelect) assignUserSelect.value = "";
}

async function assignLead(leadId, assignedToUserId) {
  const url = `${API_BASE_LEADS}/api/leads/${encodeURIComponent(leadId)}/assign`;

  const body = {
    assignedToUserId: assignedToUserId,
  };

  const res = await authFetchLeads(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok && res.status !== 204) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "Грешка при пренасочване на запитването.");
  }
}

// === DELETE LEAD ===
async function deleteLead(leadId, cardEl) {
  if (!leadId) return;

  const ok = confirm("Сигурен ли си, че искаш да изтриеш това запитване?");
  if (!ok) return;

  try {
    const res = await authFetchLeads(
      `${API_BASE_LEADS}/api/leads/${encodeURIComponent(leadId)}?hard=1`,
      { method: "DELETE" }
    );

    if (!res.ok && res.status !== 404) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || "Грешка при изтриване на запитването.");
    }

    if (cardEl && cardEl.parentNode) {
      cardEl.parentNode.removeChild(cardEl);
    }

    const container = getLeadsCardsContainer();
    if (!container.children.length && statusLeads) {
      statusLeads.textContent = "Няма запитвания.";
    }
  } catch (err) {
    console.error("Грешка при триене на запитване", err);
    alert(err.message || "Грешка при триене на запитването.");
  }
}

// === CLICK HANDLERS (делегирани) ===
document.addEventListener("click", async (e) => {
  const header = e.target.closest(".lead-card-header");
  if (header) {
    if (e.target.closest("a")) return;
    const card = header.closest(".lead-card");
    if (card) {
      card.classList.toggle("is-open");
    }
    return;
  }

  const btnDelete = e.target.closest(".btn-lead-delete");
  if (btnDelete) {
    const leadId = btnDelete.dataset.id;
    const card = btnDelete.closest(".lead-card");
    await deleteLead(leadId, card);
    return;
  }

  const btnAssign = e.target.closest(".btn-assign-lead");
  if (btnAssign) {
    const leadId = btnAssign.dataset.id;
    const customerName = btnAssign.dataset.customer || "";
    const assignedId = btnAssign.dataset.assignedId || "";
    openAssignModal(leadId, customerName, assignedId);
    return;
  }

  if (assignModal && e.target === assignModal) {
    closeAssignModal();
  }
});

assignCancel?.addEventListener("click", (e) => {
  e.preventDefault();
  closeAssignModal();
});

assignSubmit?.addEventListener("click", async (e) => {
  e.preventDefault();
  if (!CURRENT_ASSIGN_LEAD_ID) return;

  const selectedVal = assignUserSelect?.value || "";
  const leadId = CURRENT_ASSIGN_LEAD_ID;

  try {
    const userId = selectedVal ? Number(selectedVal) : null;
    await assignLead(leadId, userId);

    const container = getLeadsCardsContainer();
    const card = container.querySelector(
      `.lead-card[data-lead-id="${leadId}"]`
    );
    if (card) {
      const assignedLabelEl = card.querySelector(".lead-card-assigned-value");
      const btnAssign = card.querySelector(".btn-assign-lead");

      let displayName = "-";
      if (userId) {
        const u = getAssignUserById(userId);
        displayName = u ? u.name : `ID ${userId}`;
      }

      if (assignedLabelEl) {
        assignedLabelEl.textContent =
          displayName === "-" ? "Без назначен" : displayName;
      }

      if (btnAssign) {
        btnAssign.dataset.assignedId = userId ? String(userId) : "";
      }
    }

    closeAssignModal();
  } catch (err) {
    console.error("Грешка при пренасочване", err);
    alert(err.message || "Грешка при пренасочване на запитването.");
  }
});

// Escape за затваряне на модала
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && assignModal?.style.display === "flex") {
    closeAssignModal();
  }
});

// === ТЪРСАЧКА HANDLERS ===
inputLeadPhoneSearch?.addEventListener("input", () => {
  applyPhoneFilter();
});

btnLeadPhoneSearchClear?.addEventListener("click", () => {
  if (!inputLeadPhoneSearch) return;
  inputLeadPhoneSearch.value = "";
  applyPhoneFilter();
  inputLeadPhoneSearch.focus();
});

// === LOAD LEADS ===
async function loadLeads() {
  if (statusLeads) statusLeads.textContent = "Зареждане...";

  if (tblLeads) tblLeads.style.display = "none";

  const cardsContainer = getLeadsCardsContainer();
  cardsContainer.innerHTML = "";

  try {
    const qs = new URLSearchParams({
      skip: "0",
      take: "200",
    });

    const res = await authFetchLeads(
      `${API_BASE_LEADS}/api/leads?${qs.toString()}`,
      { headers: { Accept: "application/json" } }
    );

    if (!res.ok) {
      if (statusLeads) {
        statusLeads.textContent = "Не успях да заредя запитванията.";
      }
      return;
    }

    const data = await res.json();

    if (!Array.isArray(data) || !data.length) {
      if (statusLeads) statusLeads.textContent = "Няма запитвания.";
      return;
    }

    // --- агрегиране на телефони за дублиране + автоматично назначаване ---
    const phoneMeta = new Map();

    // групиране по телефон
    data.forEach((row, index) => {
      const phone = getLeadPrimaryPhone(row);
      if (!phone) return;
      const norm = normalizePhoneLeads(phone);
      if (!norm) return;

      let meta = phoneMeta.get(norm);
      if (!meta) {
        meta = {
          phone,
          rowIndexes: [],
          responsibleUserId: null,
        };
        phoneMeta.set(norm, meta);
      }
      meta.rowIndexes.push(index);
    });

    // ще пазим авто-пренасочвания, за да ги изпратим към API-то
    const autoAssignments = [];

    // определяне на "отговорник" по телефон и авто-назначаване на най-новото
    phoneMeta.forEach((meta) => {
      if (!meta.rowIndexes || meta.rowIndexes.length < 2) return;

      // 1) намираме най-новото запитване
      let newestIndex = null;
      let newestCreatedAt = null;
      meta.rowIndexes.forEach((idx) => {
        const createdAt = getLeadCreatedAt(data[idx]);
        if (!newestCreatedAt || (createdAt && createdAt > newestCreatedAt)) {
          newestCreatedAt = createdAt;
          newestIndex = idx;
        }
      });

      // 2) от по-старите търсим последния дилър, който се е занимавал с клиента
      let responsibleUserId = null;
      let responsibleCreatedAt = null;
      meta.rowIndexes.forEach((idx) => {
        if (idx === newestIndex) return; // гледаме само "преди него"

        const row = data[idx];
        const assignedId = getAssignedUserId(row);
        const createdAt = getLeadCreatedAt(row);

        if (assignedId != null && assignedId !== 0) {
          const assignedNum = Number(assignedId);
          if (Number.isFinite(assignedNum)) {
            if (!responsibleCreatedAt || (createdAt && createdAt > responsibleCreatedAt)) {
              responsibleUserId = assignedNum;
              responsibleCreatedAt = createdAt;
            }
          }
        }
      });

      meta.responsibleUserId = responsibleUserId;

      // 3) ако има такъв дилър – преназначаваме най-новото запитване към него
      if (responsibleUserId && newestIndex != null) {
        const newestRow = data[newestIndex];
        const currentAssigned = getAssignedUserId(newestRow);

        if (currentAssigned == null || Number(currentAssigned) !== responsibleUserId) {
          setAssignedUserId(newestRow, responsibleUserId);

          const leadId = getLeadIdFromRow(newestRow);
          if (leadId != null) {
            autoAssignments.push({
              leadId,
              userId: responsibleUserId,
            });
          }
        }
      }
    });

    // --- рендер на картите ---
    data.forEach((row) => {
      const createdAt =
        row.createdAt ||
        row.created_at ||
        row.createdOn ||
        row.created_on ||
        "";

      const name =
        row.customer_name || row.customerName || row.name || "-";

      const phone = getLeadPrimaryPhone(row);
      const phoneHref = phone ? normalizePhoneLeads(phone) : "";

      const assignedDisplay = formatAssignedDisplay(row);
      const assignedId =
        row.assigned_to || row.assignedTo || row.assignedToUserId || "";

      const leadId = row.lead_id || row.leadId || row.id || row.Id;

      const normPhone = phone ? normalizePhoneLeads(phone) : "";
      let duplicateInfoHtml = "";
      let duplicateBadgeHtml = "";
      let isDuplicate = false;

      if (normPhone) {
        const meta = phoneMeta.get(normPhone);
        if (meta && meta.rowIndexes && meta.rowIndexes.length > 1) {
          isDuplicate = true;

          let responsibleName = "";
          const responsibleId = meta.responsibleUserId;
          if (responsibleId) {
            const user = getAssignUserById(responsibleId);
            responsibleName = user ? user.name : `ID ${responsibleId}`;
          }

          if (responsibleName) {
            duplicateBadgeHtml = `
              <span class="lead-duplicate-pill">Съществуващ клиент</span>
            `;
            duplicateInfoHtml = `
              <div class="lead-duplicate-alert">
                <span class="lead-duplicate-tag">Съществуващ клиент</span>
                <span class="lead-duplicate-text">
                  Телефонът вече е при: ${escapeHtmlLeads(responsibleName)}
                </span>
              </div>`;
          } else {
            duplicateBadgeHtml = `
              <span class="lead-duplicate-pill">Съществуващ клиент</span>
            `;
            duplicateInfoHtml = `
              <div class="lead-duplicate-alert">
                <span class="lead-duplicate-tag">Съществуващ клиент</span>
                <span class="lead-duplicate-text">
                  Има още запитвания с този телефон.
                </span>
              </div>`;
          }
        }
      }

      const card = document.createElement("article");
      card.className = "lead-card" + (isDuplicate ? " lead-card--duplicate" : "");
      card.dataset.leadId = String(leadId);
      card.dataset.phone = normPhone || ""; // за търсачката по телефон

      card.innerHTML = `
        <button type="button" class="lead-card-header">
          <div class="lead-card-header-left">
            <div class="lead-card-name-row">
              <div class="lead-card-name">${escapeHtmlLeads(name)}</div>
              ${duplicateBadgeHtml}
            </div>
            <div class="lead-card-phone">
              ${
                phone
                  ? `<a href="tel:${phoneHref}">${escapeHtmlLeads(phone)}</a>`
                  : `<span class="muted">Няма телефон</span>`
              }
            </div>
          </div>
          <div class="lead-card-header-right">
            <div class="lead-card-assigned">
              <span class="lead-card-assigned-label">Назначен на</span>
              <span class="lead-card-assigned-value">${
                assignedDisplay === "-"
                  ? "Без назначен"
                  : escapeHtmlLeads(assignedDisplay)
              }</span>
            </div>
            <div class="lead-card-date">
              ${createdAt ? formatDateBGLeads(createdAt) : ""}
            </div>
            <div class="lead-card-chevron"></div>
          </div>
        </button>

        <div class="lead-card-details">
          ${duplicateInfoHtml}
          <div class="lead-card-sections">
            <div class="lead-card-section">
              <div class="lead-card-section-title">Клиент</div>
              <div class="lead-card-section-body">
                ${formatClientCell(row)}
              </div>
            </div>

            <div class="lead-card-section">
              <div class="lead-card-section-title">Източник</div>
              <div class="lead-card-section-body">
                ${formatSearchCell(row)}
              </div>
            </div>

            <div class="lead-card-section lead-card-section-notes">
              <div class="lead-card-section-title">Бележки</div>
              <div class="lead-card-section-body">
                <div class="lead-notes-list lead-notes-list--compact" data-lead-id="${leadId}">
                  Зареждане на бележки...
                </div>
              </div>
            </div>
          </div>

          <div class="lead-card-actions">
            <button
              type="button"
              class="btn-assign-lead"
              data-id="${leadId}"
              data-customer="${escapeHtmlLeads(name)}"
              data-assigned-id="${assignedId || ""}">
              Пренасочи
            </button>
            <button
              type="button"
              class="btn-lead-delete"
              data-id="${leadId}">
              Изтрий
            </button>
          </div>
        </div>
      `;

      cardsContainer.appendChild(card);

      const notesDiv = card.querySelector(
        '.lead-notes-list[data-lead-id="' + leadId + '"]'
      );
      if (notesDiv) {
        loadLeadNotesForElement(leadId, notesDiv);
      }
    });

    // изпращаме автоматичните пренасочвания към API-то
    if (autoAssignments.length) {
      try {
        await Promise.all(
          autoAssignments.map((x) =>
            assignLead(x.leadId, x.userId).catch((err) => {
              console.error("Грешка при авто-пренасочване на запитване", err);
            })
          )
        );
      } catch (err) {
        console.error("Грешка при изпълнение на авто-пренасочванията", err);
      }
    }

    // ако има текст в търсачката – прилагаме филтъра върху ново заредените карти
    if (inputLeadPhoneSearch && inputLeadPhoneSearch.value) {
      applyPhoneFilter();
    } else if (statusLeads) {
      statusLeads.textContent = "";
    }
  } catch (err) {
    console.error(err);
    if (statusLeads) {
      statusLeads.textContent = "Грешка при зареждане на запитванията.";
    }
  }
}

// === РЕПОРТ: клиенти по потребител (за global_admin) ===
async function loadUserClientsReport() {
  if (!userClientsPanel || !tbodyUserClients) return;

  if (userClientsStatus) {
    userClientsStatus.textContent = "Зареждане...";
  }

  try {
    const res = await authFetchLeads(
      `${API_BASE_LEADS}/api/admin/user-clients`,
      { headers: { Accept: "application/json" } }
    );

    if (!res.ok) {
      if (res.status === 403 || res.status === 404) {
        // няма достъп – скриваме панела
        userClientsPanel.style.display = "none";
        return;
      }
      const txt = await res.text().catch(() => "");
      throw new Error(txt || "Грешка при зареждане на репорта.");
    }

    const data = await res.json();

    if (!Array.isArray(data) || !data.length) {
      tbodyUserClients.innerHTML = "";
      if (userClientsStatus) {
        userClientsStatus.textContent = "Няма админи/дилъри.";
      }
      if (tblUserClients) tblUserClients.style.display = "table";
      return;
    }

    const groupsMap = new Map();

    data.forEach((r) => {
      const userId = r.userId ?? r.UserId;
      if (userId == null) return;

      const key = String(userId);
      const userName = r.userName ?? r.UserName ?? `User #${userId}`;
      const email = r.email ?? r.Email ?? "";

      let g = groupsMap.get(key);
      if (!g) {
        g = { userId, userName, email, clients: [] };
        groupsMap.set(key, g);
      }

      const leadIdRaw = r.leadId ?? r.LeadId;
      let leadId = null;
      if (leadIdRaw !== undefined && leadIdRaw !== null) {
        const num = Number(leadIdRaw);
        if (Number.isFinite(num) && num > 0) {
          leadId = num;
        }
      }

      const customerName = r.customerName ?? r.CustomerName ?? "";
      const customerPhone = r.customerPhone ?? r.CustomerPhone ?? "";

      if (leadId !== null) {
        g.clients.push({
          leadId,
          name: customerName,
          phone: customerPhone,
        });
      }
    });

    const groups = Array.from(groupsMap.values()).sort((a, b) =>
      a.userName.localeCompare(b.userName, "bg-BG")
    );

    const totalClients = groups.reduce(
      (sum, g) => sum + g.clients.length,
      0
    );

    const html = groups
      .map((g) => {
        const count = g.clients.length;

        const emailHtml = g.email
          ? `<a href="mailto:${g.email}" class="user-email-link">${escapeHtmlLeads(
              g.email
            )}</a>`
          : `<span class="muted">Няма email</span>`;

        let clientsHtml = "";

        if (!count) {
          clientsHtml = `
            <div class="user-clients-list empty-clients">
              <span class="muted">Няма клиенти.</span>
            </div>`;
        } else {
          const clientsListHtml = g.clients
            .map((c) => {
              const name = c.name
                ? escapeHtmlLeads(c.name)
                : `Клиент #${c.leadId}`;
              const phone = c.phone ? String(c.phone).trim() : "";
              const phoneHref = phone ? normalizePhoneLeads(phone) : "";

              const phoneHtml = phone
                ? `<a href="tel:${phoneHref}" class="user-client-phone">${escapeHtmlLeads(
                    phone
                  )}</a>`
                : `<span class="muted">Няма телефон</span>`;

              return `
                <div class="user-client-item">
                  <span class="user-client-name">${name}</span>
                  <span class="user-client-sep">·</span>
                  ${phoneHtml}
                </div>`;
            })
            .join("");

          clientsHtml = `<div class="user-clients-list">${clientsListHtml}</div>`;
        }

        return `
          <tr>
            <td>
              <div class="user-cell-name">${escapeHtmlLeads(g.userName)}</div>
              <div class="user-cell-email">${emailHtml}</div>
            </td>
            <td class="user-cell-count">Клиенти: ${count}</td>
            <td>${clientsHtml}</td>
          </tr>`;
      })
      .join("");

    tbodyUserClients.innerHTML = html;

    if (tblUserClients) {
      tblUserClients.style.display = "table";
    }

    if (userClientsStatus) {
      userClientsStatus.textContent = `Общо клиенти: ${totalClients}`;
    }
  } catch (err) {
    console.error("Грешка при зареждане на user-clients репорт", err);
    if (userClientsStatus) {
      userClientsStatus.textContent =
        err.message || "Грешка при зареждане на репорта.";
    }
    if (tblUserClients) tblUserClients.style.display = "table";
  }
}

// === TOGGLE за панела "Клиенти по админ / дилър" ===
let USER_CLIENTS_LOADED = false;

btnToggleUserClients?.addEventListener("click", async () => {
  if (!userClientsPanel) return;

  const isOpening = !userClientsPanel.classList.contains("is-open");

  if (isOpening && !USER_CLIENTS_LOADED) {
    try {
      await loadUserClientsReport();
      USER_CLIENTS_LOADED = true;
    } catch (err) {
      console.error("Грешка при зареждане на репорта", err);
    }
  }

  userClientsPanel.classList.toggle("is-open");
  updateUserClientsToggleLabel();
});

// === INIT ===
(async function initLeadsPage() {
  try {
    await loadAssignUsers();
  } catch (err) {
    console.error(err);
  }

  await loadLeads();

  if (!isMainAdminLeads()) {
    if (userClientsPanel) {
      userClientsPanel.style.display = "none";
    }
    if (btnToggleUserClients) {
      btnToggleUserClients.style.display = "none";
    }
  } else {
    updateUserClientsToggleLabel();
  }
})();
