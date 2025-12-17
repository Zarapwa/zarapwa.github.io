(() => {
  "use strict";

  const views = document.querySelectorAll(".view");
  const buttons = document.querySelectorAll(".app-nav button");

  let data = [];

  function showView(name) {
    views.forEach(v => {
      v.classList.toggle("hidden", v.id !== name);
    });

    buttons.forEach(b => {
      b.classList.toggle("active", b.dataset.view === name);
    });
  }

  function renderDashboard() {
    const uniqueDeals = new Set(data.map(d => d.deal_id)).size;

    document.getElementById("dashboard").innerHTML = `
      <h2>Dashboard</h2>
      <div class="card">Total Deals: <b>${uniqueDeals}</b></div>
      <div class="card">Total Transactions: <b>${data.length}</b></div>
    `;
  }

  function renderDeals() {
    const deals = [...new Set(data.map(d => d.deal_id))];
    document.getElementById("deals").innerHTML = `
      <h2>Deals (${deals.length})</h2>
      ${deals.map(d => `<div class="card">${d}</div>`).join("")}
    `;
  }

  function renderTransactions() {
    document.getElementById("transactions").innerHTML = `
      <h2>Transactions</h2>
      ${data.map(t => `
        <div class="card">
          <b>${t.deal_id}</b><br/>
          ${t.tx_type} – ${t.amount} ${t.base_currency}
        </div>
      `).join("")}
    `;
  }

  function renderReports() {
    document.getElementById("reports").innerHTML = `
      <h2>Reports</h2>
      <div class="card">Report generator placeholder</div>
    `;
  }

  function renderNewDeal() {
    document.getElementById("new-deal").innerHTML = `
      <h2>New Deal</h2>
      <div class="card">New deal form placeholder</div>
    `;
  }

  function renderAll() {
    renderDashboard();
    renderDeals();
    renderTransactions();
    renderReports();
    renderNewDeal();
  }

  fetch("data.json")
    .then(r => r.json())
    .then(json => {
      data = json;
      renderAll();
      showView("dashboard");
    })
    .catch(err => {
      document.body.innerHTML = "<h2>Failed to load data.json</h2>";
      console.error(err);
    });

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      showView(btn.dataset.view);
    });
  });

})();
