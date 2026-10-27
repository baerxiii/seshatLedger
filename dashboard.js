const STORAGE_KEY = "seshatBudgetStateV1";

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { paycheck: 0, accounts: [], entries: [] };
    }
    return JSON.parse(raw);
  } catch (error) {
    return { paycheck: 0, accounts: [], entries: [] };
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value || 0));
}

function buildMonthlyTrend(entries) {
  const trend = {};

  entries.forEach((entry) => {
    const key = entry.month || "Unassigned";
    trend[key] = (trend[key] || 0) + Number(entry.amount || 0);
  });

  return Object.entries(trend)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6);
}

function renderDashboard() {
  const state = readState();
  const totalSpent = state.entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const remaining = Number(state.paycheck || 0) - totalSpent;

  const incomeEl = document.getElementById("dashboardIncome");
  const spentEl = document.getElementById("dashboardSpent");
  const remainingEl = document.getElementById("dashboardRemaining");

  if (incomeEl) incomeEl.textContent = formatCurrency(state.paycheck || 0);
  if (spentEl) spentEl.textContent = formatCurrency(totalSpent);
  if (remainingEl) {
    remainingEl.textContent = formatCurrency(remaining);
    remainingEl.classList.toggle("positive", remaining >= 0);
    remainingEl.classList.toggle("negative", remaining < 0);
  }

  const accountsContainer = document.getElementById("dashboardAccounts");
  if (accountsContainer) {
    accountsContainer.innerHTML = "";

    if (!state.accounts.length) {
      accountsContainer.innerHTML = '<p class="empty-state">No accounts yet. Add some in the budget page.</p>';
    } else {
      state.accounts.forEach((account) => {
        const row = document.createElement("div");
        row.className = "account-pill";
        row.innerHTML = `
          <div>
            <strong>${account.name}</strong>
            <small>${account.type}</small>
          </div>
          <span>${formatCurrency(account.balance)}</span>
        `;
        accountsContainer.appendChild(row);
      });
    }
  }

  const trendContainer = document.getElementById("trendBars");
  if (trendContainer) {
    const monthlyTrend = buildMonthlyTrend(state.entries);

    if (!monthlyTrend.length) {
      trendContainer.innerHTML = '<p class="empty-state">No monthly data yet. Add a budget entry to start trending.</p>';
    } else {
      const maxValue = Math.max(...monthlyTrend.map(([, value]) => value), 1);

      trendContainer.innerHTML = "";
      monthlyTrend.forEach(([month, total]) => {
        const row = document.createElement("div");
        row.className = "trend-row";
        row.innerHTML = `
          <div class="trend-label">${month}</div>
          <div class="trend-bar-track">
            <div class="trend-bar-fill" style="width: ${(total / maxValue) * 100}%"></div>
          </div>
          <div class="trend-value">${formatCurrency(total)}</div>
        `;
        trendContainer.appendChild(row);
      });
    }
  }

  const categoryBreakdownEl = document.getElementById("categoryBreakdown");
  if (categoryBreakdownEl) {
    const breakdown = {};
    state.entries.forEach((entry) => {
      breakdown[entry.name] = (breakdown[entry.name] || 0) + Number(entry.amount || 0);
    });

    const items = Object.entries(breakdown).sort(([, left], [, right]) => right - left);

    if (!items.length) {
      categoryBreakdownEl.innerHTML = '<p class="empty-state">No category data yet.</p>';
      return;
    }

    const largest = Math.max(...items.map(([, value]) => value), 1);
    categoryBreakdownEl.innerHTML = "";

    items.forEach(([name, value]) => {
      const block = document.createElement("div");
      block.className = "breakdown-item";
      block.innerHTML = `
        <div class="breakdown-head">
          <span>${name}</span>
          <strong>${formatCurrency(value)}</strong>
        </div>
        <div class="breakdown-track">
          <div class="breakdown-fill" style="width: ${(value / largest) * 100}%"></div>
        </div>
      `;
      categoryBreakdownEl.appendChild(block);
    });
  }
}

renderDashboard();
