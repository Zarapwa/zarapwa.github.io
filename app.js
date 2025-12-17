// EXCHANGEMINI – mini FULL + Debug
const APP_VERSION = "mini-1.0.3";

const state = {
  allTransactions: [],
  deals: {},        // deal_id -> {deal_id, customer, base_currency, total_amount, count}
  today: null,
  lastLoadedAt: null
};

const LOCAL_KEY = "exchangeMini.localTx.v1";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("app-version").textContent = APP_VERSION;
  setupNav();
  setupDebug();
  setupNewDealForm();
  detectToday();
  loadData().then(() => {
    renderAll();
    showView("dashboard");
    logDebug("✅ App initialized.");
  });
});

/* ---------- CORE ---------- */

function detectToday() {
  const now = new Date();
  state.today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const label = document.getElementById("today-label");
  if (label) {
    label.textContent = state.today;
  }
}

async function loadData() {
  logDebug("Loading data.json ...");
  try {
    const resp = await fetch("data.json?v=" + APP_VERSION + "&t=" + Date.now());
    const json = await resp.json();
    const baseTx = Array.isArray(json) ? json : json.transactions || [];
    const localTx = loadLocalOverrides();
    state.allTransactions = baseTx.concat(localTx);
    state.lastLoadedAt = new Date();

    buildDealsPivot();
    logDebug(
      `Loaded ${baseTx.length} records from data.json + ${localTx.length} local override(s).`
    );
  } catch (err) {
    console.error(err);
    logDebug("❌ Error loading data.json: " + err.message);
  }
}

function buildDealsPivot() {
  const map = {};
  for (const tx of state.allTransactions) {
    const dealId = tx.deal_id || tx.dealID || "NO-ID";
    const base = tx.base_currency || tx.base || "";
    const amountNum = Number(tx.amount || 0);
    const customer = tx.customer || tx.account_to || tx.account_from || "";
    if (!map[dealId]) {
      map[dealId] = {
        deal_id: dealId,
        base_currency: base,
        total_amount: 0,
        count: 0,
        customer: customer
      };
    }
    map[dealId].total_amount += isFinite(amountNum) ? amountNum : 0;
    map[dealId].count += 1;
  }
  state.deals = map;
}

/* ---------- RENDER ---------- */

function renderAll() {
  renderDashboard();
  renderDeals();
  renderTransactions();
  renderReportSelector();
}

function renderDashboard() {
  const dealsArr = Object.values(state.deals);
  const totalDeals = dealsArr.length;
  const totalTx = state.allTransactions.length;
  const todaysDeals = new Set();

  for (const tx of state.allTransactions) {
    const date = (tx.tx_date || tx.date || "").slice(0, 10);
    if (date === state.today) {
      const id = tx.deal_id || tx.dealID || "NO-ID";
      todaysDeals.add(id);
    }
  }

  document.getElementById("total-deals").textContent = totalDeals;
  document.getElementById("total-transactions").textContent = totalTx;
  document.getElementById("todays-deals").textContent = todaysDeals.size;

  // currency summary
  const currencySummary = {};
  for (const tx of state.allTransactions) {
    const cur = tx.base_currency || tx.base || "N/A";
    const amt = Number(tx.amount || 0);
    if (!currencySummary[cur]) currencySummary[cur] = 0;
    currencySummary[cur] += isFinite(amt) ? amt : 0;
  }

  const wrapper = document.getElementById("currency-summary");
  wrapper.innerHTML = "";
  const entries = Object.entries(currencySummary);
  if (!entries.length) {
    wrapper.textContent = "No data.";
    return;
  }

  entries.forEach(([cur, total]) => {
    const row = document.createElement("div");
    row.className = "mini-table-row";
    const left = document.createElement("span");
    left.textContent = cur;
    const right = document.createElement("span");
    right.textContent = formatNumber(total);
    row.append(left, right);
    wrapper.appendChild(row);
  });
}

function renderDeals() {
  const tbody = document.getElementById("deals-tbody");
  tbody.innerHTML = "";
  const dealsArr = Object.values(state.deals);

  document.getElementById("deals-count-label").textContent =
    dealsArr.length + " deal(s)";

  dealsArr.sort((a, b) => a.deal_id.localeCompare(b.deal_id));

  for (const d of dealsArr) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(d.deal_id)}</td>
      <td>${escapeHtml(d.customer || "")}</td>
      <td>${escapeHtml(d.base_currency || "")}</td>
      <td>${formatNumber(d.total_amount)}</td>
      <td>${d.count}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderTransactions() {
  const tbody = document.getElementById("tx-tbody");
  tbody.innerHTML = "";
  const txs = [...state.allTransactions];

  txs.sort((a, b) => {
    const da = (a.tx_date || a.date || "").localeCompare(b.tx_date || b.date || "");
    if (da !== 0) return da;
    return (a.deal_id || "").localeCompare(b.deal_id || "");
  });

  document.getElementById("tx-count-label").textContent =
    txs.length + " transaction(s)";

  for (const tx of txs) {
    const date = (tx.tx_date || tx.date || "").slice(0, 10);
    const deal = tx.deal_id || tx.dealID || "";
    const type = tx.tx_type || tx.type || "";
    const base = tx.base_currency || tx.base || "";
    const amount = formatNumber(tx.amount);
    const target = tx.target_currency || "";
    const payable = formatNumber(tx.payable || tx.target_amount);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(date)}</td>
      <td>${escapeHtml(deal)}</td>
      <td>${escapeHtml(type)}</td>
      <td>${escapeHtml(base)}</td>
      <td>${amount}</td>
      <td>${escapeHtml(target)}</td>
      <td>${payable}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderReportSelector() {
  const select = document.getElementById("report-deal-select");
  const output = document.getElementById("report-output");
  select.innerHTML = "";

  const dealsArr = Object.values(state.deals).sort((a, b) =>
    a.deal_id.localeCompare(b.deal_id)
  );

  if (!dealsArr.length) {
    const opt = document.createElement("option");
    opt.textContent = "No deals";
    select.appendChild(opt);
    output.value = "";
    return;
  }

  dealsArr.forEach((d, idx) => {
    const opt = document.createElement("option");
    opt.value = d.deal_id;
    opt.textContent = d.deal_id;
    if (idx === 0) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    output.value = buildReportText(select.value);
  });

  // initial
  output.value = buildReportText(dealsArr[0].deal_id);
}

function buildReportText(dealId) {
  const txs = state.allTransactions.filter(
    (t) => (t.deal_id || t.dealID || "") === dealId
  );
  if (!txs.length) return "No transactions for this deal.";

  const first = txs[0];
  const customer = first.customer || first.account_to || first.account_from || "";
  const header = `GHorbanzadeh Deal Report
🆔 Deal ID: ${dealId}
━━━━━━━━━━━━━━━
💱 Transactions`;

  const lines = [];
  for (const tx of txs) {
    const type = (tx.tx_type || tx.type || "").toLowerCase();
    const base = tx.base_currency || tx.base || "";
    const amount = formatNumber(tx.amount);
    const rate = tx.trader_rate || tx.rate || "";
    const target = tx.target_currency || "";
    const payable = formatNumber(tx.payable || tx.target_amount);
    if (type.includes("inflow")) {
      lines.push(`📥 Inflow\n➕ ${amount} ${base} – Inflow`);
    } else if (type.includes("outflow")) {
      lines.push(`📤 Outflow\n➖ ${amount} ${base} – Outflow`);
    } else if (type.includes("conv")) {
      lines.push(
        `♻️ Conversion\n➖ ${amount} ${base} × ${rate} → ${payable} ${target}`
      );
    } else {
      lines.push(`• ${amount} ${base} – ${tx.tx_type || tx.type || "Tx"}`);
    }
  }

  const summary = `━━━━━━━━━━━━━━━
Customer: ${customer || "-"}
(Generated by ExchangeMini v${APP_VERSION})`;

  return header + "\n" + lines.join("\n") + "\n" + summary;
}

/* ---------- NAV ---------- */

function setupNav() {
  // event delegation = روی iOS هم مطمئن‌تره
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-link");
    if (!btn) return;

    const view = btn.dataset.view;
    if (!view) return;

    // Debug
    if (window.__debugLog) window.__debugLog(`NAV click -> ${view}`);

    showView(view);

    document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
}

function showView(name) {
  const views = document.querySelectorAll("section.view");
  views.forEach(v => {
    const isTarget = (v.dataset.view === name);

    // دو حالت را همزمان پوشش می‌دهیم (active و hidden)
    v.classList.toggle("active", isTarget);
    v.classList.toggle("hidden", !isTarget);

    // اگر قبلاً view-hidden داشتی هم خاموشش کن
    v.classList.toggle("view-hidden", !isTarget);
  });

  // Debug
  if (window.__debugLog) window.__debugLog(`showView() -> ${name}`);
}
function setupNewDealForm() {
  const btn = document.getElementById("nd-save");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const tx = {
      deal_id: document.getElementById("nd-deal-id").value.trim(),
      tx_date: document.getElementById("nd-date").value,
      tx_type: document.getElementById("nd-type").value.trim(),
      base_currency: document.getElementById("nd-base").value.trim(),
      amount: Number(document.getElementById("nd-amount").value),
      target_currency: document.getElementById("nd-target").value.trim(),
      payable: Number(document.getElementById("nd-payable").value),
      source: "LOCAL"
    };
    if (!tx.deal_id) {
      alert("Deal ID is required.");
      return;
    }
    const stored = loadLocalOverrides();
    stored.push(tx);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(stored));
    logDebug("💾 Saved local transaction override for deal " + tx.deal_id);
    buildDealsPivot();
    renderAll();
    showView("dashboard");
  });
}

function loadLocalOverrides() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Local override parse error", e);
    return [];
  }
}

/* ---------- DEBUG PANEL ---------- */

function setupDebug() {
  const btn = document.getElementById("debug-button");
  const panel = document.getElementById("debug-panel");
  const closeBtn = document.getElementById("debug-close");
  const refreshBtn = document.getElementById("debug-refresh");
  const clearBtn = document.getElementById("debug-clear-local");
  const swBtn = document.getElementById("debug-unregister-sw");

  if (!btn || !panel) return;

  btn.addEventListener("click", () => {
    panel.classList.remove("hidden");
    renderDebugInfo();
  });
  closeBtn.addEventListener("click", () => {
    panel.classList.add("hidden");
  });

  refreshBtn.addEventListener("click", async () => {
    logDebug("🔄 Soft reload requested from Debug.");
    await loadData();
    renderAll();
    renderDebugInfo();
  });

  clearBtn.addEventListener("click", () => {
    localStorage.removeItem(LOCAL_KEY);
    logDebug("🧹 Local overrides cleared.");
    loadData().then(() => {
      renderAll();
      renderDebugInfo();
    });
  });

  swBtn.addEventListener("click", async () => {
    if (!("serviceWorker" in navigator)) {
      logDebug("Service workers are not supported in this browser.");
      return;
    }
    const regs = await navigator.serviceWorker.getRegistrations();
    if (!regs.length) {
      logDebug("No service worker registrations found.");
      return;
    }
    for (const r of regs) {
      await r.unregister();
    }
    logDebug(
      "🧨 Service workers unregistered. Close all Safari tabs for this site and reopen."
    );
  });
}

function renderDebugInfo() {
  const logEl = document.getElementById("debug-log");
  const totalDeals = Object.keys(state.deals).length;
  const totalTx = state.allTransactions.length;
  const last = state.lastLoadedAt
    ? state.lastLoadedAt.toLocaleString()
    : "not loaded";

  const lines = [
    `Version: v${APP_VERSION}`,
    `Total deals: ${totalDeals}`,
    `Total transactions: ${totalTx}`,
    `Today: ${state.today}`,
    `Last loaded: ${last}`
  ];

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      const swLines = [`Service worker registrations: ${regs.length}`];
      regs.forEach((r, idx) => {
        swLines.push(
          ` [${idx}] scope=${r.scope} active=${!!r.active} installing=${!!r.installing}`
        );
      });
      logEl.textContent = lines.concat(swLines).join("\n");
    });
  } else {
    logEl.textContent = lines.concat(["Service workers: not supported"]).join("\n");
  }
}

function logDebug(msg) {
  console.log("[ExchangeMini]", msg);
  const logEl = document.getElementById("debug-log");
  if (!logEl) return;
  logEl.textContent += (logEl.textContent ? "\n" : "") + msg;
}

/* ---------- HELPERS ---------- */

function formatNumber(value) {
  const n = Number(value);
  if (!isFinite(n)) return "";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
document.addEventListener("DOMContentLoaded", () => {
  setupNav();
});

