// ============================================================
// Student Expense Tracker - Final Integrated Logic
// ============================================================

// ── CONFIGURATION & CONSTANTS ────────────────────────────────

const STORAGE_KEY_EXPENSES = "student_expenses";
const STORAGE_KEY_BUDGET   = "student_budget";
const DEFAULT_BUDGET       = 5000;

// Must match your <select id="category-input"> option values exactly
const CATEGORIES = ["Food", "Transport", "Academics", "Entertainment"];
const CATEGORY_COLORS = ["#ff6b6b", "#ffd166", "#06d6a0", "#a78bfa"];

let pieChart = null;

// ── DATA LAYER (localStorage) ──────────────────────────

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

function getCategoryTotals(expenses) {
    const totals = {};
    CATEGORIES.forEach(cat => totals[cat] = 0);
    
    expenses.forEach(exp => {
        if (totals[exp.category] !== undefined) {
            totals[exp.category] += exp.amount;
        }
    });
    return CATEGORIES.map(cat => totals[cat]);
}

// ── CHART CORE ───────────────────────────────────────────────

function renderChart(expenses) {
    const canvas = document.getElementById("expenseChart");
    const noDataMsg = document.getElementById("noDataMsg");
    if (!canvas) return;

    const dataValues = getCategoryTotals(expenses);
    const hasData = dataValues.some(v => v > 0);

    // Toggle Visibility
    if (noDataMsg) noDataMsg.style.display = hasData ? "none" : "block";
    canvas.style.display = hasData ? "block" : "none";

    if (!hasData) return;

    if (!pieChart) {
        const ctx = canvas.getContext("2d");
        pieChart = new Chart(ctx, {
            type: "pie",
            data: {
                labels: CATEGORIES,
                datasets: [{
                    data: dataValues,
                    backgroundColor: CATEGORY_COLORS,
                    borderColor: "#ffffff",
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: "bottom", labels: { usePointStyle: true } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.parsed;
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((val / total) * 100).toFixed(1);
                                return ` ${formatCurrency(val)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    } else {
        pieChart.data.datasets[0].data = dataValues;
        pieChart.update();
    }
}

// ── PREDICTION LOGIC (Days Until Broke) ───────────────────────

function updatePrediction(expenses, budget, totalSpent) {
    const el = document.getElementById("prediction");
    if (!el) return;

    const remaining = budget - totalSpent;
    
    // Logic: No data or no budget
    if (expenses.length === 0 || budget <= 0) {
        renderPredictionUI(el, "empty", "🔮", "No forecast available", "Add a budget and expenses to begin");
        return;
    }

    // Logic: Over budget
    if (remaining <= 0) {
        renderPredictionUI(el, "danger", "💸", "You've exceeded your budget!", "Consider reviewing your spending");
        return;
    }

    // Calculate daily average based on first expense date
    const startDate = new Date(expenses[0].id);
    const daysPassed = Math.max(1, Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24)));
    const dailyAvg = totalSpent / daysPassed;
    const daysLeft = Math.floor(remaining / dailyAvg);

    let state = "safe", icon = "✅";
    if (daysLeft <= 3) { state = "danger"; icon = "🚨"; }
    else if (daysLeft <= 7) { state = "warn"; icon = "⚠️"; }

    const headline = `Money will last ~${daysLeft} days`;
    const meta = `Avg ${formatCurrency(dailyAvg)}/day · tracked over ${daysPassed} days`;
    
    renderPredictionUI(el, state, icon, headline, meta);
}

function renderPredictionUI(el, state, icon, head, meta) {
    el.className = "state-" + state;
    el.innerHTML = `
        <span class="pred-icon">${icon}</span>
        <div class="pred-text">
            <strong>${head}</strong>
            <span class="pred-meta">${meta}</span>
        </div>`;
}

// ── UI UPDATE LOOP ───────────────────────────────────────────

function updateUI() {
    const expenses = loadExpenses();
    const budget = loadBudget();
    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remaining = budget - totalSpent;

    // 1. Stats Cards
    const totalEl = document.getElementById("total-spent");
    const remainEl = document.getElementById("remaining-balance");
    const budgetStat = document.getElementById("statBudget");

    if (totalEl) totalEl.textContent = totalSpent.toFixed(2);
    if (budgetStat) budgetStat.textContent = formatCurrency(budget);
    if (remainEl) {
        remainEl.textContent = Math.abs(remaining).toFixed(2);
        remainEl.style.color = remaining < 0 ? "red" : "";
    }

    // 2. Expense Log
    renderExpenseList(expenses);

    // 3. Chart
    renderChart(expenses);

    // 4. Forecast
    updatePrediction(expenses, budget, totalSpent);
}

function renderExpenseList(expenses) {
    const listEl = document.getElementById("expense-list");
    if (!listEl) return;

    listEl.innerHTML = expenses.length === 0 ? "<li>No expenses yet.</li>" : "";

    [...expenses].reverse().forEach(exp => {
        const li = document.createElement("li");
        li.className = "log-item";
        li.innerHTML = `
            <span class="tag tag-${exp.category}">${exp.category}</span>
            <span class="log-desc">${exp.desc || 'Expense'}</span>
            <span class="log-amt">₹${exp.amount.toFixed(2)}</span>
            <button class="delete-btn" onclick="deleteExpense(${exp.id})">✕</button>
        `;
        listEl.appendChild(li);
    });
}

// ── CORE ACTIONS ─────────────────────────────────────────────

function addExpense() {
    const amtInput = document.getElementById("amount-input");
    const descInput = document.getElementById("desc-input");
    const catInput = document.getElementById("category-input");

    const amount = parseFloat(amtInput.value);
    const desc = descInput.value.trim();
    const category = catInput.value;

    if (isNaN(amount) || amount <= 0) {
        alert("Enter a valid amount.");
        return;
    }

    const expenses = loadExpenses();
    expenses.push({ id: Date.now(), amount, desc, category, date: new Date().toLocaleDateString() });
    saveExpenses(expenses);
    
    amtInput.value = "";
    descInput.value = "";
    updateUI();
}

function deleteExpense(id) {
    const expenses = loadExpenses().filter(exp => exp.id !== id);
    saveExpenses(expenses);
    updateUI();
}

function setBudget() {
    const input = document.getElementById("budget-input");
    const val = parseFloat(input.value);
    if (!isNaN(val) && val >= 0) {
        saveBudget(val);
        input.value = "";
        updateUI();
    }
}

// ── INITIALIZATION ───────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    // Setup listeners
    const addBtn = document.getElementById("add-btn");
    if (addBtn) addBtn.addEventListener("click", addExpense);

    const budgetBtn = document.getElementById("set-budget-btn");
    if (budgetBtn) budgetBtn.addEventListener("click", setBudget);

    updateUI();
});