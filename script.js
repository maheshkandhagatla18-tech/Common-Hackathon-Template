// ============================================================
// Student Expense Tracker - Integrated Logic & Charting
// ============================================================

// ── CONFIGURATION & CONSTANTS ────────────────────────────────

const STORAGE_KEY_EXPENSES = "student_expenses";
const STORAGE_KEY_BUDGET   = "student_budget";
const DEFAULT_BUDGET       = 5000;

// Chart Categories — must match the `category` values in your HTML <select>
const CHART_CATEGORIES = ["food", "transport", "academics", "entertainment"];
const CHART_LABELS     = ["Food", "Transport", "Academics", "Entertainment"];
const CHART_COLORS     = ["#3ecf93", "#378add", "#7c6df5", "#f5a623"];

let pieChart = null;

// ── DATA PERSISTENCE (localStorage) ──────────────────────────

function loadExpenses() {
  const stored = localStorage.getItem(STORAGE_KEY_EXPENSES);
  return stored ? JSON.parse(stored) : [];
}

function saveExpenses(expenses) {
  localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(expenses));
}

function loadBudget() {
  const stored = localStorage.getItem(STORAGE_KEY_BUDGET);
  return stored ? parseFloat(stored) : DEFAULT_BUDGET;
}

function saveBudget(amount) {
  localStorage.setItem(STORAGE_KEY_BUDGET, amount.toString());
}

// ── HELPER FUNCTIONS ─────────────────────────────────────────

function formatCurrency(amount) {
  return "₹" + amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function calculateCategoryTotals(expenses) {
  // Initialize totals for all tracked categories
  const totals = { food: 0, transport: 0, academics: 0, entertainment: 0 };
  expenses.forEach(exp => {
    if (totals[exp.category] !== undefined) {
      totals[exp.category] += exp.amount;
    }
  });
  return totals;
}

function getTotalsArray(totalsObj) {
  return CHART_CATEGORIES.map(cat => totalsObj[cat] || 0);
}

// ── CHART CORE ───────────────────────────────────────────────

function initPieChart(dataValues) {
  const canvas = document.getElementById("expenseChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  pieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: CHART_LABELS,
      datasets: [{
        label: "Spending (₹)",
        data: dataValues,
        backgroundColor: CHART_COLORS,
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: { size: 12, family: "'Segoe UI', Arial, sans-serif" },
            padding: 14,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
              return ` ${formatCurrency(value)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderChart(expenses) {
  const canvas = document.getElementById("expenseChart");
  const emptyState = document.getElementById("chart-empty-state");

  if (!canvas || !emptyState) return;

  const totalsObj = calculateCategoryTotals(expenses);
  const dataValues = getTotalsArray(totalsObj);
  const hasData = dataValues.some(v => v > 0);

  if (!hasData) {
    canvas.style.display = "none";
    emptyState.style.display = "flex";
    return;
  }

  canvas.style.display = "block";
  emptyState.style.display = "none";

  if (!pieChart) {
    initPieChart(dataValues);
  } else {
    pieChart.data.datasets[0].data = dataValues;
    pieChart.update();
  }
}

// ── CORE LOGIC ───────────────────────────────────────────────

function addExpense(amount, category) {
  const expenses = loadExpenses();
  expenses.push({
    id: Date.now(),
    amount: parseFloat(amount),
    category: category,
    date: new Date().toLocaleDateString()
  });
  saveExpenses(expenses);
  updateUI();
}

function deleteExpense(id) {
  const expenses = loadExpenses().filter(exp => exp.id !== id);
  saveExpenses(expenses);
  updateUI();
}

// ── UI UPDATE ────────────────────────────────────────────────

function updateUI() {
  const expenses = loadExpenses();
  const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const budget = loadBudget();
  const remaining = budget - totalSpent;

  // Update Summary
  const totalEl = document.getElementById("total-spent");
  const remainingEl = document.getElementById("remaining-balance");
  
  if (totalEl) totalEl.textContent = totalSpent.toFixed(2);
  if (remainingEl) {
    remainingEl.textContent = remaining.toFixed(2);
    remainingEl.style.color = remaining < 0 ? "#e74c3c" : "";
  }

  // Update List
  renderExpenseList(expenses);

  // Update Chart
  renderChart(expenses);
}

function renderExpenseList(expenses) {
  const listEl = document.getElementById("expense-list");
  if (!listEl) return;

  listEl.innerHTML = expenses.length === 0 
    ? "<li>No expenses yet. Add one above!</li>" 
    : "";

  [...expenses].reverse().forEach(exp => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="exp-category">${exp.category}</span>
      <span class="exp-date">${exp.date}</span>
      <span class="exp-amount">₹${exp.amount.toFixed(2)}</span>
      <button class="delete-btn" onclick="deleteExpense(${exp.id})">✕</button>
    `;
    listEl.appendChild(li);
  });
}

// ── INITIALIZATION ───────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Add Expense Event
  const addBtn = document.getElementById("add-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const amountInput = document.getElementById("amount-input");
      const categoryInput = document.getElementById("category-input");
      const amt = amountInput.value.trim();
      
      if (amt && !isNaN(amt) && parseFloat(amt) > 0) {
        addExpense(amt, categoryInput.value);
        amountInput.value = "";
      } else {
        alert("Enter a valid amount.");
      }
    });
  }

  // Set Budget Event
  const setBudgetBtn = document.getElementById("set-budget-btn");
  if (setBudgetBtn) {
    setBudgetBtn.addEventListener("click", () => {
      const budgetInput = document.getElementById("budget-input");
      const val = parseFloat(budgetInput.value);
      if (!isNaN(val) && val > 0) {
        saveBudget(val);
        budgetInput.value = "";
        updateUI();
      }
    });
  }

  updateUI();
});