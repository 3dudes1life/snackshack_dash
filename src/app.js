const money = value => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const number = value => Number(value || 0) || 0;

let dashboardData = {
  status: "loading",
  goal: { current: 0, target: 75, label: "Orders this month" },
  settings: { businessName: "C-Dawg's Snack Shack", tagline: "Cookies • Treats • Sourdough • Jams", currency: "USD" },
  products: [],
  ingredients: [],
  orders: [],
  customers: []
};

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `snackshackCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Backend timed out. Check Apps Script deployment and data/config.js."));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = data => {
      cleanup();
      resolve(data || {});
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP failed. Test your Apps Script URL with ?callback=testCallback."));
    };

    const joiner = url.includes("?") ? "&" : "?";
    script.src = `${url}${joiner}callback=${callbackName}&t=${Date.now()}`;
    document.body.appendChild(script);
  });
}

async function loadBackendData() {
  const apiUrl = window.SNACKSHACK_API_URL || "";
  if (!apiUrl || apiUrl.includes("PASTE")) {
    throw new Error("Missing data/config.js backend URL.");
  }

  const liveData = await jsonp(apiUrl);

  if (!liveData || liveData.error) {
    throw new Error(liveData && liveData.message ? liveData.message : "Backend returned an error.");
  }

  dashboardData = {
    ...dashboardData,
    ...liveData,
    products: Array.isArray(liveData.products) ? liveData.products : [],
    ingredients: Array.isArray(liveData.ingredients) ? liveData.ingredients : [],
    orders: Array.isArray(liveData.orders) ? liveData.orders : [],
    customers: Array.isArray(liveData.customers) ? liveData.customers : [],
    goal: liveData.goal || dashboardData.goal
  };

  return dashboardData;
}

function recipeBatchCost(product) {
  return number(product.totalBatchCost) || (product.recipe || []).reduce((sum, line) => sum + number(line.ingredientCost), 0);
}

function recipeCostPerCookie(product) {
  return number(product.costPerCookie) || (number(product.batchYieldUnits) ? recipeBatchCost(product) / number(product.batchYieldUnits) : 0);
}

function recipeCostPerDozen(product) {
  return number(product.costPerDozen) || recipeCostPerCookie(product) * 12;
}

function recipeYield(product) {
  const amount = number(product.batchYieldUnits);
  const unit = product.unitLabel || "Cookies";
  return amount ? `${amount} ${unit}` : (product.yieldLabel || "Yield missing");
}

function recipesWithCosts() {
  return (dashboardData.products || []).filter(product => recipeBatchCost(product) > 0 || recipeCostPerCookie(product) > 0);
}

function recipesNeedingCosts() {
  return (dashboardData.products || []).filter(product => recipeBatchCost(product) <= 0 && recipeCostPerCookie(product) <= 0);
}

function recipesWithZeroLines(product) {
  return (product.recipe || []).filter(line => number(line.amount) <= 0 || number(line.ingredientCost) <= 0);
}

function totalPlannedCookies() {
  return (dashboardData.products || []).reduce((sum, product) => sum + number(product.batchYieldUnits), 0);
}

function totalPlannedCost() {
  return (dashboardData.products || []).reduce((sum, product) => sum + recipeBatchCost(product), 0);
}

function averageCostPerCookie() {
  const priced = recipesWithCosts();
  return priced.length ? priced.reduce((sum, p) => sum + recipeCostPerCookie(p), 0) / priced.length : 0;
}

function renderStatus(ok, message) {
  const strip = document.getElementById("backendStatus");
  const products = dashboardData.products || [];
  const ingredients = dashboardData.ingredients || [];
  const generated = dashboardData.generatedAt ? new Date(dashboardData.generatedAt).toLocaleString() : "just now";

  if (ok) {
    strip.classList.remove("error");
    strip.classList.add("success");
    strip.querySelector("h1").textContent = `${products.length} recipes loaded from Google Sheets`;
    strip.querySelector(".muted").textContent = `${ingredients.length} ingredient costs connected • Last generated ${generated}`;
  } else {
    strip.classList.remove("success");
    strip.classList.add("error");
    strip.querySelector("h1").textContent = "Live backend did not load";
    strip.querySelector(".muted").textContent = message || "Check data/config.js and Apps Script deployment.";
  }
}

function renderGoal() {
  const { current, target, label } = dashboardData.goal || { current: 0, target: 75, label: "Orders this month" };
  const percent = Math.min(100, Math.round((number(current) / number(target || 1)) * 100));
  document.getElementById("goalText").textContent = `${current} / ${target} ${label}`;
  document.getElementById("goalProgress").style.width = `${percent}%`;
}

function renderOverview() {
  const products = dashboardData.products || [];
  const ingredients = dashboardData.ingredients || [];
  const priced = recipesWithCosts();
  const needing = recipesNeedingCosts();
  const highest = [...priced].sort((a, b) => recipeCostPerCookie(b) - recipeCostPerCookie(a))[0];

  const cards = [
    { label: "Recipes Loaded", value: products.length, detail: "Live from Google Sheet", tone: "success" },
    { label: "Ingredient Costs", value: ingredients.length, detail: "Master cost list", tone: "square" },
    { label: "Planned Cookies", value: totalPlannedCookies(), detail: "Based on sheet yields", tone: "cookie" },
    { label: "Planned Cost", value: money(totalPlannedCost()), detail: "Current recipe batch costs", tone: "money" },
    { label: "Avg Cost/Cookie", value: money(averageCostPerCookie()), detail: "Across priced recipes", tone: "etsy" },
    { label: "Needs Cleanup", value: needing.length, detail: "Recipes showing $0", tone: needing.length ? "danger" : "success" }
  ];

  document.getElementById("overview").innerHTML = cards.map(card => `
    <article class="metric-card ${card.tone}">
      <p>${card.label}</p>
      <strong>${card.value}</strong>
      <span>${card.detail}</span>
    </article>
  `).join("");

  document.getElementById("recipeCountPill").textContent = `${products.length} live recipes`;
  document.getElementById("ingredientCountPill").textContent = `${ingredients.length} costs loaded`;
}

function renderRecipes() {
  const products = [...(dashboardData.products || [])].sort((a, b) => a.name.localeCompare(b.name));
  const container = document.getElementById("recipeCards");

  if (!products.length) {
    container.innerHTML = `<div class="empty-state full">No recipes loaded. The live Google Sheet backend did not return products.</div>`;
    return;
  }

  container.innerHTML = products.map(product => {
    const batchCost = recipeBatchCost(product);
    const perCookie = recipeCostPerCookie(product);
    const perDozen = recipeCostPerDozen(product);
    const zeros = recipesWithZeroLines(product);
    const clean = batchCost > 0 && perCookie > 0;
    const recipe = product.recipe || [];

    return `
      <article class="recipe-card ${clean ? "" : "needs-cleanup"}">
        <div class="recipe-top">
          <div>
            <p class="eyebrow">${number(product.batches) || 1} ${number(product.batches) === 1 ? "batch" : "batches"}</p>
            <h4>${product.name}</h4>
            <span>${recipeYield(product)} • ${recipe.length} ingredient lines</span>
          </div>
          <strong>${money(batchCost)}</strong>
        </div>
        <div class="mini-stats">
          <span>Cost / Cookie <b>${money(perCookie)}</b></span>
          <span>Cost / Dozen <b>${money(perDozen)}</b></span>
          <span>Cleanup flags <b>${zeros.length}</b></span>
        </div>
        <details>
          <summary>${clean ? "Ingredient breakdown" : "Needs batch/cost cleanup"}</summary>
          ${recipe.map(line => `
            <p>
              <b>${line.ingredient}</b>
              <span>${number(line.amount).toFixed(2)} ${line.unit || ""} • ${money(line.ingredientCost)}</span>
            </p>
          `).join("")}
        </details>
      </article>
    `;
  }).join("");
}

function renderIngredients() {
  const ingredients = [...(dashboardData.ingredients || [])].sort((a, b) => a.name.localeCompare(b.name));
  const container = document.getElementById("ingredientGrid");

  if (!ingredients.length) {
    container.innerHTML = `<div class="empty-state full">No ingredient costs loaded.</div>`;
    return;
  }

  container.innerHTML = ingredients.map(item => `
    <article class="inventory-card">
      <p>${item.name}</p>
      <strong>${money(item.costPerUnit)} / ${item.unit || item.recipeUnit || "unit"}</strong>
      <span>Package: ${item.shoppingUnit || item.packageSize || "—"} • Price: ${money(item.price)}</span>
    </article>
  `).join("");
}

function renderCleanup() {
  const needing = recipesNeedingCosts();
  const flagged = (dashboardData.products || [])
    .map(product => ({ product, flags: recipesWithZeroLines(product).length }))
    .filter(row => row.flags > 0)
    .sort((a, b) => b.flags - a.flags);

  const list = document.getElementById("cleanupList");
  const rows = flagged.length ? flagged : needing.map(product => ({ product, flags: 0 }));

  list.innerHTML = rows.length ? rows.map(({ product, flags }) => `
    <div class="task-card">
      <div>
        <strong>${product.name}</strong>
        <p>${flags} zero amount/cost lines • Batch cost ${money(recipeBatchCost(product))}</p>
      </div>
      <span class="pill ${recipeBatchCost(product) > 0 ? "warning" : "danger"}">${recipeBatchCost(product) > 0 ? "Review" : "$0"}</span>
    </div>
  `).join("") : `<div class="alert success">No obvious cleanup flags. Caleb can breathe.</div>`;

  const priced = recipesWithCosts();
  const highest = [...priced].sort((a, b) => recipeCostPerCookie(b) - recipeCostPerCookie(a))[0];
  const lowest = [...priced].sort((a, b) => recipeCostPerCookie(a) - recipeCostPerCookie(b))[0];

  document.getElementById("costExtremes").innerHTML = [
    highest ? { title: "Most expensive", value: highest.name, note: `${money(recipeCostPerCookie(highest))}/cookie • ${money(recipeCostPerDozen(highest))}/dozen` } : null,
    lowest ? { title: "Least expensive", value: lowest.name, note: `${money(recipeCostPerCookie(lowest))}/cookie • ${money(recipeCostPerDozen(lowest))}/dozen` } : null,
    { title: "Priced recipes", value: `${priced.length} / ${(dashboardData.products || []).length}`, note: "Recipes with usable batch/cookie cost" },
    { title: "Total batch cost", value: money(totalPlannedCost()), note: "Across all recipe cards" }
  ].filter(Boolean).map(row => `
    <div class="leader-row">
      <div><strong>${row.title}</strong><span>${row.note}</span></div>
      <b>${row.value}</b>
    </div>
  `).join("");
}

function renderOrderPlaceholder() {
  document.getElementById("orderPlaceholder").innerHTML = `
    <strong>Square + Etsy are not connected yet.</strong>
    <p>That is okay. This version is designed to prove the recipe-cost backend first. Once Square/Etsy are connected, orders will map into these recipe SKUs and use the same cost-per-cookie data.</p>
  `;
}

function renderReport() {
  const products = dashboardData.products || [];
  const priced = recipesWithCosts();
  const needing = recipesNeedingCosts();
  const cards = [
    { title: "Live source", value: dashboardData.source || "Google Sheets", note: dashboardData.generatedAt ? `Generated ${new Date(dashboardData.generatedAt).toLocaleString()}` : "Loaded now" },
    { title: "Recipes showing $0", value: needing.length, note: "Usually batch count or amount-needed cells" },
    { title: "Ingredient library", value: (dashboardData.ingredients || []).length, note: "Rows from MASTER LIST" },
    { title: "Next backend step", value: "Add sell prices", note: "Then dashboard can show profit and margin" }
  ];

  document.getElementById("snackReport").innerHTML = cards.map(card => `
    <article class="report-card"><p>${card.title}</p><strong>${card.value}</strong><span>${card.note}</span></article>
  `).join("");
}

function renderAll() {
  renderGoal();
  renderOverview();
  renderRecipes();
  renderIngredients();
  renderCleanup();
  renderOrderPlaceholder();
  renderReport();
}

async function init() {
  try {
    await loadBackendData();
    renderStatus(true);
  } catch (error) {
    console.error(error);
    renderStatus(false, error.message);
  }
  renderAll();

  document.getElementById("refreshButton")?.addEventListener("click", () => window.location.reload());
  document.getElementById("printTodayButton")?.addEventListener("click", () => window.print());
}

init();
