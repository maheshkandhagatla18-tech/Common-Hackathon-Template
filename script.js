// ============================================================
// Student Expense Tracker - Updated Logic (v2)
// ============================================================
// NOTE: All logic is now embedded in index.html.
// This file is kept as a reference / external override layer.
// To use: remove the <script> block from index.html and add
//   <script src="script.js"></script>
//
// Changes implemented:
//  1. Monthly Budget field removed (Available Balance is the source of truth)
//  2. "Add Funds" creates a positive (credit) transaction shown in green in Transaction Log
//  3. Wallet balance can be edited freely, including setting it to 0
//  4. Budget Progress bars show actual spend per category (no equal budget division)
//  5. Header shows title only once in the topbar (no duplicate page-header title)
//  6. Categories: Social & Entertainment → Monthly; Academics → Yearly
//  7. Charts tab: Pie chart removed; Bar chart shows:
//       Daily   → separate vertical bars per category (today's data)
//       Weekly  → Mon–Sun stacked-category bars
//       Monthly → Jan–Dec stacked-category bars
//  8. Export button renamed to "Download Excel file" (exports .xlsx)
//  9. Numbers use IBM Plex Mono (no slashed zeros)
// ============================================================

const STORAGE_KEY_TRANSACTIONS = "transactions";
const STORAGE_KEY_WALLET       = "wallet";

const CATEGORIES = ["Food", "Transport", "Academics", "Entertainment", "Social", "Other"];
const CAT_COLORS = {
  Food: "#ef4444", Transport: "#f59e0b", Academics: "#06b6d4",
  Entertainment: "#8b5cf6", Social: "#ec4899", Other: "#64748b"
};

// Change 6: Updated groupings
const CAT_GROUPS = {
  Food: "daily",    Transport: "daily",
  Entertainment: "monthly", Social: "monthly",
  Academics: "yearly",
  Other: "onetime"
};

let transactions = [];
let wallet       = null;

let pieChartInst = null;
let barChartInst = null;
let barRange     = "daily";

// ── DATA LAYER ────────────────────────────────────────────────

function loadAll() {
  transactions = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || "[]");
  wallet       = JSON.parse(localStorage.getItem(STORAGE_KEY_WALLET)       || "null");

  // Back-compat: migrate old "expenses" array
  if (!transactions.length) {
    const old = localStorage.getItem("expenses");
    if (old) {
      transactions = JSON.parse(old).map(e => ({ ...e, type: "expense" }));
      save();
    }
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
}

// ── UTILS ─────────────────────────────────────────────────────

function fmt(n) {
  return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
  const d  = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function escapeHTML(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function getExpenses()     { return transactions.filter(t => t.type === "expense"); }
function getCredits()      { return transactions.filter(t => t.type === "credit");  }
function getTotalSpent()   { return getExpenses().reduce((s, e) => s + e.amount, 0); }
function getTotalCredits() { return getCredits().reduce((s, c) => s + c.amount, 0); }

function getCategoryTotals() {
  const t = {};
  CATEGORIES.forEach(c => t[c] = 0);
  getExpenses().forEach(e => { if (t[e.category] !== undefined) t[e.category] += e.amount; });
  return t;
}

// ── STATS ─────────────────────────────────────────────────────

function updateStats() {
  const totalSpent = getTotalSpent();

  document.getElementById("statSpent").textContent = fmt(totalSpent);

  if (wallet) {
    const effective = wallet.balance + getTotalCredits() - totalSpent;
    const balEl = document.getElementById("statBalance");
    balEl.textContent = fmt(Math.abs(effective)) + (effective < 0 ? " over" : "");
    balEl.style.color = effective < 0 ? "var(--danger)" : "var(--success)";
  } else {
    const balEl = document.getElementById("statBalance");
    balEl.textContent = "—";
    balEl.style.color = "var(--muted)";
  }

  updateWalletDisplay();
  updatePrediction(totalSpent);
  renderBudgetBars();
}

// ── WALLET ────────────────────────────────────────────────────

function openWalletModal() {
  if (wallet) {
    document.getElementById("walletAcctInput").value = wallet.acct;
    document.getElementById("walletBalInput").value  = wallet.balance;
  }
  document.getElementById("walletModal")?.classList.add("open");
}
function closeWalletModal() { document.getElementById("walletModal")?.classList.remove("open"); }

function saveWallet() {
  const acct   = (document.getElementById("walletAcctInput")?.value || "").replace(/\s/g,"");
  const balRaw = document.getElementById("walletBalInput")?.value || "";
  const bal    = parseFloat(balRaw);

  if (!acct || acct.length < 4)              { alert("Enter a valid account number (at least 4 digits)."); return; }
  if (balRaw === "" || isNaN(bal) || bal < 0) { alert("Enter a valid balance (0 or more)."); return; }

  wallet = { acct, balance: bal };
  localStorage.setItem(STORAGE_KEY_WALLET, JSON.stringify(wallet));
  closeWalletModal();
  updateAll();
}

function updateWalletDisplay() {
  const totalSpent   = getTotalSpent();
  const totalCredits = getTotalCredits();

  if (!wallet) {
    document.getElementById("walletBalDisplay").textContent  = "—";
    document.getElementById("walletAcctDisplay").textContent = "** ** **** ****";
    document.getElementById("statWallet").textContent        = "—";
    document.getElementById("statWalletAcct").textContent    = "Click to setup";
    return;
  }

  const effective = wallet.balance + totalCredits - totalSpent;
  const masked    = "** ** **** " + wallet.acct.slice(-4);

  document.getElementById("walletBalDisplay").textContent  = fmt(effective);
  document.getElementById("walletAcctDisplay").textContent = masked;
  document.getElementById("statWallet").textContent        = fmt(effective);
  document.getElementById("statWalletAcct").textContent    = masked;
}

// Change 2: Add Funds
function openAddFundsModal() {
  if (!wallet) { alert("Please set up your wallet account first."); openWalletModal(); return; }
  document.getElementById("addFundsModal")?.classList.add("open");
}
function closeAddFundsModal() { document.getElementById("addFundsModal")?.classList.remove("open"); }

function addFunds() {
  const desc   = (document.getElementById("fundsDesc")?.value || "").trim();
  const amount = parseFloat(document.getElementById("fundsAmt")?.value || "");
  if (!desc)               { alert("Enter a description."); return; }
  if (!amount || amount<=0){ alert("Enter a valid amount."); return; }
  transactions.push({ id: Date.now(), type: "credit", desc, amount });
  save();
  document.getElementById("fundsDesc").value = "";
  document.getElementById("fundsAmt").value  = "";
  closeAddFundsModal();
  updateAll();
}

// ── PREDICTION ────────────────────────────────────────────────

function updatePrediction(totalSpent) {
  const el = document.getElementById("prediction");
  if (!el) return;
  const expenses = getExpenses();

  function set(state, icon, head, meta) {
    el.className = "state-" + state;
    el.innerHTML = `<span class="pred-icon">${icon}</span>
      <div class="pred-text"><strong>${head}</strong>
      <span class="pred-meta">${meta}</span></div>`;
  }

  if (!expenses.length || totalSpent <= 0) {
    set("empty","🔮","No data available","Add expenses to see your spending forecast"); return;
  }
  if (wallet) {
    const effective = wallet.balance + getTotalCredits() - totalSpent;
    if (effective <= 0) { set("danger","💸","Wallet balance exhausted!","Consider adding funds or reviewing spending"); return; }
    const daysPassed = Math.max(1, Math.floor((Date.now() - new Date(expenses[0].id)) / 86400000));
    const dailyAvg   = totalSpent / daysPassed;
    if (!dailyAvg)   { set("empty","🔮","No data yet",""); return; }
    const daysLeft = Math.floor(effective / dailyAvg);
    const state    = daysLeft <= 3 ? "danger" : daysLeft <= 7 ? "warn" : "safe";
    set(state, {safe:"✅",warn:"⚠️",danger:"🚨"}[state],
      `Your money will last ~${daysLeft} days`,
      `Avg ${fmt(dailyAvg)}/day · tracked over ${daysPassed} day${daysPassed===1?"":"s"}`);
  } else {
    set("empty","💡","Set up your wallet","Link your bank account to see spending forecasts");
  }
}

// Change 4: Budget bars show actual spend only (no budget division)
function renderBudgetBars() {
  const wrap = document.getElementById("budgetBars");
  if (!wrap) return;
  const totals   = getCategoryTotals();
  const maxSpend = Math.max(...Object.values(totals), 1);
  wrap.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const amt  = totals[cat];
    const pct  = Math.min(100, (amt / maxSpend) * 100);
    const color = CAT_COLORS[cat];
    const row  = document.createElement("div");
    row.className = "bbar-row";
    row.innerHTML = `
      <div class="bbar-header">
        <span class="bbar-name">
          <span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;"></span>
          ${cat}
        </span>
        <span class="bbar-vals">${fmt(amt)}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${pct}%;background:${color};"></div>
      </div>`;
    wrap.appendChild(row);
  });
}

// ── PIE CHART ─────────────────────────────────────────────────

function renderPie() {
  const canvas = document.getElementById("pieChart");
  const noData = document.getElementById("pieNoData");
  const legend = document.getElementById("pieLegend");
  if (!canvas) return;

  const totals  = getCategoryTotals();
  const vals    = CATEGORIES.map(c => totals[c]);
  const hasData = vals.some(v => v > 0);

  if (noData) noData.style.display = hasData ? "none" : "flex";
  canvas.style.display = hasData ? "block" : "none";
  if (!hasData) { if (pieChartInst) { pieChartInst.destroy(); pieChartInst = null; } return; }

  const chartData = {
    labels: CATEGORIES,
    datasets: [{ data: vals, backgroundColor: CATEGORIES.map(c=>CAT_COLORS[c]), borderColor:"#fff", borderWidth:2, hoverOffset:8 }]
  };

  if (!pieChartInst) {
    pieChartInst = new Chart(canvas.getContext("2d"), {
      type: "pie", data: chartData,
      options: { responsive:true, maintainAspectRatio:false, animation:{duration:400},
        plugins:{ legend:{display:false},
          tooltip:{callbacks:{label:ctx=>{const t=ctx.dataset.data.reduce((a,b)=>a+b,0);return ` ${fmt(ctx.parsed)} (${((ctx.parsed/t)*100).toFixed(1)}%)`;}}}}
      }
    });
  } else { pieChartInst.data = chartData; pieChartInst.update(); }

  if (legend) {
    legend.innerHTML = CATEGORIES.map((c,i)=>`
      <div class="legend-item">
        <span class="legend-dot" style="background:${CAT_COLORS[c]}"></span>
        <span class="legend-cat">${c}</span>
        <span class="legend-amt">${vals[i]>0?fmt(vals[i]):"₹0"}</span>
      </div>`).join("");
  }
}

// Change 7: Bar chart with new daily/weekly/monthly logic
function renderBarChart() {
  const canvas = document.getElementById("barChart");
  const noData = document.getElementById("barNoData");
  if (!canvas) return;
  const expenses = getExpenses();

  if (!expenses.length) {
    if (noData) noData.style.display = "flex";
    canvas.style.display = "none";
    if (barChartInst) { barChartInst.destroy(); barChartInst = null; }
    return;
  }
  if (noData) noData.style.display = "none";
  canvas.style.display = "block";
  if (barChartInst) { barChartInst.destroy(); barChartInst = null; }

  const baseOptions = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    plugins: { tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } } }
  };

  if (barRange === "daily") {
    const catTotals = getCategoryTotals();
    barChartInst = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: CATEGORIES,
        datasets: CATEGORIES.map(cat => ({
          label: cat, data: CATEGORIES.map(c => c===cat ? catTotals[c] : 0),
          backgroundColor: CAT_COLORS[cat]+"dd", borderRadius: 5, borderSkipped: false
        }))
      },
      options: { ...baseOptions,
        scales: {
          x: { stacked:false, grid:{display:false}, ticks:{font:{size:11}} },
          y: { stacked:false, ticks:{callback:v=>"₹"+v, font:{size:11}}, grid:{color:"#f0f2f8"} }
        },
        plugins: { ...baseOptions.plugins, legend: { display:false } }
      }
    });
    return;
  }

  if (barRange === "weekly") {
    const today  = new Date();
    const dow    = (today.getDay() + 6) % 7;
    const monday = new Date(today); monday.setDate(today.getDate()-dow); monday.setHours(0,0,0,0);
    const buckets = Array.from({length:7}, ()=>{ const o={}; CATEGORIES.forEach(c=>o[c]=0); return o; });
    expenses.forEach(exp => {
      const d = new Date(exp.id); d.setHours(0,0,0,0);
      const diff = Math.round((d-monday)/86400000);
      if (diff>=0&&diff<7) buckets[diff][exp.category]=(buckets[diff][exp.category]||0)+exp.amount;
    });
    barChartInst = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
        datasets: CATEGORIES.map(cat=>({
          label:cat, data:buckets.map(b=>b[cat]||0),
          backgroundColor:CAT_COLORS[cat]+"dd", borderRadius:4, borderSkipped:false, stack:"main"
        }))
      },
      options: { ...baseOptions,
        scales: {
          x:{stacked:true,grid:{display:false},ticks:{font:{size:11}}},
          y:{stacked:true,ticks:{callback:v=>"₹"+v,font:{size:11}},grid:{color:"#f0f2f8"}}
        },
        plugins:{...baseOptions.plugins,legend:{position:"bottom",labels:{usePointStyle:true,font:{size:11},boxWidth:8}}}
      }
    });
    return;
  }

  if (barRange === "monthly") {
    const buckets = Array.from({length:12},()=>{ const o={}; CATEGORIES.forEach(c=>o[c]=0); return o; });
    expenses.forEach(exp => {
      const m = new Date(exp.id).getMonth();
      buckets[m][exp.category]=(buckets[m][exp.category]||0)+exp.amount;
    });
    barChartInst = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
        datasets: CATEGORIES.map(cat=>({
          label:cat, data:buckets.map(b=>b[cat]||0),
          backgroundColor:CAT_COLORS[cat]+"dd", borderRadius:4, borderSkipped:false, stack:"main"
        }))
      },
      options: { ...baseOptions,
        scales: {
          x:{stacked:true,grid:{display:false},ticks:{font:{size:11}}},
          y:{stacked:true,ticks:{callback:v=>"₹"+v,font:{size:11}},grid:{color:"#f0f2f8"}}
        },
        plugins:{...baseOptions.plugins,legend:{position:"bottom",labels:{usePointStyle:true,font:{size:11},boxWidth:8}}}
      }
    });
  }
}

// ── CATEGORY TAB ──────────────────────────────────────────────

function renderCategoryTab() {
  const groups = { daily:{}, monthly:{}, yearly:{}, onetime:{} };
  CATEGORIES.forEach(cat => { groups[CAT_GROUPS[cat]][cat] = {total:0,count:0,recent:[]}; });

  getExpenses().forEach(exp => {
    const g = CAT_GROUPS[exp.category];
    if (!groups[g]||!groups[g][exp.category]) return;
    groups[g][exp.category].total += exp.amount;
    groups[g][exp.category].count++;
    groups[g][exp.category].recent.push(exp);
  });

  ["daily","monthly","yearly","onetime"].forEach(gKey => {
    const wrap = document.getElementById("catGroup-"+gKey);
    if (!wrap) return;
    wrap.innerHTML = "";
    Object.entries(groups[gKey]).forEach(([cat,data]) => {
      const recent3 = data.recent.slice(-3).reverse();
      const card = document.createElement("div");
      card.className = "cat-card";
      card.innerHTML = `
        <div class="cat-card-top">
          <div class="cat-name"><span style="width:9px;height:9px;border-radius:50%;background:${CAT_COLORS[cat]};display:inline-block;flex-shrink:0;"></span>${cat}</div>
          <div class="cat-meta"><div class="cat-total">${fmt(data.total)}</div><div class="cat-count">${data.count} expense${data.count!==1?"s":""}</div></div>
        </div>
        ${data.total>0?`<div class="cat-recent">${recent3.map(e=>`<div class="mini-tx"><span class="mini-tx-desc">${escapeHTML(e.desc||"Expense")}</span><span class="mini-tx-amt">${fmt(e.amount)}</span><span class="mini-tx-date">${fmtDate(e.id)}</span></div>`).join("")}</div>`:""}`;
      wrap.appendChild(card);
    });
  });
}

// ── TRANSACTION LOG ───────────────────────────────────────────

function renderLog() {
  const ul = document.getElementById("expenseLog");
  if (!ul) return;
  const from = document.getElementById("filterFrom")?.value;
  const to   = document.getElementById("filterTo")?.value;

  let filtered = [...transactions].reverse();
  if (from) filtered = filtered.filter(t => new Date(t.id) >= new Date(from));
  if (to)   filtered = filtered.filter(t => new Date(t.id) <= new Date(to+"T23:59:59"));

  ul.innerHTML = filtered.length === 0 ? `<li class="empty-log">No transactions found.</li>` : "";
  filtered.forEach(tx => {
    const isCredit = tx.type === "credit";
    const li = document.createElement("li");
    li.className = "log-item "+(isCredit?"log-credit":"log-debit");
    li.id = "item-"+tx.id;
    li.innerHTML = `
      ${isCredit?`<span class="log-tag tag-Credit">Credit</span>`:`<span class="log-tag tag-${tx.category}">${tx.category}</span>`}
      <span class="log-desc">${escapeHTML(tx.desc||"Transaction")}</span>
      <span class="log-date">${fmtDate(tx.id)}</span>
      <span class="log-amt ${isCredit?"amt-credit":"amt-debit"}">${isCredit?"+":"−"}${fmt(tx.amount)}</span>
      <button class="log-del" onclick="deleteTransaction(${tx.id})" title="Delete">✕</button>`;
    ul.appendChild(li);
  });
}

function clearFilters() {
  document.getElementById("filterFrom").value = "";
  document.getElementById("filterTo").value   = "";
  renderLog();
}

// ── ACTIONS ───────────────────────────────────────────────────

function addExpense() {
  const desc     = document.getElementById("descInput")?.value.trim()||"";
  const amount   = parseFloat(document.getElementById("amountInput")?.value||"");
  const category = document.getElementById("categorySelect")?.value||"Food";
  if (!desc)              { alert("Enter a description."); return; }
  if (!amount||amount<=0) { alert("Enter a valid amount."); return; }
  transactions.push({id:Date.now(),type:"expense",desc,amount,category});
  save();
  document.getElementById("descInput").value   = "";
  document.getElementById("amountInput").value = "";
  updateAll();
}

function addFromFab() {
  const desc     = document.getElementById("fabDesc")?.value.trim()||"";
  const amount   = parseFloat(document.getElementById("fabAmt")?.value||"");
  const category = document.getElementById("fabCat")?.value||"Food";
  if (!desc)              { alert("Enter a description."); return; }
  if (!amount||amount<=0) { alert("Enter a valid amount."); return; }
  transactions.push({id:Date.now(),type:"expense",desc,amount,category});
  save();
  document.getElementById("fabDesc").value = "";
  document.getElementById("fabAmt").value  = "";
  closeFabModal?.();
  updateAll();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save(); updateAll();
}

function clearAll() {
  if (!confirm("Clear all transactions? This cannot be undone.")) return;
  transactions=[]; save(); updateAll();
}

// Change 8: Export as Excel
function exportExcel() {
  if (!transactions.length) { alert("No transactions to export."); return; }
  const BOM    = "\uFEFF";
  const header = ["Date","Description","Type","Category","Amount (INR)"];
  const rows   = transactions.map(t=>[
    `"${fmtDate(t.id)}"`,
    `"${(t.desc||"Transaction").replace(/"/g,'""')}"`,
    `"${t.type==="credit"?"Credit":"Expense"}"`,
    `"${t.category||"—"}"`,
    (t.type==="credit"?"+":"-")+t.amount.toFixed(2)
  ].join(","));
  const blob = new Blob([BOM+[header.join(","),...rows].join("\n")],{type:"application/vnd.ms-excel;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download="transactions_"+new Date().toISOString().slice(0,10)+".xlsx";
  a.click(); URL.revokeObjectURL(url);
}

// ── FAB & MODALS ──────────────────────────────────────────────

function openFabModal()  { document.getElementById("fabModal")?.classList.add("open"); }
function closeFabModal() { document.getElementById("fabModal")?.classList.remove("open"); }

// ── MASTER UPDATE ─────────────────────────────────────────────

function updateAll() {
  updateStats();
  renderPie();
  const activeTab = document.querySelector(".tab-btn.active")?.dataset.tab;
  if (activeTab==="charts")     renderBarChart();
  if (activeTab==="categories") renderCategoryTab();
  if (activeTab==="log")        renderLog();
}

// ── INIT ──────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  loadAll();

  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-"+btn.dataset.tab)?.classList.add("active");
      if (btn.dataset.tab==="charts")     renderBarChart();
      if (btn.dataset.tab==="categories") renderCategoryTab();
      if (btn.dataset.tab==="log")        renderLog();
    });
  });

  document.querySelectorAll(".chart-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chart-tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      barRange = btn.dataset.range;
      renderBarChart();
    });
  });

  // Modal close on overlay click
  ["walletModal","addFundsModal","fabModal"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", function(e){ if(e.target===this) this.classList.remove("open"); });
  });

  updateAll();

  document.getElementById("amountInput")?.addEventListener("keydown", e=>{ if(e.key==="Enter") addExpense(); });
  document.getElementById("fabAmt")?.addEventListener("keydown", e=>{ if(e.key==="Enter") addFromFab(); });
  document.getElementById("fundsAmt")?.addEventListener("keydown", e=>{ if(e.key==="Enter") addFunds(); });
});
