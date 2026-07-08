const money = value => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const recipes = (window.CDAWG_RECIPE_LIBRARY && window.CDAWG_RECIPE_LIBRARY.recipes) || [];
const ingredients = (window.CDAWG_RECIPE_LIBRARY && window.CDAWG_RECIPE_LIBRARY.ingredients) || [];
let selectedSku = recipes[0]?.sku || "";

function renderOverview() {
  const totalCost = recipes.reduce((sum, r) => sum + Number(r.totalBatchCost || 0), 0);
  const avg = recipes.length ? recipes.reduce((sum, r) => sum + Number(r.costPerUnit || 0), 0) / recipes.length : 0;
  const most = [...recipes].sort((a,b) => b.costPerUnit - a.costPerUnit)[0];
  const cheapest = [...recipes].sort((a,b) => a.costPerUnit - b.costPerUnit)[0];
  document.getElementById("loadedRecipeCount").textContent = `${recipes.length} recipes`;
  const cards = [
    ["Recipes", recipes.length, "Loaded into cook mode", "success"],
    ["Ingredients", ingredients.length, "Cost chips", "square"],
    ["All Batch Cost", money(totalCost), "All loaded recipes", "money"],
    ["Avg Cost", money(avg), "Per cookie/jar/square", "etsy"],
    ["Priciest", most?.name || "—", most ? money(most.costPerUnit) + " each" : "—", "danger"],
    ["Cheapest", cheapest?.name || "—", cheapest ? money(cheapest.costPerUnit) + " each" : "—", "cookie"]
  ];
  document.getElementById("overview").innerHTML = cards.map(([label,value,detail,tone]) => `
    <article class="metric-card ${tone}"><p>${label}</p><strong>${value}</strong><span>${detail}</span></article>
  `).join("");
}

function renderRecipeList(filter = "") {
  const q = filter.trim().toLowerCase();
  const list = recipes.filter(r => !q || r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  document.getElementById("recipeList").innerHTML = list.map(r => `
    <button class="recipe-list-item ${r.sku === selectedSku ? "active" : ""}" data-sku="${r.sku}">
      <strong>${r.name}</strong><span>${r.yield} ${r.yieldUnit} • ${money(r.totalBatchCost)} batch</span>
    </button>
  `).join("");
  document.querySelectorAll(".recipe-list-item").forEach(btn => btn.addEventListener("click", () => {
    selectedSku = btn.dataset.sku;
    renderRecipeList(document.getElementById("recipeSearch").value);
    renderCookDetail();
  }));
}

function renderCookDetail() {
  const r = recipes.find(x => x.sku === selectedSku) || recipes[0];
  if (!r) return;
  document.getElementById("cookDetail").innerHTML = `
    <div class="cook-title">
      <div><p class="eyebrow">${r.category}</p><h3>${r.name}</h3><p class="muted">${r.notes}</p></div>
      <div class="cook-meta"><strong>${r.yield} ${r.yieldUnit}</strong><span>${money(r.costPerUnit)} each • ${money(r.costPerDozen)}/dozen</span></div>
    </div>
    <div class="cook-columns">
      <section><h4>Ingredients</h4><ul class="ingredient-checklist">
        ${r.ingredients.map(line => `<li><label><input type="checkbox"><span><b>${line.amount}</b> ${line.unit} ${line.ingredient}</span></label></li>`).join("")}
      </ul></section>
      <section><h4>Instructions</h4><ol class="instruction-list">${r.instructions.map(step => `<li>${step}</li>`).join("")}</ol></section>
    </div>
    <div class="source-note">Source: ${r.source}</div>
  `;
}

function renderCostCards() {
  document.getElementById("costCountPill").textContent = `${recipes.length} recipes`;
  document.getElementById("costScroller").innerHTML = recipes.map(r => `
    <article class="cost-card">
      <div class="recipe-top"><div><p class="eyebrow">${r.category}</p><h4>${r.name}</h4><span>${r.yield} ${r.yieldUnit}</span></div><strong>${money(r.totalBatchCost)}</strong></div>
      <div class="mini-stats">
        <span>Each <b>${money(r.costPerUnit)}</b></span>
        <span>Dozen <b>${money(r.costPerDozen)}</b></span>
        <span>Lines <b>${r.ingredients.length}</b></span>
      </div>
      <details><summary>Ingredient breakdown</summary>
        ${r.ingredients.map(line => `<p><b>${line.ingredient}</b><span>${line.amount} ${line.unit} • ${money(line.ingredientCost)}</span></p>`).join("")}
      </details>
    </article>
  `).join("");
}

function renderIngredients() {
  document.getElementById("ingredientCountPill").textContent = `${ingredients.length} costs`;
  document.getElementById("ingredientGrid").innerHTML = ingredients.sort((a,b) => a.name.localeCompare(b.name)).map(i => `
    <article class="ingredient-chip">
      <span>${i.name}</span>
      <strong>${money(i.costPerUnit)} / ${i.unit}</strong>
      <small>${i.shoppingUnit || ""}</small>
    </article>
  `).join("");
}

function renderSheetStatus() {
  document.getElementById("sheetStatus").innerHTML = `
    <strong>Full recipe library is baked into this dashboard.</strong>
    <p>This stops the old four-card demo from appearing. The Google Sheet URL stays here for live cost updates later.</p>
    <code>${window.SNACKSHACK_API_URL || "No backend URL configured"}</code>
  `;
}

function init() {
  renderOverview();
  renderRecipeList();
  renderCookDetail();
  renderCostCards();
  renderIngredients();
  renderSheetStatus();
  document.getElementById("recipeSearch").addEventListener("input", e => renderRecipeList(e.target.value));
  document.getElementById("refreshButton").addEventListener("click", () => window.location.reload());
  document.getElementById("printButton").addEventListener("click", () => window.print());
}
init();