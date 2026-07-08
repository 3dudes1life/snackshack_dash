const money = value => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const today = new Date("2026-07-08T09:00:00"); // Replace with new Date() when live.
let activeFilter = "all";

function ingredientCost(product) {
  return product.recipe.reduce((sum, line) => {
    const ingredient = dashboardData.ingredients.find(item => item.name === line.ingredient);
    return sum + (ingredient ? ingredient.costPerUnit * line.amount : 0);
  }, 0);
}

function productCost(product) {
  return ingredientCost(product) + Number(product.packagingCost || 0);
}

function productProfit(product) {
  return Number(product.salePrice || 0) - productCost(product);
}

function getProductBySku(sku) {
  return dashboardData.products.find(product => product.sku === sku);
}

function orderTotal(order) {
  return order.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
}

function orderCost(order) {
  return order.items.reduce((sum, item) => {
    const product = getProductBySku(item.sku);
    return sum + (product ? productCost(product) * item.qty : 0);
  }, 0);
}

function orderProfit(order) {
  return orderTotal(order) - orderCost(order);
}

function daysUntil(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
}

function statusClass(status) {
  const normalized = status.toLowerCase();
  if (["ready", "shipped", "picked up", "complete"].includes(normalized)) return "success";
  if (["new", "baking", "cooling", "packaged"].includes(normalized)) return "warning";
  return "danger";
}

function renderOverview() {
  const orders = dashboardData.orders;
  const openOrders = orders.filter(order => !["Shipped", "Picked Up", "Complete"].includes(order.status));
  const dueToday = orders.filter(order => daysUntil(order.dueDate) <= 0 && order.status !== "Ready");
  const revenue = orders.reduce((sum, order) => sum + orderTotal(order), 0);
  const profit = orders.reduce((sum, order) => sum + orderProfit(order), 0);
  const etsy = orders.filter(order => order.platform === "Etsy").length;
  const square = orders.filter(order => order.platform === "Square").length;

  const cards = [
    { label: "Open Orders", value: openOrders.length, detail: "Still in the kitchen flow", tone: "cookie" },
    { label: "Due Today", value: dueToday.length, detail: dueToday.length ? "Needs Caleb's eyes" : "Nothing on fire", tone: dueToday.length ? "danger" : "success" },
    { label: "Revenue", value: money(revenue), detail: "Current loaded orders", tone: "money" },
    { label: "Profit", value: money(profit), detail: `${Math.round((profit / revenue) * 100 || 0)}% blended margin`, tone: "success" },
    { label: "Etsy", value: etsy, detail: "Online snackers", tone: "etsy" },
    { label: "Square", value: square, detail: "Local / direct orders", tone: "square" }
  ];

  document.getElementById("overview").innerHTML = cards.map(card => `
    <article class="metric-card ${card.tone}">
      <p>${card.label}</p>
      <strong>${card.value}</strong>
      <span>${card.detail}</span>
    </article>
  `).join("");
}

function renderGoal() {
  const { current, target, label } = dashboardData.goal;
  const percent = Math.min(100, Math.round((current / target) * 100));
  document.getElementById("goalText").textContent = `${current} / ${target} ${label}`;
  document.getElementById("goalProgress").style.width = `${percent}%`;
}

function renderAlerts() {
  const alerts = [];

  dashboardData.orders.forEach(order => {
    const due = daysUntil(order.dueDate);
    if (due < 0 && order.status !== "Ready") alerts.push({ type: "danger", text: `${order.id} is overdue for ${order.customer}.` });
    if (due === 0) alerts.push({ type: "warning", text: `${order.id} is due today: ${order.items.map(i => `${i.qty}× ${i.name}`).join(", ")}.` });
    if (order.status === "New") alerts.push({ type: "info", text: `${order.id} is new from ${order.platform}. Start production check.` });
  });

  dashboardData.ingredients
    .filter(item => item.stock <= item.reorderAt)
    .forEach(item => alerts.push({ type: "warning", text: `Low stock: ${item.name}. Current: ${item.stock} ${item.unit}.` }));

  document.getElementById("alerts").innerHTML = alerts.length ? alerts.map(alert => `
    <div class="alert ${alert.type}">${alert.text}</div>
  `).join("") : `<div class="alert success">No chaos. Caleb can breathe.</div>`;
}

function renderOrders() {
  const rows = dashboardData.orders
    .filter(order => activeFilter === "all" || order.platform === activeFilter || order.status === activeFilter)
    .map(order => `
      <tr>
        <td><strong>${order.id}</strong><span>${order.pickupOrShip}</span></td>
        <td><span class="source-pill ${order.platform.toLowerCase()}">${order.platform}</span></td>
        <td>${order.customer}<span>${order.notes || ""}</span></td>
        <td>${order.items.map(item => `${item.qty}× ${item.name}`).join("<br>")}</td>
        <td>${order.dueDate}<span>${daysUntil(order.dueDate)} day(s)</span></td>
        <td>${money(orderTotal(order))}</td>
        <td>${money(orderProfit(order))}</td>
        <td><span class="pill ${statusClass(order.status)}">${order.status}</span></td>
      </tr>
    `).join("");

  document.getElementById("ordersTable").innerHTML = rows;
}

function renderProductionQueue() {
  const open = dashboardData.orders.filter(order => !["Ready", "Shipped", "Complete"].includes(order.status));
  document.getElementById("productionQueue").innerHTML = open.map(order => `
    <div class="task-card">
      <div>
        <strong>${order.items.map(item => `${item.qty}× ${item.name}`).join(", ")}</strong>
        <p>${order.customer} • ${order.platform} • Due ${order.dueDate}</p>
      </div>
      <span class="pill ${statusClass(order.status)}">${order.status}</span>
    </div>
  `).join("");
}

function forecastIngredients() {
  const usage = {};
  dashboardData.orders
    .filter(order => !["Ready", "Shipped", "Complete"].includes(order.status))
    .forEach(order => {
      order.items.forEach(item => {
        const product = getProductBySku(item.sku);
        if (!product) return;
        product.recipe.forEach(line => {
          const key = `${line.ingredient}__${line.unit}`;
          usage[key] = usage[key] || { ingredient: line.ingredient, unit: line.unit, amount: 0 };
          usage[key].amount += line.amount * item.qty;
        });
      });
    });
  return Object.values(usage).sort((a, b) => b.amount - a.amount);
}

function renderForecast() {
  const forecast = forecastIngredients();
  const max = Math.max(...forecast.map(item => item.amount), 1);
  document.getElementById("ingredientForecast").innerHTML = forecast.map(item => `
    <div class="bar-row">
      <div><strong>${item.ingredient}</strong><span>${item.amount.toFixed(2)} ${item.unit}</span></div>
      <div class="bar-track"><span style="width:${(item.amount / max) * 100}%"></span></div>
    </div>
  `).join("");
}

function renderRecipes() {
  document.getElementById("recipeCards").innerHTML = dashboardData.products.map(product => {
    const cost = productCost(product);
    const profit = productProfit(product);
    const margin = Math.round((profit / product.salePrice) * 100);
    return `
      <article class="recipe-card">
        <div class="recipe-top">
          <div>
            <p class="eyebrow">${product.category}</p>
            <h4>${product.name}</h4>
            <span>${product.yieldLabel}</span>
          </div>
          <strong>${money(product.salePrice)}</strong>
        </div>
        <div class="mini-stats">
          <span>Cost <b>${money(cost)}</b></span>
          <span>Profit <b>${money(profit)}</b></span>
          <span>Margin <b>${margin}%</b></span>
        </div>
        <details>
          <summary>Ingredient breakdown</summary>
          ${product.recipe.map(line => `<p>${line.ingredient}: ${line.amount} ${line.unit}</p>`).join("")}
        </details>
      </article>
    `;
  }).join("");
}

function renderIngredients() {
  const low = dashboardData.ingredients.filter(item => item.stock <= item.reorderAt);
  document.getElementById("lowStockCount").textContent = `${low.length} low stock`;
  document.getElementById("ingredientGrid").innerHTML = dashboardData.ingredients.map(item => `
    <article class="inventory-card ${item.stock <= item.reorderAt ? "low" : ""}">
      <p>${item.name}</p>
      <strong>${item.stock} ${item.unit}</strong>
      <span>${money(item.costPerUnit)} / ${item.unit} • Buy: ${item.shoppingUnit}</span>
    </article>
  `).join("");
}

function renderCustomers() {
  document.getElementById("customerList").innerHTML = dashboardData.customers.map(customer => `
    <div class="leader-row">
      <div><strong>${customer.name}</strong><span>${customer.notes}</span></div>
      <b>${money(customer.lifetimeValue)}</b>
    </div>
  `).join("");
}

function renderProducts() {
  const totals = {};
  dashboardData.orders.forEach(order => order.items.forEach(item => {
    totals[item.name] = totals[item.name] || { qty: 0, revenue: 0 };
    totals[item.name].qty += item.qty;
    totals[item.name].revenue += item.qty * item.unitPrice;
  }));

  document.getElementById("productLeaderboard").innerHTML = Object.entries(totals)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([name, data]) => `
      <div class="leader-row">
        <div><strong>${name}</strong><span>${data.qty} sold/ordered</span></div>
        <b>${money(data.revenue)}</b>
      </div>
    `).join("");
}

function renderReport() {
  const revenue = dashboardData.orders.reduce((sum, order) => sum + orderTotal(order), 0);
  const cost = dashboardData.orders.reduce((sum, order) => sum + orderCost(order), 0);
  const profit = revenue - cost;
  const topMargin = [...dashboardData.products].sort((a, b) => productProfit(b) - productProfit(a))[0];

  const cards = [
    { title: "Best profit item", value: topMargin.name, note: `${money(productProfit(topMargin))} profit per ${topMargin.yieldLabel}` },
    { title: "Ingredient spend", value: money(cost), note: "Based on current loaded orders" },
    { title: "Net profit", value: money(profit), note: "Before labor, fees, and taxes" },
    { title: "Next move", value: "Protect due dates", note: "New orders need production check first." }
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

function init() {
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

  document.getElementById("refreshButton").addEventListener("click", init);
  document.getElementById("printTodayButton").addEventListener("click", () => window.print());
}

init();
