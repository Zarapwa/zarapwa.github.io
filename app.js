// ExchangeMiniApp — GOLD+ Version

const LOCAL_KEY = "exchangeMiniApp_localRows_v1";

const state = {
  remoteRows: [],
  localRows: [],
  rows: []
};

// ---------- Helpers ----------

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatAmount(n) {
  const num = Number(n || 0);
  return num.toLocaleString("en-US");
}

function sumAmount(rows, type) {
  return rows
    .filter(r => (r.tx_type || "").toLowerCase() === type.toLowerCase())
    .reduce((s, r) => s + (toNumber(r.amount) || 0), 0);
}

function countConversions(rows) {
  return rows.filter(
    r => (r.tx_type || "").toLowerCase() === "conversion"
  ).length;
}

// Gold Deal ID generator: NAME + DATE + COUNTER
function generateDealId(customer, txDate, allRows) {
  const rawName = (customer || "DEAL").toUpperCase();
  // فقط حروف A-Z برای Prefix
  const nameLetters = rawName.replace(/[^A-Z]/g, "") || "DEAL";
  const prefix =
    nameLetters.length >= 4 ? nameLetters.slice(0, 4) : nameLetters.padEnd(4, "X");

  let d = txDate;
  if (!d) d = todayISO();
  const [year, month, day] = d.split("-");
  const dateCode =
    day + month + year.slice(-2); // مثال: 2025-12-05 → 051225

  const sameDayRows = allRows.filter(r => r.tx_date === d);
  const counter = String(sameDayRows.length + 1).padStart(3, "0");

  return `${prefix}-${dateCode}-${counter}`;
}

// Payable auto-calc for conversions based on Trader Rate
function autoCalcPayable(base, target, amount, traderRate) {
  const a = toNumber(amount);
  const r = toNumber(traderRate);
  if (a == null || r == null) return null;

  const pair = `${base}->${target}`;

  switch (pair) {
    case "RMB->IRR":
    case "USD->IRR":
    case "USD->AED":
      return a * r;

    case "RMB->AED":
    case "RMB->USD":
      return a / r;

    default:
      return null;
  }
}

function mergeRows() {
  state.rows = [...state.remoteRows, ...state.localRows];

  state.rows.sort((a, b) => {
    const da = a.tx_date || "";
    const db = b.tx_date || "";
    if (da < db) return -1;
    if (da > db) return 1;
    // اگر تاریخ برابر بود، فقط برای پایداری ترتیب
    return (a.deal_id || "").localeCompare(b.deal_id || "");
  });
}

// ---------- Rendering ----------

function renderAlerts() {
  const el = document.getElementById("alerts");
  if (!el) return;

  el.innerHTML = `
    <div class="alert alert-ok">
      Everything looks OK ✓
    </div>
  `;
}

function renderDashboard() {
  const el = document.getElementById("dashboard");
  if (!el) return;

  const rows = state.rows;
  const today = todayISO();

  const totalTx = rows.length;
  const todayTx = rows.filter(r => r.tx_date === today).length;
  const totalIn = sumAmount(rows, "inflow");
  const totalOut = sumAmount(rows, "outflow");
  const convCount = countConversions(rows);

  el.innerHTML = `
    <div class="dashboard-grid">
      <div class="dash-card">
        <div class="dash-title">All Transactions</div>
        <div class="dash-value">${formatAmount(totalTx)}</div>
      </div>
      <div class="dash-card">
        <div class="dash-title">Today (${today})</div>
        <div class="dash-value">${formatAmount(todayTx)}</div>
      </div>
      <div class="dash-card">
        <div class="dash-title">Total Inflow (amount)</div>
        <div class="dash-value">${formatAmount(totalIn)}</div>
      </div>
      <div class="dash-card">
        <div class="dash-title">Total Outflow (amount)</div>
        <div class="dash-value">${formatAmount(totalOut)}</div>
      </div>
      <div class="dash-card">
        <div class="dash-title">Conversions</div>
        <div class="dash-value">${formatAmount(convCount)}</div>
      </div>
    </div>
  `;
}

function buildDealRow(row) {
  const tx = (row.tx_type || "").toLowerCase();
  const baseCur = row.base_currency || "";
  const targetCur = row.target_currency || "";
  const dealId = row.deal_id || "";
  const date = row.tx_date || "";
  const customer = row.customer || "";
  const amount = toNumber(row.amount);
  const payable = toNumber(row.payable);

  let sign = "";
  let displayAmount = null;
  let displayCurrency = "";

  if (tx === "inflow") {
    sign = "+";
    displayAmount = amount;
    displayCurrency = baseCur;
  } else if (tx === "outflow") {
    sign = "–";
    displayAmount = amount;
    displayCurrency = baseCur;
  } else if (tx === "conversion") {
    sign = "–";
    // برای نمایش، ترجیحاً payable را نشان بده
    displayAmount = payable != null ? payable : amount;
    displayCurrency = payable != null ? targetCur : baseCur;
  }

  const amountText =
    displayAmount != null ? `${sign}${formatAmount(displayAmount)} ${displayCurrency}` : "";

  return `
    <article class="deal-row">
      <div class="deal-main">
        <div class="deal-id">${dealId}</div>
        <div class="deal-meta">
          ${date} • ${tx} • ${customer}
        </div>
      </div>
      <div class="deal-amount">${amountText}</div>
    </article>
  `;
}

function renderDeals() {
  const el = document.getElementById("deals");
  if (!el) return;

  if (!state.rows.length) {
    el.innerHTML = `
      <h2>Deals</h2>
      <p class="empty">No deals yet.</p>
    `;
    return;
  }

  const rowsHtml = state.rows
    .slice()
    .reverse() // آخرین تراکنش‌ها بالا
    .map(buildDealRow)
    .join("");

  el.innerHTML = `
    <h2>Deals</h2>
    <div class="deal-list">
      ${rowsHtml}
    </div>
  `;
}

// ---------- Local Storage ----------

function loadLocalRows() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch (e) {
    console.error("Error loading local rows", e);
    return [];
  }
}

function saveLocalRows() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state.localRows));
  } catch (e) {
    console.error("Error saving local rows", e);
  }
}

// ---------- Remote Data ----------

async function loadRemoteRows() {
  try {
    const res = await fetch("data.json?cache=" + Date.now());
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    // اطمینان از اینکه NaN وارد نمی‌شود
    return data.map(r => ({
      ...r,
      amount: toNumber(r.amount),
      payable: toNumber(r.payable),
      trader_rate: toNumber(r.trader_rate),
      exchanger_rate: toNumber(r.exchanger_rate)
    }));
  } catch (e) {
    console.error("Error loading data.json", e);
    return [];
  }
}

// ---------- New Deal Form ----------

function showNewDealForm() {
  const card = document.getElementById("new-deal-card");
  if (!card) return;
  card.classList.remove("hidden");

  // پیش‌فرض‌ها
  const today = todayISO();
  document.getElementById("tx_date").value = today;
  document.getElementById("tx_type").value = "";
  document.getElementById("base_currency").value = "";
  document.getElementById("target_currency").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("payable").value = "";
  document.getElementById("trader_rate").value = "";
  document.getElementById("exchanger_rate").value = "";
  document.getElementById("notes").value = "";

  // Deal ID پیشنهادی
  const customer = document.getElementById("customer").value;
  const suggested = generateDealId(customer, today, state.rows);
  document.getElementById("deal_id").value = suggested;

  // اسکرول تا فرم
  card.scrollIntoView({ behavior: "smooth" });
}

function hideNewDealForm() {
  const card = document.getElementById("new-deal-card");
  if (!card) return;
  card.classList.add("hidden");
}

function handleNewDealSubmit(evt) {
  evt.preventDefault();

  const deal_id = document.getElementById("deal_id").value.trim();
  const tx_date = document.getElementById("tx_date").value;
  const customer = document.getElementById("customer").value.trim();
  const exchanger = document.getElementById("exchanger").value.trim();
  const account_id = document.getElementById("account_id").value.trim();
  const tx_type = document.getElementById("tx_type").value;
  const base_currency = document.getElementById("base_currency").value;
  const target_currency = document.getElementById("target_currency").value;
  const amount = toNumber(document.getElementById("amount").value);
  let payable = toNumber(document.getElementById("payable").value);
  let trader_rate = toNumber(document.getElementById("trader_rate").value);
  const exchanger_rate = toNumber(
    document.getElementById("exchanger_rate").value
  );
  const notes = document.getElementById("notes").value.trim();

  if (!tx_date || !customer || !tx_type || !base_currency || amount == null) {
    alert("Please fill required fields.");
    return;
  }

  // اگر conversion و payable خالی بود → Auto calc
  if (tx_type === "conversion".toLowerCase() || tx_type === "conversion") {
    if (payable == null && trader_rate != null) {
      payable = autoCalcPayable(
        base_currency,
        target_currency,
        amount,
        trader_rate
      );
    }
  }

  // اطمینان از اینکه NaN ذخیره نشود
  if (!Number.isFinite(payable)) payable = null;
  if (!Number.isFinite(trader_rate)) trader_rate = null;

  // اگر Deal ID خالی بود، بساز
  const finalDealId =
    deal_id || generateDealId(customer, tx_date, state.rows);

  const newRow = {
    deal_id: finalDealId,
    tx_date,
    tx_type,
    customer,
    exchanger,
    account_id,
    base_currency,
    target_currency,
    amount,
    payable,
    trader_rate,
    exchanger_rate,
    trader: "",
    notes
  };

  state.localRows.push(newRow);
  saveLocalRows();
  mergeRows();
  renderDashboard();
  renderDeals();
  renderAlerts();

  hideNewDealForm();
  alert("New deal saved (local only).");
}

// ---------- Refresh / Init ----------

async function refreshApp() {
  const [remote, local] = await Promise.all([
    loadRemoteRows(),
    Promise.resolve(loadLocalRows())
  ]);

  state.remoteRows = remote;
  state.localRows = local;
  mergeRows();
  renderDashboard();
  renderDeals();
  renderAlerts();
}

function initEventHandlers() {
  const btnNewDeal = document.getElementById("btn-new-deal");
  const btnRefresh = document.getElementById("btn-refresh");
  const btnCancelNew = document.getElementById("btn-cancel-new-deal");
  const form = document.getElementById("newDealForm");

  if (btnNewDeal) {
    btnNewDeal.addEventListener("click", showNewDealForm);
  }
  if (btnRefresh) {
    btnRefresh.addEventListener("click", refreshApp);
  }
  if (btnCancelNew) {
    btnCancelNew.addEventListener("click", hideNewDealForm);
  }
  if (form) {
    form.addEventListener("submit", handleNewDealSubmit);
  }

  // برای سازگاری با نسخه‌های قبلی که onclick داشتند
  window.openNewDealForm = showNewDealForm;
  window.refreshApp = refreshApp;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch(err => console.error("SW registration failed", err));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initEventHandlers();
  refreshApp();
  registerServiceWorker();
});
