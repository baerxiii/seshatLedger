const supabaseUrl = window.SESHAT_CONFIG?.supabaseUrl;
const supabaseAnonKey = window.SESHAT_CONFIG?.supabaseAnonKey;

const supabaseClient = supabaseUrl && supabaseAnonKey
  ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
  : null;

const STORAGE_KEYS = {
  paycheck: "seshat_paycheck",
  categories: "seshat_categories"
};

let budgetState = {
  paycheck: 0,
  categories: []
};

const elements = {
  email: document.getElementById("emailInput"),
  password: document.getElementById("passwordInput"),
  authStatus: document.getElementById("authStatus"),
  signInBtn: document.getElementById("signInBtn"),
  signUpBtn: document.getElementById("signUpBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  paycheckInput: document.getElementById("paycheckInput"),
  categoryName: document.getElementById("categoryName"),
  categoryAmount: document.getElementById("categoryAmount"),
  savePaycheckBtn: document.getElementById("savePaycheckBtn"),
  addCategoryBtn: document.getElementById("addCategoryBtn"),
  resetBtn: document.getElementById("resetBtn"),
  incomeValue: document.getElementById("incomeValue"),
  budgetedValue: document.getElementById("budgetedValue"),
  remainingValue: document.getElementById("remainingValue"),
  budgetTableBody: document.getElementById("budgetTableBody")
};

function readLocalBudget() {
  try {
    const paycheck = Number(localStorage.getItem(STORAGE_KEYS.paycheck) || 0);
    const categories = JSON.parse(localStorage.getItem(STORAGE_KEYS.categories) || "[]");
    return {
      paycheck: Number.isFinite(paycheck) ? paycheck : 0,
      categories: Array.isArray(categories) ? categories : []
    };
  } catch (error) {
    return { paycheck: 0, categories: [] };
  }
}

function writeLocalBudget() {
  localStorage.setItem(STORAGE_KEYS.paycheck, String(budgetState.paycheck));
  localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(budgetState.categories));
}

async function getCurrentUser() {
  if (!supabaseClient) return null;
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function loadBudgetFromSupabase() {
  if (!supabaseClient) return readLocalBudget();

  const user = await getCurrentUser();
  if (!user) return readLocalBudget();

  const { data, error } = await supabaseClient
    .from("seshat_budget")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error || !Array.isArray(data) || !data.length) {
    return readLocalBudget();
  }

  const record = data[0];
  return {
    paycheck: Number(record.paycheck || 0),
    categories: Array.isArray(record.categories) ? record.categories : []
  };
}

async function saveBudgetToSupabase() {
  if (!supabaseClient) {
    writeLocalBudget();
    return;
  }

  const user = await getCurrentUser();
  if (!user) {
    writeLocalBudget();
    return;
  }

  const { error } = await supabaseClient
    .from("seshat_budget")
    .upsert(
      [{
        id: user.id,
        user_id: user.id,
        paycheck: budgetState.paycheck,
        categories: budgetState.categories,
        updated_at: new Date().toISOString()
      }],
      { onConflict: "id" }
    );

  if (error) {
    console.error("Supabase save failed:", error);
    writeLocalBudget();
  }
}

function syncInputs() {
  elements.paycheckInput.value = String(budgetState.paycheck || 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value || 0));
}

function render() {
  const totalBudgeted = budgetState.categories.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const remaining = Number(budgetState.paycheck || 0) - totalBudgeted;

  elements.incomeValue.textContent = formatCurrency(budgetState.paycheck || 0);
  elements.budgetedValue.textContent = formatCurrency(totalBudgeted);
  elements.remainingValue.textContent = formatCurrency(remaining);
  elements.remainingValue.classList.toggle("positive", remaining >= 0);
  elements.remainingValue.classList.toggle("negative", remaining < 0);

  elements.budgetTableBody.innerHTML = "";

  if (!budgetState.categories.length) {
    elements.budgetTableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center; color:#53627b;">No categories yet.</td>
      </tr>
    `;
    return;
  }

  budgetState.categories.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${formatCurrency(item.amount)}</td>
      <td><button class="delete-btn" type="button" data-index="${index}">Delete</button></td>
    `;
    elements.budgetTableBody.appendChild(row);
  });

  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      budgetState.categories.splice(index, 1);
      writeLocalBudget();
      saveBudgetToSupabase();
      render();
    });
  });
}

async function savePaycheck() {
  const raw = Number(elements.paycheckInput.value || 0);
  budgetState.paycheck = raw;
  writeLocalBudget();
  await saveBudgetToSupabase();
  render();
}

function addCategory() {
  const name = elements.categoryName.value.trim();
  const amount = Number(elements.categoryAmount.value || 0);

  if (!name || !Number.isFinite(amount) || amount <= 0) {
    alert("Please enter a valid category name and amount.");
    return;
  }

  budgetState.categories.push({ name, amount });
  elements.categoryName.value = "";
  elements.categoryAmount.value = "";

  writeLocalBudget();
  saveBudgetToSupabase();
  render();
}

async function resetBudget() {
  if (!confirm("Reset your entire budget?")) return;

  budgetState = { paycheck: 0, categories: [] };
  writeLocalBudget();

  if (supabaseClient) {
    const user = await getCurrentUser();
    if (user) {
      await supabaseClient.from("seshat_budget").upsert([
        {
          id: user.id,
          user_id: user.id,
          paycheck: 0,
          categories: [],
          updated_at: new Date().toISOString()
        }
      ], { onConflict: "id" });
    }
  }

  render();
}

async function updateAuthUI() {
  if (!supabaseClient) {
    elements.authStatus.textContent = "Supabase not configured. Budget data is local-only.";
    elements.signInBtn.disabled = true;
    elements.signUpBtn.disabled = true;
    elements.signOutBtn.disabled = true;
    return;
  }

  const user = await getCurrentUser();
  elements.authStatus.textContent = user
    ? `Signed in as ${user.email}`
    : "Not signed in";

  elements.signInBtn.disabled = !!user;
  elements.signUpBtn.disabled = !!user;
  elements.signOutBtn.disabled = !user;
}

async function signIn() {
  if (!supabaseClient) return;

  const email = elements.email.value.trim();
  const password = elements.password.value.trim();

  if (!email || !password) {
    elements.authStatus.textContent = "Enter both email and password.";
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    elements.authStatus.textContent = error.message;
    return;
  }

  elements.password.value = "";
  await updateAuthUI();
  const user = await getCurrentUser();
  if (user) {
    budgetState = await loadBudgetFromSupabase();
    syncInputs();
    render();
  }
}

async function signUp() {
  if (!supabaseClient) return;

  const email = elements.email.value.trim();
  const password = elements.password.value.trim();

  if (!email || !password) {
    elements.authStatus.textContent = "Enter both email and password.";
    return;
  }

  const { error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    elements.authStatus.textContent = error.message;
    return;
  }

  elements.password.value = "";
  elements.authStatus.textContent = "Account created. Check your email to confirm.";
}

async function signOut() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  await updateAuthUI();
}

async function init() {
  budgetState = readLocalBudget();
  syncInputs();
  render();

  if (supabaseClient) {
    await updateAuthUI();
    const user = await getCurrentUser();
    if (user) {
      budgetState = await loadBudgetFromSupabase();
      render();
    }
  }

  elements.savePaycheckBtn.addEventListener("click", savePaycheck);
  elements.addCategoryBtn.addEventListener("click", addCategory);
  elements.resetBtn.addEventListener("click", resetBudget);
  elements.signInBtn.addEventListener("click", signIn);
  elements.signUpBtn.addEventListener("click", signUp);
  elements.signOutBtn.addEventListener("click", signOut);
}

init();
