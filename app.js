async function getCurrentUser(){

    const {
        data:{user}
    } = await window.ledgerSB
        .auth
        .getUser();

    return user;
}

getCurrentUser()
.then(user=>{

    console.log(
        "Ledger User:",
        user
    );

});

const STORAGE_KEY = "seshatBudgetStateV1";

function uid() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultState() {
  return {
    paycheck: 0,
    accounts: [{ id: uid(), name: "Checking", type: "Checking", balance: 0 }],
    entries: []
  };
}

const elements = {
  paycheckInput: document.getElementById("paycheckInput"),
  savePaycheckBtn: document.getElementById("savePaycheckBtn"),
  categoryName: document.getElementById("categoryName"),
  categoryAmount: document.getElementById("categoryAmount"),
  budgetMonth: document.getElementById("budgetMonth"),
  budgetAccount: document.getElementById("budgetAccount"),
  addCategoryBtn: document.getElementById("addCategoryBtn"),
  accountName: document.getElementById("accountName"),
  accountType: document.getElementById("accountType"),
  accountBalance: document.getElementById("accountBalance"),
  addAccountBtn: document.getElementById("addAccountBtn"),
  accountList: document.getElementById("accountList"),
  incomeValue: document.getElementById("incomeValue"),
  budgetedValue: document.getElementById("budgetedValue"),
  remainingValue: document.getElementById("remainingValue"),
  budgetTableBody: document.getElementById("budgetTableBody"),
  resetBtn: document.getElementById("resetBtn")
};

let budgetState = readState();

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    const parsed = JSON.parse(raw);
    return {
      paycheck: Number(parsed.paycheck) || 0,
      accounts: Array.isArray(parsed.accounts) && parsed.accounts.length ? parsed.accounts : defaultState().accounts,
      entries: Array.isArray(parsed.entries) ? parsed.entries : []
    };
  } catch (error) {
    console.error("Failed to read budget state:", error);
    return defaultState();
  }
}

function writeState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(budgetState));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value || 0));
}

function getMonthValue() {
  if (elements.budgetMonth && elements.budgetMonth.value) return elements.budgetMonth.value;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getAccountById(accountId) {
  return budgetState.accounts.find((account) => account.id === accountId) || null;
}

function renderAccountOptions() {
  if (!elements.budgetAccount) return;

  const currentValue = elements.budgetAccount.value;
  elements.budgetAccount.innerHTML = '<option value="">Select an account</option>';

  budgetState.accounts.forEach((account) => {
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = `${account.name} (${account.type})`;
    if (currentValue === account.id) option.selected = true;
    elements.budgetAccount.appendChild(option);
  });

  if (!elements.budgetAccount.value && budgetState.accounts.length) {
    elements.budgetAccount.value = budgetState.accounts[0].id;
  }
}

function renderAccounts() {
  if (!elements.accountList) return;

  elements.accountList.innerHTML = "";

  if (!budgetState.accounts.length) {
    elements.accountList.innerHTML = '<p class="empty-state">No accounts yet. Add your checking, savings, or credit accounts.</p>';
    return;
  }

  budgetState.accounts.forEach((account) => {
    const card = document.createElement("div");
    card.className = "account-pill";
    card.innerHTML = `
      <div>
        <strong>${account.name}</strong>
        <small>${account.type}</small>
      </div>
      <div class="account-meta">
        <span>${formatCurrency(account.balance)}</span>
        <button type="button" class="delete-btn small" data-account-id="${account.id}">Remove</button>
      </div>
    `;
    elements.accountList.appendChild(card);
  });

  elements.accountList.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const accountId = button.dataset.accountId;
      budgetState.accounts = budgetState.accounts.filter((account) => account.id !== accountId);
      budgetState.entries = budgetState.entries.filter((entry) => entry.accountId !== accountId);
      writeState();
      render();
    });
  });
}

function renderTable() {
  if (!elements.budgetTableBody) return;

  elements.budgetTableBody.innerHTML = "";

  if (!budgetState.entries.length) {
    elements.budgetTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">No budget entries yet. Add your first expense.</td>
      </tr>
    `;
    return;
  }

  budgetState.entries.forEach((entry) => {
    const account = getAccountById(entry.accountId);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.name}</td>
      <td>${entry.month}</td>
      <td>${account ? account.name : "Unknown"}</td>
      <td>${formatCurrency(entry.amount)}</td>
      <td><button type="button" class="delete-btn small" data-entry-id="${entry.id}">Delete</button></td>
    `;
    elements.budgetTableBody.appendChild(row);
  });

  elements.budgetTableBody.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const entryId = button.dataset.entryId;
      budgetState.entries = budgetState.entries.filter((entry) => entry.id !== entryId);
      writeState();
      render();
    });
  });
}

function renderSummary() {
  if (!elements.incomeValue || !elements.budgetedValue || !elements.remainingValue) return;

  const totalBudgeted = budgetState.entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const remaining = Number(budgetState.paycheck || 0) - totalBudgeted;

  elements.incomeValue.textContent = formatCurrency(budgetState.paycheck || 0);
  elements.budgetedValue.textContent = formatCurrency(totalBudgeted);
  elements.remainingValue.textContent = formatCurrency(remaining);
  elements.remainingValue.classList.toggle("positive", remaining >= 0);
  elements.remainingValue.classList.toggle("negative", remaining < 0);
}

function syncInputs() {
  if (elements.paycheckInput) elements.paycheckInput.value = String(budgetState.paycheck || 0);
  if (elements.budgetMonth) elements.budgetMonth.value = getMonthValue();
  renderAccountOptions();
}

function render() {
  syncInputs();
  renderAccounts();
  renderSummary();
  renderTable();
}

function savePaycheck() {
  const value = Number(elements.paycheckInput.value || 0);
  budgetState.paycheck = Number.isFinite(value) ? value : 0;
  writeState();
  render();
}

function addAccount() {
  const name = (elements.accountName.value || "").trim();
  const type = elements.accountType.value;
  const balance = Number(elements.accountBalance.value || 0);

  if (!name) {
    alert("Please enter an account name.");
    return;
  }

  budgetState.accounts.push({
    id: uid(),
    name,
    type,
    balance: Number.isFinite(balance) ? balance : 0
  });

  elements.accountName.value = "";
  elements.accountBalance.value = "";
  writeState();
  render();
}

function addCategory() {
  const name = (elements.categoryName.value || "").trim();
  const amount = Number(elements.categoryAmount.value || 0);
  const month = elements.budgetMonth.value || getMonthValue();
  const accountId = elements.budgetAccount.value;

  if (!name || !Number.isFinite(amount) || amount <= 0) {
    alert("Please add a valid category name and amount.");
    return;
  }

  if (!accountId) {
    alert("Please select or add an account first.");
    return;
  }

  budgetState.entries.push({
    id: uid(),
    name,
    amount,
    month,
    accountId
  });

  elements.categoryName.value = "";
  elements.categoryAmount.value = "";
  writeState();
  render();
}

async function resetBudget() {
  if (!confirm("Reset your full budget and remove all entries?")) return;

  budgetState = defaultState();
  writeState();
  render();
}

function initBudgetPage() {
  if (elements.savePaycheckBtn) elements.savePaycheckBtn.addEventListener("click", savePaycheck);
  if (elements.addCategoryBtn) elements.addCategoryBtn.addEventListener("click", addCategory);
  if (elements.addAccountBtn) elements.addAccountBtn.addEventListener("click", addAccount);
  if (elements.resetBtn) elements.resetBtn.addEventListener("click", resetBudget);
  render();
}

if (document.body && document.body.dataset.page === "budget") {
  initBudgetPage();
}
