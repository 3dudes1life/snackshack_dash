const money = value => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const number = value => Number(value || 0) || 0;
const plural = (count, one, many = `${one}s`) => Number(count) === 1 ? one : many;
let activeFilter = "all";

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `snackshackCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    window[callbackName] = data => {
      resolve(data || {});
      delete window[callbackName];
      script.remove();
    };
    script.onerror = () => {
      delete window[callbackName];
      script.remove();
      reject(new Error("Snack Shack backend JSONP failed"));
    };
    const joiner = url.includes("?") ? "&" : "?";
    script.src = `${url}${joiner}callback=${callbackName}&t=${Date.now()}`;
    document.body.appendChild(script);
  });
}

async function loadBackendData() {
  const apiUrl = window.SNACKSHACK_API_URL || "";
  if (!apiUrl || apiUrl.includes("PASTE_GOOGLE_APPS_SCRIPT_URL_HERE")) return;

  try {
    const liveData = await jsonp(apiUrl);
    if (liveData && !liveData.error) {
      dashboardData = {
        ...dashboardData,
        ...liveData,
        orders: liveData.orders || [],
        products: liveData.products || [],
        ingredients: liveData.ingredients || [],
        customers: liveData.customers || [],
        goal: liveData.goal || dashboardData.goal
      };
    } else {
      console.warn("Backend returned an error:", liveData);
    }
  } catch (error) {
    console.warn("Using sample data because backend did not load:", error);
  }
}

function recipeBatchCost(product) {
  return number(product.totalBatchCost) || product.recipe.reduce((sum, line) => sum + number(line.ingredientCost), 0);
}

function recipeCostPerCookie(product) {
  return number(product.costPerCookie) || (number(product.batchYieldUnits) ? recipeBatchCost(product) / number(product.batchYieldUnits) : 0);
}

function recipeCostPerDozen(product) {
  return number(product.costPerDozen) || recipeCostPerCookie(product) * 12;
}

function recipesWithCosts() {
  return (dashboardData.products || []).filter(product => recipeBatchCost(product) > 0 || recipeCostPerCookie(product) > 0);
}

function recipesNeedingCosts() {
  return (dashboardData.products || []).filter(product => recipeBatchCost(product) <= 0 && recipeCostPerCookie(product) <= 0);
}

function totalPlannedCookies() {
  return (dashboardData.products || []).reduce((sum, product) => sum + number(product.batchYieldUnits), 0);
}

function totalPlannedCost() {
  return (dashboardData.products || []).reduce((sum, product) => sum + recipeBatchCost(product), 0);
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
  const avgCookieCost = priced.length ? priced.reduce((sum, p) => sum + recipeCostPerCookie(p), 0) / priced.length : 0;
  const highest = [...priced].sort((a, b) => recipeCostPerCookie(b) - recipeCostPerCookie(a))[0];

  const cards = [
    { label: "Recipes Loaded", value: products.length, detail: "Pulled from Caleb's Google Sheet", tone: "success" },
    { label: "Ingredients", value: ingredients.length, detail: "Master cost library", tone: "square" },
    { label: "Planned Cookies", value: totalPlannedCookies(), detail: "Based on sheet batch counts", tone: "cookie" },
    { label: "Planned Cost", value: money(totalPlannedCost()), detail: "Ingredient cost from recipes", tone: "money" },
    { label: "Avg Cost/Cookie", value: money(avgCookieCost), detail: "Across priced recipes", tone: "etsy" },
    { label: "Needs Cleanup", value: needing.length, detail: "Recipes still showing $0", tone: needing.length ? "danger" : "success" }
  ];

  document.getElementById("overview").innerHTML = cards.map(card => `
    <article class="metric-card ${card.tone}">
      <p>${card.label}</p>
      <strong>${card.value}</strong>
      <span>${card.detail}</span>
    </article>
  `).join("");

  const title = document.querySelector(".compact-dashboard-head h1");
  if (title) title.textContent = highest ? `${highest.name}: ${money(recipeCostPerCookie(highest))} per cookie` : "Recipe costing is live.";
}

function renderAlerts() {
  const alerts = [];
  const products = dashboardData.products || [];
  const priced = recipesWithCosts();
  const needing = recipesNeedingCosts();
  const generated = dashboardData.generatedAt ? new Date(dashboardData.generatedAt).toLocaleString() : "live";

  alerts.push({ type: "success", text: `Google Sheet connected. ${products.length} recipes and ${(dashboardData.ingredients || []).length} ingredient costs loaded.` });
  alerts.push({ type: "info", text: `Last backend refresh: ${generated}.` });

  if (needing.length) {
    alerts.push({ type: "warning", text: `${needing.length} recipes are returning $0 cost because their batch/amount-needed cells are still zero or ingredient names don't match.` });
  }

  const expensive = [...priced].sort((a, b) => recipeCostPerCookie(b) - recipeCostPerCookie(a))[0];
  if (expensive) {
    alerts.push({ type: "warning", text: `Highest cost cookie right now: ${expensive.name} at ${money(recipeCostPerCookie(expensive))} each / ${money(recipeCostPerDozen(expensive))} per dozen.` });
  }

  const cheap = [...priced].sort((a, b) => recipeCostPerCookie(a) - recipeCostPerCookie(b))[0];
  if (cheap) {
    alerts.push({ type: "success", text: `Lowest cost cookie right now: ${cheap.name} at ${money(recipeCostPerCookie(cheap))} each.` });
  }

  document.getElementById("alerts").innerHTML = alerts.map(alert => `
    <div class="alert ${alert.type}">${alert.text}</div>
  `).join("");
}

function renderOrders() {
  const orders = dashboardData.orders || [];
  if (!orders.length) {
    document.getElementById("ordersTable").innerHTML = `
      <tr>
        <td colspan="9"><strong>No Square/Etsy orders are connected yet.</strong><span>This section is ready for Phase 2. Right now the live data is recipe costing from Google Sheets.</span></td>
      </tr>
    `;
    return;
  }

  const rows = orders
    .filter(order => activeFilter === "all" || order.platform === activeFilter || order.status === activeFilter)
    .map(order => `
      <tr>
        <td><strong>${order.id}</strong><span>${order.pickupOrShip || ""}</span></td>
        <td><span class="source-pill ${String(order.platform || "").toLowerCase()}">${order.platform || "Manual"}</span></td>
        <td>${order.customer || ""}<span>${order.notes || ""}</span></td>
        <td>${(order.items || []).map(item => `${item.qty}× ${item.name}`).join("<br>")}</td>
        <td>${order.dueDate || ""}</td>
        <td>${money(orderTotal(order))}</td>
        <td>${money(orderCost(order))}</td>
        <td>${money(orderProfit(order))}</td>
        <td><span class="pill warning">${order.status || "New"}</span></td>
      </tr>
    `).join("");

  document.getElementById("ordersTable").innerHTML = rows;
}

function orderTotal(order) {
  return (order.items || []).reduce((sum, item) => sum + number(item.qty) * number(item.unitPrice), 0);
}

function orderCost(order) {
  return (order.items || []).reduce((sum, item) => {
    const product = (dashboardData.products || []).find(p => p.sku === item.sku || p.name === item.name);
    return sum + (product ? recipeCostPerDozen(product) * number(item.qty) : 0);
  }, 0);
}

function orderProfit(order) {
  return orderTotal(order) - orderCost(order);
}

function renderProductionQueue() {
  const products = [...(dashboardData.products || [])].sort((a, b) => recipeBatchCost(b) - recipeBatchCost(a));
  document.getElementById("productionQueue").innerHTML = products.slice(0, 10).map(product => {
    const cost = recipeBatchCost(product);
    const statusClass = cost > 0 ? "success" : "warning";
    return `
      <div class="task-card">
        <div>
          <strong>${product.name}</strong>
          <p>${number(product.batches) || 1} ${plural(number(product.batches) || 1, "batch", "batches")} • ${product.yieldLabel || "Yield missing"} • ${money(recipeCostPerDozen(product))}/dozen</p>
        </div>
        <span class="pill ${statusClass}">${cost > 0 ? money(cost) : "Needs cost"}</span>
      </div>
    `;
  }).join("");
}

function forecastIngredients() {
  const usage = {};
  (dashboardData.products || []).forEach(product => {
    (product.recipe || []).forEach(line => {
      if (!number(line.amount)) return;
      const key = `${line.ingredient}__${line.unit}`;
      usage[key] = usage[key] || { ingredient: line.ingredient, unit: line.unit, amount: 0, cost: 0 };
      usage[key].amount += number(line.amount);
      usage[key].cost += number(line.ingredientCost);
    });
  });
  return Object.values(usage).sort((a, b) => b.cost - a.cost);
}

function renderForecast() {
  const forecast = forecastIngredients();
  if (!forecast.length) {
    document.getElementById("ingredientForecast").innerHTML = `<div class="alert warning">No planned ingredient usage yet. Update batch counts / amount needed cells in Google Sheets.</div>`;
    return;
  }
  const max = Math.max(...forecast.map(item => item.cost), 1);
  document.getElementById("ingredientForecast").innerHTML = forecast.slice(0, 12).map(item => `
    <div class="bar-row">
      <div><strong>${item.ingredient}</strong><span>${item.amount.toFixed(2)} ${item.unit} • ${money(item.cost)}</span></div>
      <div class="bar-track"><span style="width:${Math.max(4, (item.cost / max) * 100)}%"></span></div>
    </div>
  `).join("");
}

function renderRecipes() {
  const sorted = [...(dashboardData.products || [])].sort((a, b) => recipeCostPerCookie(b) - recipeCostPerCookie(a));
  document.getElementById("recipeCards").innerHTML = sorted.map(product => {
    const batchCost = recipeBatchCost(product);
    const perCookie = recipeCostPerCookie(product);
    const perDozen = recipeCostPerDozen(product);
    const needsWork = batchCost <= 0;
    return `
      <article class="recipe-card ${needsWork ? "needs-work" : ""}">
        <div class="recipe-top">
          <div>
            <p class="eyebrow">${number(product.batches) || 1} ${plural(number(product.batches) || 1, "batch", "batches")}</p>
            <h4>${product.name}</h4>
            <span>${product.yieldLabel || "Yield missing"}</span>
          </div>
          <strong>${money(batchCost)}</strong>
        </div>
        <div class="mini-stats">
          <span>Cost / Cookie <b>${money(perCookie)}</b></span>
          <span>Cost / Dozen <b>${money(perDozen)}</b></span>
          <span>Ingredient Lines <b>${(product.recipe || []).length}</b></span>
        </div>
        <details>
          <summary>${needsWork ? "Needs batch/cost cleanup" : "Ingredient cost breakdown"}</summary>
          ${(product.recipe || []).map(line => `<p>${line.ingredient}: ${line.amount || 0} ${line.unit || ""} — ${money(line.ingredientCost)}</p>`).join("")}
        </details>
      </article>
    `;
  }).join("");
}

function renderIngredients() {
  const ingredients = [...(dashboardData.ingredients || [])].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  document.getElementById("lowStockCount").textContent = `${ingredients.length} costs loaded`;
  document.getElementById("ingredientGrid").innerHTML = ingredients.map(item => `
    <article class="inventory-card">
      <p>${item.name}</p>
      <strong>${money(item.costPerUnit)} / ${item.unit || item.recipeUnit || "unit"}</strong>
      <span>Package: ${item.shoppingUnit || item.packageSize || "—"} • Price: ${money(item.price)}</span>
    </article>
  `).join("");
}

function renderCustomers() {
  const customers = dashboardData.customers || [];
  document.getElementById("customerList").innerHTML = customers.length ? customers.map(customer => `
    <div class="leader-row">
      <div><strong>${customer.name}</strong><span>${customer.notes}</span></div>
      <b>${money(customer.lifetimeValue)}</b>
    </div>
  `).join("") : `<div class="alert warning">Customer history starts when Square/Etsy orders are connected.</div>`;
}

function renderProducts() {
  const products = [...(dashboardData.products || [])].sort((a, b) => recipeCostPerDozen(b) - recipeCostPerDozen(a));
  document.getElementById("productLeaderboard").innerHTML = products.slice(0, 10).map(product => `
    <div class="leader-row">
      <div><strong>${product.name}</strong><span>${product.yieldLabel} • ${number(product.batches) || 1} ${plural(number(product.batches) || 1, "batch", "batches")}</span></div>
      <b>${money(recipeCostPerDozen(product))}/doz</b>
    </div>
  `).join("");
}

function renderReport() {
  const products = dashboardData.products || [];
  const priced = recipesWithCosts();
  const missing = recipesNeedingCosts();
  const highest = [...priced].sort((a, b) => recipeCostPerCookie(b) - recipeCostPerCookie(a))[0];
  const lowest = [...priced].sort((a, b) => recipeCostPerCookie(a) - recipeCostPerCookie(b))[0];
  const cards = [
    { title: "Most expensive", value: highest ? highest.name : "—", note: highest ? `${money(recipeCostPerCookie(highest))}/cookie • ${money(recipeCostPerDozen(highest))}/dozen` : "No priced recipes yet" },
    { title: "Least expensive", value: lowest ? lowest.name : "—", note: lowest ? `${money(recipeCostPerCookie(lowest))}/cookie • ${money(recipeCostPerDozen(lowest))}/dozen` : "No priced recipes yet" },
    { title: "Recipes with costs", value: `${priced.length} / ${products.length}`, note: "Pulled from the recipe workbook" },
    { title: "Needs cleanup", value: missing.length, note: "Usually zero batch counts or unmatched ingredient names" }
  ];

  document.getElementById("snackReport").innerHTML = cards.map(card => `
    <article class="report-card"><p>${card.title}</p><strong>${card.value}</strong><span>${card.note}</span></article>
  `).join("");
}

function bindFilters() {
  document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      activeFilter = button.dataset.filter;
      renderOrders();
    });
  });
}

async function init() {
  await loadBackendData();
  renderGoal();
  renderOverview();
  renderAlerts();
  renderOrders();
  renderProductionQueue();
  renderForecast();
  renderRecipes();
  renderIngredients();
  renderCustomers();
  renderProducts();
  renderReport();
  bindFilters();

  document.getElementById("refreshButton")?.addEventListener("click", init);
  document.getElementById("printTodayButton")?.addEventListener("click", () => window.print());
}

init();
