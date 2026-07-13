
const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(number(value));
const number = value => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[$,]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};
const norm = value => String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");

let dashboardData = {
  products: [],
  ingredients: [],
  orders: [],
  customers: [],
  squareInvoices: [],
  squareCatalog: [],
  squareInventory: [],
  squareStatus: "not_connected",
  squareMessage: ""
};

function normalizeIngredientItem(item) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      ingredient: String(item.ingredient || item.name || "").trim(),
      amount: item.amount ?? item.quantity ?? item.qty ?? "",
      unit: String(item.unit || "").trim()
    };
  }
  return String(item || "").trim();
}
function normalizeRecipeSource(recipe) {
  if (!recipe || typeof recipe !== "object") return { name: "", ingredients: [], steps: [] };
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients.map(normalizeIngredientItem) : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : (Array.isArray(recipe.instructions) ? recipe.instructions : []);
  return {
    ...recipe,
    name: String(recipe.name || "").trim(),
    ingredients,
    steps,
    yield: recipe.yield ?? (recipe.yieldLabel ? recipe.yieldLabel : ""),
    yieldLabel: recipe.yieldLabel || (recipe.yield ? `${recipe.yield}${recipe.yieldUnit ? ` ${recipe.yieldUnit}` : ""}` : "")
  };
}
function recipeNameMatches(a, b) {
  const aNames = [a.name, ...(a.aliases || [])].filter(Boolean).map(norm);
  const bNames = [b.name, ...(b.aliases || [])].filter(Boolean).map(norm);
  return aNames.some(name => bNames.includes(name)) || aNames.some(name => bNames.some(other => other.includes(name) || name.includes(other)));
}
function buildRecipeCatalog() {
  const structuredRecipes = Array.isArray(window.CDAWG_RECIPE_LIBRARY_STRUCTURED?.recipes) ? window.CDAWG_RECIPE_LIBRARY_STRUCTURED.recipes : [];
  const fallbackRecipes = Array.isArray(window.CDAWG_RECIPE_LIBRARY) ? window.CDAWG_RECIPE_LIBRARY : (window.CDAWG_RECIPE_LIBRARY?.recipes || []);
  const normalizedStructured = structuredRecipes.map(normalizeRecipeSource);
  const normalizedFallback = fallbackRecipes.map(normalizeRecipeSource);
  const merged = normalizedFallback.map(fallbackRecipe => {
    const match = normalizedStructured.find(recipe => recipeNameMatches(fallbackRecipe, recipe));
    if (!match) return fallbackRecipe;
    return {
      ...fallbackRecipe,
      ...match,
      name: fallbackRecipe.name || match.name,
      ingredients: Array.isArray(match.ingredients) && match.ingredients.length ? match.ingredients : fallbackRecipe.ingredients,
      steps: Array.isArray(match.steps) && match.steps.length ? match.steps : fallbackRecipe.steps,
      yield: match.yield ?? fallbackRecipe.yield,
      yieldLabel: match.yieldLabel || fallbackRecipe.yieldLabel || match.yield || fallbackRecipe.yield
    };
  });
  const seen = new Set();
  const finalRecipes = [];
  merged.forEach(recipe => {
    const key = norm(recipe.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    finalRecipes.push(recipe);
  });
  normalizedStructured.forEach(recipe => {
    const key = norm(recipe.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    finalRecipes.push(recipe);
  });
  return finalRecipes.sort((a,b) => a.name.localeCompare(b.name));
}
const bakedRecipes = buildRecipeCatalog();
let selectedRecipeKey = "";
let lastSyncAt = null;
let syncTimer = null;
let countdownTimer = null;
let nextSync = 60;
let hasBackendData = false;

const productionBatchState = loadState("cdawgProductionBatchState", "cdawgBatchState");
const kitchenBatchState = loadState("cdawgKitchenBatchState");
const priceState = loadState("cdawgDualPriceState", "cdawgPriceState");
const pricingModeState = loadState("cdawgPricingModeState");

const DEFAULT_CORPORATE_DZ_PRICE = 36;
const DEFAULT_SQUARE_DZ_PRICE = 48;
const DEFAULT_SQUARE_EACH_PRICE = 4;
const DEFAULT_TARGET_MARGIN = 65;

const STOP_WORDS = new Set([
  "cookie","cookies","treat","treats","soft","chewy","bakery","style","and","the","a","an","of","with",
  "one","batch","batches","recipe","photo","google","sheet","cost","costs","pan","9x12","jumbo",
  "single","pack","dozen","dozens","twelve","six","half","xl","medium","mini","large","extra","available",
  "made","fresh","order","orders","pickup","delivery","california","only","cottage","food","notice"
]);

const MANUAL_MATCHES = {
  chocolatechipcookies:["chocolatechip","classicchocolatechip","chocolatechipcookies","chocolatechipcookie"],
  chocolatechip:["chocolatechip","chocolatechipcookies","classicchocolatechip"],
  brownbutterchocolatechip:["brownbutterchocolatechip","brownbutterchocchip","brownbutterchocolatechipcookies","brownbutter"],
  doublechocolatechip:["doublechocolatechip","doublechocolatechipcookies","doublechocolate"],
  greenmintchocolatechip:["greenmintchocolatechip","greenmintchocoloatechip","mintchocolatechip","greenmint"],
  whitechocolatemacadamianut:["whitechocolatemacadamianut","whitechocmacadamianut","whitechocolatemacadamianutcookies","macadamianut"],
  oatmealraisin:["oatmealraisin","bakeryoatmealraisin","oatmealraisincookies"],
  molasses:["molasses","gingermolasses","softgingermolasses","molassescookies"],
  softsprinkle:["softsprinkle","sprinkle","softsprinklecookies","sugarsprinkle","sprinklecookies"],
  pumpkinsnickerdoodle:["pumpkinsnickerdoodle","pumpkinsnickerdoodlecookies"],
  peanutbutter:["peanutbutter","softchewypeanutbutter","peanutbuttercookies"],
  redvelvet:["redvelvet","redvelvetcookies","redvelvetcookie"],
  thumbprint:["thumbprint","thumbprintcookies","thumbprintcookie","shortbreadthumbprint"],
  nannypoundcake:["nannypoundcake","nannypoundcakecookies","poundcake","poundcakecookies","nannys"],
  blackberryjam:["blackberryjam","blackberry","blackberryjelly"],
  ricekrispietreats:["ricekrispietreats","ricekrispie","ricekrispies","ricekrispietreats9x12pan","ricecrispy","ricecrispytreats"],
  monster:["monster","monstercookies","monstercookie","mamasmonster"]
};

function loadState(primary, fallback) {
  try {
    return JSON.parse(localStorage.getItem(primary) || (fallback ? localStorage.getItem(fallback) : "") || "{}");
  } catch (err) {
    return {};
  }
}
function saveState(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function hasOwn(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

function titleWords(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/chocoloate/g, "chocolate")
    .replace(/choc\./g, "chocolate")
    .replace(/\bchoc\b/g, "chocolate")
    .replace(/krispies/g, "krispie")
    .replace(/crispy/g, "krispie")
    .replace(/mac\./g, "macadamia")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .filter(word => !STOP_WORDS.has(word));
}
function smartKey(value) { return titleWords(value).join(""); }
function tokenScore(a, b) {
  const aw = [...new Set(titleWords(a))];
  const bw = [...new Set(titleWords(b))];
  if (!aw.length || !bw.length) return 0;
  const shared = aw.filter(w => bw.includes(w)).length;
  return shared / Math.max(aw.length, bw.length);
}
function matchingKeys(value) {
  const keys = [norm(value), smartKey(value)].filter(Boolean);
  keys.forEach(key => {
    if (MANUAL_MATCHES[key]) keys.push(...MANUAL_MATCHES[key]);
    Object.entries(MANUAL_MATCHES).forEach(([canonical, aliases]) => {
      if (aliases.includes(key) || key.includes(canonical) || canonical.includes(key)) keys.push(canonical, ...aliases);
    });
  });
  return [...new Set(keys.filter(Boolean))];
}

function cacheBustUrl(url) {
  const sep = String(url).includes("?") ? "&" : "?";
  return `${url}${sep}_=${Date.now()}`;
}
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = `snackshackCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Backend timed out."));
    }, 15000);
    function cleanup() {
      clearTimeout(timer);
      try { delete window[cb]; } catch (e) { window[cb] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[cb] = data => { cleanup(); resolve(data || {}); };
    script.onerror = () => { cleanup(); reject(new Error("Backend failed.")); };
    script.src = `${cacheBustUrl(url)}&callback=${cb}`;
    document.body.appendChild(script);
  });
}
async function loadBackendData() {
  const url = window.SNACKSHACK_API_URL || "";
  if (!url || url.includes("PASTE")) throw new Error("Missing backend URL.");
  const live = await jsonp(url);
  if (!live || live.error) throw new Error(live?.message || "Backend returned an error.");
  dashboardData = {
    ...dashboardData,
    ...live,
    products: Array.isArray(live.products) ? live.products : [],
    ingredients: Array.isArray(live.ingredients) ? live.ingredients : [],
    orders: Array.isArray(live.orders) ? live.orders : [],
    customers: Array.isArray(live.customers) ? live.customers : [],
    squareInvoices: Array.isArray(live.squareInvoices) ? live.squareInvoices : [],
    squareCatalog: Array.isArray(live.squareCatalog) ? live.squareCatalog : [],
    squareInventory: Array.isArray(live.squareInventory) ? live.squareInventory : [],
    squareStatus: live.squareStatus || "unknown",
    squareMessage: live.squareMessage || ""
  };
  hasBackendData = true;
}

function syncPanel(status, detail) {
  const s = document.getElementById("syncStatus");
  const d = document.getElementById("syncDetail");
  const l = document.getElementById("lastSyncTime");
  const n = document.getElementById("nextSyncTime");
  if (s) s.textContent = status;
  if (d) d.textContent = detail || "";
  if (l) l.textContent = lastSyncAt ? lastSyncAt.toLocaleTimeString([], {hour:"numeric", minute:"2-digit", second:"2-digit"}) : "—";
  if (n) n.textContent = `${nextSync}s`;
}
function startCountdown() {
  clearInterval(countdownTimer);
  nextSync = 60;
  syncPanel("LIVE", "Fresh Square + Google Sheets data loaded");
  countdownTimer = setInterval(() => {
    nextSync = Math.max(0, nextSync - 1);
    const n = document.getElementById("nextSyncTime");
    if (n) n.textContent = `${nextSync}s`;
  }, 1000);
}
async function liveRefresh() {
  try {
    syncPanel("Syncing…", "Pulling fresh Square + Google Sheets data");
    await loadBackendData();
    lastSyncAt = new Date();
    renderStatus(true);
    renderAll();
    startCountdown();
  } catch (err) {
    hasBackendData = false;
    console.error(err);
    syncPanel("Offline", String(err && err.message ? err.message : err));
  }
}
function startAutoRefresh() {
  clearInterval(syncTimer);
  syncTimer = setInterval(liveRefresh, 60000);
  startCountdown();
}

function recipeKey(r) { return norm(r.name); }
function productKeys(product) {
  return [product.name, product.sku, product.title, product.productName, product.recipeName]
    .filter(Boolean)
    .flatMap(matchingKeys);
}
function recipeKeys(recipe) {
  return [recipe.name, ...(recipe.aliases || [])].filter(Boolean).flatMap(matchingKeys);
}
function findCostProduct(recipe) {
  const products = dashboardData.products || [];
  const recipeExact = [recipe.name, ...(recipe.aliases || [])]
    .filter(Boolean)
    .map(norm);

  if (!recipeExact.length) return null;

  return products.find(p => {
    const productExact = [p.name, p.sku, p.title, p.productName, p.recipeName]
      .filter(Boolean)
      .map(norm);
    return recipeExact.some(key => productExact.includes(key));
  }) || null;
}
function mergedRecipes() {
  const rows = bakedRecipes.map(r => ({ ...r, key: recipeKey(r), costProduct: findCostProduct(r) }));
  const existing = new Set(bakedRecipes.flatMap(r => [r.name, ...(r.aliases || [])]).map(norm));
  (dashboardData.products || []).forEach(p => {
    if (!existing.has(norm(p.name))) {
      rows.push({
        key: norm(p.name),
        name: p.name,
        yield: p.yieldLabel || `${p.batchYieldUnits || ""} ${p.unitLabel || ""}`.trim(),
        ingredients: (p.recipe || []).map(l => `${l.amount || ""} ${l.unit || ""} ${l.ingredient}`.trim()),
        steps: ["Recipe text not uploaded yet. Cost data is connected from the Google Sheet."],
        costProduct: p
      });
    }
  });
  return rows.sort((a,b) => a.name.localeCompare(b.name));
}

function getProductionBatch(key, fallback = 0) {
  return hasOwn(productionBatchState, key) ? Math.max(0, number(productionBatchState[key])) : Math.max(0, number(fallback) || 0);
}
function setProductionBatch(key, value) { productionBatchState[key] = Math.max(0, number(value)); saveState("cdawgProductionBatchState", productionBatchState); }
function getKitchenBatch(key, fallback = 1) {
  return hasOwn(kitchenBatchState, key) ? Math.max(1, number(kitchenBatchState[key])) : Math.max(1, number(fallback) || 1);
}
function setKitchenBatch(key, value) { kitchenBatchState[key] = Math.max(1, number(value)); saveState("cdawgKitchenBatchState", kitchenBatchState); }
function selectedBatches(r) { return getProductionBatch(r.key, 0); }
function kitchenBatches(r) { return getKitchenBatch(r.key, 1); }
function priceRecord(r) {
  if (!priceState[r.key]) {
    priceState[r.key] = { corporateDz: DEFAULT_CORPORATE_DZ_PRICE, squareDz: DEFAULT_SQUARE_DZ_PRICE, squareEach: DEFAULT_SQUARE_EACH_PRICE, targetMargin: DEFAULT_TARGET_MARGIN };
  }
  return priceState[r.key];
}
function savePriceState() { saveState("cdawgDualPriceState", priceState); }
function savePricingModeState() { saveState("cdawgPricingModeState", pricingModeState); }
function pricingMode(r) { return pricingModeState[r.key] || "corporate"; }
function setPricingMode(key, mode) { pricingModeState[key] = mode; savePricingModeState(); }
function setPriceField(key, field, value) { if (!priceState[key]) priceState[key] = {}; priceState[key][field] = Math.max(0, number(value)); savePriceState(); }
function getCorporateDzPrice(r) { return number(priceRecord(r).corporateDz) || 0; }
function getSquareDzPrice(r) { return number(priceRecord(r).squareDz) || 0; }
function getSquareEachPrice(r) { return number(priceRecord(r).squareEach) || 0; }
function getTargetMargin(r) { return number(priceRecord(r).targetMargin) || DEFAULT_TARGET_MARGIN; }

function extractYieldNumber(yieldText) {
  const found = String(yieldText || "").match(/[\d.]+/);
  return found ? number(found[0]) : 0;
}
function sheetBatches(p) { return p ? number(p.batches) || 1 : 1; }
function baseBatchCost(p) { return p ? (number(p.totalBatchCost) || (p.recipe || []).reduce((s,l) => s + number(l.ingredientCost), 0)) : 0; }
function singleBatchCost(p) { const sb = sheetBatches(p); return sb ? baseBatchCost(p) / sb : baseBatchCost(p); }
function batchCostForRecipe(r) { return singleBatchCost(r.costProduct) * selectedBatches(r); }
function yieldPerSheetPlan(r) {
  const p = r.costProduct;
  return extractYieldNumber(p?.yieldLabel || r.yield) || 0;
}
function yieldPerSingleBatch(r) {
  const y = yieldPerSheetPlan(r);
  const sb = sheetBatches(r.costProduct);
  return sb ? y / sb : y;
}
function productionYield(r) { return yieldPerSingleBatch(r) * selectedBatches(r); }
function kitchenYield(r) { return yieldPerSingleBatch(r) * kitchenBatches(r); }
function unitLabel(r) {
  const text = String(r.costProduct?.yieldLabel || r.yield || "items").toLowerCase();
  if (text.includes("jar")) return "jars";
  if (text.includes("square")) return "squares";
  if (text.includes("pan")) return "pan";
  if (text.includes("cookie")) return "cookies";
  return "items";
}
function costEach(r) { const y = productionYield(r); return y ? batchCostForRecipe(r) / y : 0; }
function costDozen(r) { return costEach(r) * 12; }
function revenueForMode(r, mode) {
  const y = productionYield(r);
  if (y <= 0) return 0;
  if (unitLabel(r) === "jars" || unitLabel(r) === "pan") return (mode === "square" ? getSquareDzPrice(r) : getCorporateDzPrice(r)) * selectedBatches(r);
  if (mode === "squareRetailEach") return y * getSquareEachPrice(r);
  const dzPrice = mode === "square" ? getSquareDzPrice(r) : getCorporateDzPrice(r);
  return (y / 12) * dzPrice;
}
function estimatedRevenue(r) { return revenueForMode(r, pricingMode(r) === "squareEach" ? "squareRetailEach" : pricingMode(r)); }
function estimatedProfit(r) { return estimatedRevenue(r) - batchCostForRecipe(r); }
function marginForMode(r, mode) {
  const rev = revenueForMode(r, mode);
  return rev > 0 ? ((revenueForMode(r, mode) - batchCostForRecipe(r)) / rev) * 100 : 0;
}
function suggestedDzPriceForTarget(r, targetMargin = null) {
  const target = (targetMargin ?? getTargetMargin(r)) / 100;
  const cd = costDozen(r);
  if (cd <= 0 || target >= .98) return 0;
  return cd / (1 - target);
}
function bestPricingChannel(r) {
  const options = [
    ["Corporate DZ", marginForMode(r,"corporate"), revenueForMode(r,"corporate"), revenueForMode(r,"corporate") - batchCostForRecipe(r)],
    ["Square DZ", marginForMode(r,"square"), revenueForMode(r,"square"), revenueForMode(r,"square") - batchCostForRecipe(r)],
    ["Square Each", marginForMode(r,"squareRetailEach"), revenueForMode(r,"squareRetailEach"), revenueForMode(r,"squareRetailEach") - batchCostForRecipe(r)]
  ].filter(x => x[2] > 0);
  return options.sort((a,b) => b[3] - a[3])[0] || ["No price", 0, 0, 0];
}
function flags(p) { return p ? (p.recipe || []).filter(l => number(l.amount) <= 0 || number(l.ingredientCost) <= 0).length : 0; }
function activeRecipe() { const all = mergedRecipes(); return all.find(r => r.key === selectedRecipeKey) || all[0]; }

function parseFractionValue(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const mixed = text.match(/^(\d+)\s+(?:and\s+)?(\d+)\/(\d+)$/i);
  if (mixed) return number(mixed[1]) + number(mixed[2]) / number(mixed[3]);
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction) return number(fraction[1]) / number(fraction[2]);
  const decimal = text.match(/^\d+(?:\.\d+)?$/);
  if (decimal) return number(text);
  return null;
}
function formatScaledAmount(value) {
  const n = number(value);
  if (!isFinite(n) || n === 0) return "";
  const whole = Math.floor(n);
  const frac = n - whole;
  const common = [[0.125,"1/8"],[0.1667,"1/6"],[0.25,"1/4"],[0.3333,"1/3"],[0.375,"3/8"],[0.5,"1/2"],[0.625,"5/8"],[0.6667,"2/3"],[0.75,"3/4"],[0.875,"7/8"]];
  const hit = common.find(([v]) => Math.abs(frac - v) < 0.035);
  if (hit) return whole === 0 ? hit[1] : `${whole} ${hit[1]}`;
  if (Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n));
  return n.toFixed(2).replace(/\.?0+$/, "");
}
function pluralizeUnit(unit, amount) {
  const text = String(unit || "").trim().toLowerCase();
  if (!text) return "";
  const numericAmount = number(amount);
  const singular = numericAmount <= 1;
  if (text === "cup") return singular ? "cup" : "cups";
  if (text === "jar") return singular ? "jar" : "jars";
  if (text === "box") return singular ? "box" : "boxes";
  if (text === "bag") return singular ? "bag" : "bags";
  if (text === "tbsp") return "tbsp";
  if (text === "tsp") return "tsp";
  if (text === "oz") return "oz";
  if (text === "each") return "each";
  return text.replace(/s$/, "") + (singular ? "" : "s");
}
function formatIngredientRow(quantity, unit, ingredient) {
  const pieces = [quantity, unit, ingredient].filter(Boolean);
  return pieces.join(" ");
}
function scaledIngredientText(raw, batches) {
  let text = String(raw || "").trim();
  if (!text) return text;
  if (/^(green food coloring|flaky|handwritten|no almond|as needed|optional)/i.test(text)) return text;
  return text.replace(/(\b(?:\d+\s+(?:and\s+)?\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?))(?:\s+(whole|large|small|extra\s+large|extra-large|heaping|packed|level))?(?=\s*(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|eggs?|egg yolks?|yolks?|bags?|bag|jars?|jar|boxes?|box)\b)/gi,
    (match, amount) => {
      const parsed = parseFractionValue(amount);
      return parsed === null ? match : formatScaledAmount(parsed * batches);
    });
}
function scaledIngredientRows(r) {
  const batches = kitchenBatches(r);
  const ingredientList = Array.isArray(r.ingredients) ? r.ingredients : [];
  const structuredItems = ingredientList.filter(item => item && typeof item === "object" && !Array.isArray(item) && (item.ingredient || item.name || item.amount !== undefined));
  if (structuredItems.length) {
    return structuredItems.map(item => {
      const amount = number(item.amount);
      const scaledAmount = amount * batches;
      const quantity = formatScaledAmount(scaledAmount);
      const unit = pluralizeUnit(item.unit, scaledAmount);
      const ingredient = String(item.ingredient || item.name || "").trim();
      return formatIngredientRow(quantity, unit, ingredient);
    });
  }
  const stringItems = ingredientList.filter(item => typeof item === "string" || typeof item === "number");
  if (stringItems.length) {
    return stringItems.map(item => scaledIngredientText(item, batches));
  }
  const p = r.costProduct;
  if (p && (p.recipe || []).length) {
    const sheetBatch = sheetBatches(p);
    const multiplier = batches / Math.max(sheetBatch, 1);
    return (p.recipe || []).map(line => {
      if (line && typeof line === "object" && !Array.isArray(line)) {
        const amount = number(line.amount);
        const scaledAmount = amount * multiplier;
        const quantity = formatScaledAmount(scaledAmount);
        const unit = pluralizeUnit(line.unit, scaledAmount);
        const ingredient = String(line.ingredient || line.name || "").trim();
        return formatIngredientRow(quantity, unit, ingredient);
      }
      return scaledIngredientText(String(line || ""), multiplier);
    });
  }
  return ingredientList.map(item => scaledIngredientText(item, batches));
}

function batchControlHtml(r, compact = false, mode = "production") {
  const isKitchen = mode === "kitchen";
  const current = isKitchen ? kitchenBatches(r) : selectedBatches(r);
  const min = isKitchen ? 1 : 0;
  const label = isKitchen ? "Recipe Batch" : "Make";
  return `<div class="batch-control ${compact ? "compact" : ""} ${isKitchen ? "kitchen-control" : "production-control"}" data-key="${r.key}" data-mode="${mode}">
    <button type="button" data-action="minus" aria-label="Decrease batches">−</button>
    <label><span>${label}</span><input type="number" min="${min}" step="1" value="${current}" data-action="input"></label>
    <button type="button" data-action="plus" aria-label="Increase batches">+</button>
  </div>`;
}
function priceControlHtml(r) {
  const rec = priceRecord(r);
  const mode = pricingMode(r);
  return `<div class="dual-price-control" data-key="${r.key}">
    <label><span>Mode</span>
      <select data-field="mode">
        <option value="corporate" ${mode === "corporate" ? "selected" : ""}>Corporate DZ</option>
        <option value="square" ${mode === "square" ? "selected" : ""}>Square DZ</option>
        <option value="squareEach" ${mode === "squareEach" ? "selected" : ""}>Square Each</option>
      </select>
    </label>
    <label><span>Corp DZ</span><input type="number" min="0" step="0.01" data-field="corporateDz" value="${number(rec.corporateDz).toFixed(2)}"></label>
    <label><span>Square DZ</span><input type="number" min="0" step="0.01" data-field="squareDz" value="${number(rec.squareDz).toFixed(2)}"></label>
    <label><span>Each</span><input type="number" min="0" step="0.01" data-field="squareEach" value="${number(rec.squareEach).toFixed(2)}"></label>
  </div>`;
}

function renderStatus(live, msg) {
  const all = mergedRecipes();
  if (!selectedRecipeKey && all[0]) selectedRecipeKey = all[0].key;
  const title = document.getElementById("statusTitle");
  const message = document.getElementById("statusMessage");
  if (title) title.textContent = live ? `${all.length} recipes ready for Caleb` : `${all.length} recipes loaded`;
  if (message) message.textContent = live ? `${dashboardData.ingredients.length} ingredient costs connected. Kitchen and Production batches are separate.` : (msg || "Built-in recipe cards are loaded.");
}
function renderTodayFocus() {
  const container = document.getElementById("todayFocus");
  if (!container) return;

  const priorityItems = buildPriorityItems();
  const bakePriority = priorityItems.find(item => item.label === "Bake First");
  const matchingIssue = priorityItems.find(item => item.label === "Needs Match");
  const dataUnavailable = !hasBackendData || ["not_connected", "error", "unknown"].includes(String(dashboardData.squareStatus || "unknown"));
  const openValue = dataUnavailable ? null : openSquareValue();

  container.innerHTML = `
    <div class="panel-head">
      <div>
        <p class="eyebrow">What Caleb should do today</p>
        <h2>Today at a glance</h2>
        <p class="muted">A quick operational snapshot built from the current dashboard data.</p>
      </div>
    </div>
    <div class="today-focus-grid">
      <article class="today-focus-card">
        <p class="eyebrow">Open value</p>
        <strong>${dataUnavailable ? "Data unavailable" : money(openValue)}</strong>
        <span>${dataUnavailable ? "Live Square data is not available right now" : "Current open orders + invoices"}</span>
      </article>
      <article class="today-focus-card warning">
        <p class="eyebrow">Priority hint</p>
        <strong>${dataUnavailable ? "Data unavailable" : (bakePriority ? bakePriority.title : "No current bake priority")}</strong>
        <span>${dataUnavailable ? "Live demand data is not available right now" : (bakePriority ? bakePriority.detail : "No current bake priority")}</span>
      </article>
      <article class="today-focus-card alert">
        <p class="eyebrow">Review needed</p>
        <strong>${dataUnavailable ? "Data unavailable" : (matchingIssue ? matchingIssue.title : "No matching issues found")}</strong>
        <span>${dataUnavailable ? "Live demand data is not available right now" : (matchingIssue ? matchingIssue.detail : "No matching issues found")}</span>
      </article>
    </div>
  `;
}

function renderOverview() {
  const all = mergedRecipes();
  const linked = all.filter(r => r.costProduct).length;
  const productionCost = all.reduce((s,r) => s + batchCostForRecipe(r), 0);
  const revenue = all.reduce((s,r) => s + estimatedRevenue(r), 0);
  const totalYield = all.reduce((s,r) => s + productionYield(r), 0);
  const cards = [
    ["Recipes", all.length, "Kitchen cards"],
    ["Linked Costs", `${linked}/${all.length}`, "Google Sheet matched"],
    ["Production Batches", all.reduce((s,r) => s + selectedBatches(r), 0), "Planner only"],
    ["Production Yield", Math.round(totalYield), "Planner items"],
    ["Production Cost", money(productionCost), "Planner estimate"],
    ["Profit", money(revenue - productionCost), "Using sell prices"]
  ];
  const overview = document.getElementById("overview");
  if (overview) overview.innerHTML = cards.map(([label,value,detail]) => `<article class="metric-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join("");
  const rcp = document.getElementById("recipeCountPill");
  const icp = document.getElementById("ingredientCountPill");
  if (rcp) rcp.textContent = `${all.length} recipes`;
  if (icp) icp.textContent = `${dashboardData.ingredients.length} costs`;
}
function renderRecipeList(filter = "") {
  const q = filter.trim().toLowerCase();
  const all = mergedRecipes().filter(r => {
    const ingredientText = (r.ingredients || []).map(item => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return `${item.amount || ""} ${item.unit || ""} ${item.ingredient || item.name || ""}`;
      }
      return String(item || "");
    }).join(" ").toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || ingredientText.includes(q);
  });
  const list = document.getElementById("recipeList");
  if (!list) return;
  list.innerHTML = all.map(r => `<button class="recipe-row ${r.key === selectedRecipeKey ? "active" : ""}" data-key="${r.key}">
    <span><b>${r.name}</b><small>Kitchen: ${kitchenBatches(r)} batch • ${Math.round(kitchenYield(r))} ${unitLabel(r)}</small></span>
    <em class="${r.costProduct ? "linked" : "text"}">${r.costProduct ? "Cost" : "Text"}</em>
  </button>`).join("");
  list.querySelectorAll(".recipe-row").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedRecipeKey = btn.dataset.key;
      renderRecipeList(document.getElementById("recipeSearch")?.value || "");
      renderRecipeDetail();
      bindControls();
    });
  });
}
function renderRecipeDetail() {
  const r = activeRecipe();
  const detail = document.getElementById("recipeDetail");
  if (!r || !detail) return;
  const lines = scaledIngredientRows(r);
  detail.innerHTML = `<div class="recipe-detail-head">
    <div><p class="eyebrow">${Math.round(kitchenYield(r))} ${unitLabel(r)}</p><h3>${r.name}</h3><p class="muted">Kitchen batch only scales this recipe. It does not affect Production Planner or Smart Prep.</p></div>
    <div class="detail-side kitchen-side">${batchControlHtml(r,false,"kitchen")}
      <div class="kitchen-yield-card"><span>Kitchen Recipe</span><strong>${kitchenBatches(r)} batch${kitchenBatches(r)===1?"":"es"}</strong><small>${Math.round(kitchenYield(r))} ${unitLabel(r)} estimated</small></div>
    </div>
  </div>
  <div class="detail-grid">
    <section><h4>Scaled Ingredients</h4><ul class="ingredient-list">${lines.map(i => `<li class="ingredient-row">${i}</li>`).join("")}</ul></section>
    <section><h4>Steps</h4><ol class="steps-list">${(r.steps || []).map(s => `<li>${s}</li>`).join("")}</ol></section>
  </div>`;
}
function setAllBatchesZero() { mergedRecipes().forEach(r => productionBatchState[r.key] = 0); saveState("cdawgProductionBatchState", productionBatchState); renderAll(); }
function setCostedBatchesOne() { mergedRecipes().forEach(r => productionBatchState[r.key] = r.costProduct ? 1 : 0); saveState("cdawgProductionBatchState", productionBatchState); renderAll(); }
function resetKitchenRecipeBatches() { mergedRecipes().forEach(r => kitchenBatchState[r.key] = 1); saveState("cdawgKitchenBatchState", kitchenBatchState); renderAll(); }
function renderCostCards() {
  const all = mergedRecipes();
  const cards = document.getElementById("recipeCards");
  if (!cards) return;
  cards.innerHTML = `<div class="planner-actions">
    <button type="button" id="zeroAllBatches">Set production batches to 0</button>
    <button type="button" id="oneCostedBatch">Set costed recipes to 1</button>
    <button type="button" id="resetKitchenBatches">Reset kitchen recipe batches to 1</button>
    <span>Production batches control cost/profit/Smart Prep only. Pricing mode controls planner revenue.</span>
  </div>
  ${all.map(r => {
    const cost = batchCostForRecipe(r), revenue = estimatedRevenue(r), profit = estimatedProfit(r), y = productionYield(r);
    const best = bestPricingChannel(r);
    return `<article class="cost-card ${!r.costProduct || cost <= 0 ? "needs-cleanup" : ""}">
      <div class="cost-top"><div><p class="eyebrow">${selectedBatches(r)} production ${selectedBatches(r)===1?"batch":"batches"}</p><h3>${r.name}</h3><span>${Math.round(y)} ${unitLabel(r)} planned</span></div><strong>${money(cost)}</strong></div>
      ${batchControlHtml(r,true,"production")}
      ${priceControlHtml(r)}
      <div class="cost-stats business-stats"><span><small>Active Rev</small><b>${money(revenue)}</b></span><span><small>Profit</small><b>${money(profit)}</b></span><span><small>Margin</small><b>${revenue ? Math.round((profit/revenue)*100) : 0}%</b></span></div>
      <div class="mini-margin-row"><span>Corp ${Math.round(marginForMode(r,"corporate"))}%</span><span>Sq DZ ${Math.round(marginForMode(r,"square"))}%</span><span>Sq Each ${Math.round(marginForMode(r,"squareRetailEach"))}%</span></div>
      <p class="best-channel">Best profit channel: <b>${best[0]}</b></p>
      <details><summary>${r.costProduct ? "Ingredient cost breakdown" : "No sheet match yet"}</summary>${r.costProduct ? (r.costProduct.recipe || []).map(l => `<p><b>${l.ingredient}</b><span>${number(l.amount).toFixed(2)} ${l.unit || ""} • ${money(l.ingredientCost)}</span></p>`).join("") : `<p><b>Recipe text loaded.</b><span>Add matching cost rows.</span></p>`}</details>
    </article>`;
  }).join("")}`;
  document.getElementById("zeroAllBatches")?.addEventListener("click", setAllBatchesZero);
  document.getElementById("oneCostedBatch")?.addEventListener("click", setCostedBatchesOne);
  document.getElementById("resetKitchenBatches")?.addEventListener("click", resetKitchenRecipeBatches);
}
function renderPricing() {
  const all = mergedRecipes();
  const planned = all.filter(r => selectedBatches(r) > 0);
  const rows = (planned.length ? planned : all).map(r => {
    const target = getTargetMargin(r);
    const suggested = suggestedDzPriceForTarget(r, target);
    return `<article class="pricing-card"><div><p class="eyebrow">${selectedBatches(r)} production ${selectedBatches(r)===1?"batch":"batches"}</p><h3>${r.name}</h3><small>Cost/dozen ${money(costDozen(r))} • Target ${target}%</small></div>
      <div class="pricing-table">
        <span><b>Corporate DZ</b><em>${money(getCorporateDzPrice(r))}</em><small>${Math.round(marginForMode(r,"corporate"))}% margin</small></span>
        <span><b>Square DZ</b><em>${money(getSquareDzPrice(r))}</em><small>${Math.round(marginForMode(r,"square"))}% margin</small></span>
        <span><b>Square Each</b><em>${money(getSquareEachPrice(r))}</em><small>${Math.round(marginForMode(r,"squareRetailEach"))}% margin</small></span>
      </div>
      <div class="suggested-price"><b>Suggested DZ for ${target}% margin</b><strong>${money(suggested)}</strong></div></article>`;
  }).join("");
  const grid = document.getElementById("pricingGrid");
  if (grid) grid.innerHTML = rows || `<div class="empty-state">No recipes loaded.</div>`;
  const pill = document.getElementById("pricingCountPill");
  if (pill) pill.textContent = `${all.length} price sets`;
}
function renderIngredients() {
  const grid = document.getElementById("ingredientGrid");
  if (!grid) return;
  const ing = [...(dashboardData.ingredients || [])].sort((a,b) => a.name.localeCompare(b.name));
  grid.innerHTML = ing.length ? ing.map(i => `<article class="ingredient-chip"><b>${i.name}</b><span>${money(i.costPerUnit)} / ${i.unit || i.recipeUnit || "unit"}</span><small>${i.shoppingUnit || i.packageSize || "package"}${i.price ? ` • ${money(i.price)}` : ""}</small></article>`).join("") : `<div class="empty-state">No ingredient costs loaded yet.</div>`;
}
function buildIngredientTotals() {
  const totals = {};
  mergedRecipes().forEach(r => {
    const p = r.costProduct;
    if (!p || selectedBatches(r) <= 0) return;
    const multiplier = selectedBatches(r) / sheetBatches(p);
    (p.recipe || []).forEach(line => {
      const name = line.ingredient || "Unknown";
      const unit = line.unit || "";
      const key = `${name}__${unit}`;
      if (!totals[key]) totals[key] = { name, unit, amount: 0, cost: 0 };
      totals[key].amount += number(line.amount) * multiplier;
      totals[key].cost += number(line.ingredientCost) * multiplier;
    });
  });
  return Object.values(totals).filter(x => x.amount > 0).sort((a,b) => b.cost - a.cost);
}
function renderCleanup() {
  const all = mergedRecipes();
  const issues = [];
  all.forEach(r => {
    if (!r.costProduct) issues.push([r.name, "No sheet match", "warn"]);
    else {
      if (singleBatchCost(r.costProduct) <= 0) issues.push([r.name, "Zero batch cost", "bad"]);
      const f = flags(r.costProduct);
      if (f) issues.push([r.name, `${f} zero amount/cost lines`, "warn"]);
    }
  });
  const list = document.getElementById("cleanupList");
  if (list) list.innerHTML = issues.length ? issues.map(([name,msg,type]) => `<div class="list-row"><div><strong>${name}</strong><span>${msg}</span></div><em class="${type}">Review</em></div>`).join("") : `<div class="empty-state">Nothing scary. Beautiful.</div>`;
  const costed = all.filter(r => r.costProduct && singleBatchCost(r.costProduct) > 0);
  const sorted = [...costed].sort((a,b) => singleBatchCost(b.costProduct) - singleBatchCost(a.costProduct));
  const ex = document.getElementById("costExtremes");
  if (ex) ex.innerHTML = sorted.length ? sorted.slice(0,6).map(r => `<div class="list-row"><div><strong>${r.name}</strong><span>${Math.round(yieldPerSingleBatch(r))} ${unitLabel(r)} per batch</span></div><b>${money(singleBatchCost(r.costProduct))}</b></div>`).join("") : `<div class="empty-state">No cost data yet.</div>`;
}

function orderStatus(order) { return String(order.status || order.state || "OPEN").toUpperCase(); }
function isOpenOrder(order) { return !["COMPLETED","CANCELED","CANCELLED","REFUNDED","FAILED"].includes(orderStatus(order)); }
function allSquareOrders() { return Array.isArray(dashboardData.orders) ? dashboardData.orders : []; }
function openSquareOrders() { return allSquareOrders().filter(isOpenOrder); }
function completedSquareOrders() { return allSquareOrders().filter(o => orderStatus(o) === "COMPLETED"); }
function orderTotal(order) { return number(order.total || 0); }
function orderDate(order) { return order.createdAt || order.created_at || order.updatedAt || order.updated_at || ""; }
function orderItems(order) {
  return (order.items || order.lineItems || order.line_items || []).map(item => ({
    name: item.name || item.title || item.variationName || item.variation_name || "Unknown item",
    quantity: number(item.quantity || item.qty || 1) || 1,
    total: number(item.total || item.amount || item.totalMoney || 0),
    variationName: item.variationName || item.variation_name || "",
    catalogObjectId: item.catalogObjectId || item.catalog_object_id || ""
  }));
}
function allSquareInvoices() { return Array.isArray(dashboardData.squareInvoices) ? dashboardData.squareInvoices : []; }
function invoiceStatus(invoice) { return String(invoice.status || invoice.state || "DRAFT").toUpperCase(); }
function isOpenInvoice(invoice) { return !["PAID","CANCELED","CANCELLED","REFUNDED","FAILED"].includes(invoiceStatus(invoice)); }
function openSquareInvoices() { return allSquareInvoices().filter(isOpenInvoice); }
function invoiceTotal(invoice) { return number(invoice.total || invoice.totalMoney || invoice.amount || invoice.balance || 0); }
function invoiceDate(invoice) { return invoice.createdAt || invoice.created_at || invoice.updatedAt || invoice.updated_at || invoice.dueDate || ""; }
function invoiceItems(invoice) {
  const items = invoice.items || invoice.lineItems || invoice.line_items || [];
  if (!items.length && (invoice.title || invoice.description)) {
    return [{ name: invoice.title || invoice.description || "Invoice item", quantity: 1, total: invoiceTotal(invoice), variationName: "", catalogObjectId: "" }];
  }
  return items.map(item => ({
    name: item.name || item.description || item.title || "Invoice item",
    quantity: number(item.quantity || item.qty || 1) || 1,
    total: number(item.total || item.amount || item.totalMoney || 0),
    variationName: item.variationName || "",
    catalogObjectId: item.catalogObjectId || ""
  }));
}

/* v92 Square invoice/order de-dupe */
function squareDocIdentity(doc) {
  return norm(
    doc.orderId ||
    doc.order_id ||
    doc.orderID ||
    doc.invoice?.order_id ||
    doc.invoice?.orderId ||
    doc.payment_requests?.[0]?.request_method ||
    doc.id ||
    doc.invoiceId ||
    doc.invoice_id ||
    doc.name ||
    ""
  );
}

function lineItemSignature(items) {
  return (items || [])
    .map(item => `${norm(item.name)}:${number(item.quantity)}`)
    .sort()
    .join("|");
}

function dedupeOpenSquareDocuments(docs) {
  const groups = new Map();

  docs.forEach(doc => {
    const items = doc.docType === "Invoice" ? invoiceItems(doc) : orderItems(doc);
    const signature = lineItemSignature(items);
    const total = doc.docType === "Invoice" ? invoiceTotal(doc) : orderTotal(doc);
    const id = squareDocIdentity(doc);
    const key = id || signature || norm(`${doc.customer || doc.customerName || ""}-${total}-${doc.docType}`);

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({...doc, __items: items, __signature: signature, __total: total});
  });

  const result = [];

  groups.forEach(group => {
    if (group.length === 1) {
      result.push(group[0]);
      return;
    }

    const orders = group.filter(doc => doc.docType === "Order");
    const invoices = group.filter(doc => doc.docType === "Invoice");

    if (orders.length && invoices.length) {
      const order = orders.sort((a,b) => number(b.__total) - number(a.__total))[0];
      const invoice = invoices.sort((a,b) => number(b.__total) - number(a.__total))[0];

      result.push({
        ...order,
        docType: "Order + Invoice",
        invoiceStatus: invoiceStatus(invoice),
        invoiceId: invoice.id || invoice.invoiceId || invoice.invoice_id || "",
        invoiceTotal: invoiceTotal(invoice),
        invoiceRaw: invoice
      });
      return;
    }

    result.push(group.sort((a,b) => number(b.__total) - number(a.__total))[0]);
  });

  return result.map(({__items, __signature, __total, ...doc}) => doc);
}


/* v93 invoice placeholder fix */
function isPlaceholderInvoice(invoice) {
  const total = invoiceTotal(invoice);
  const items = invoiceItems(invoice);
  const text = norm([
    invoice.title,
    invoice.description,
    invoice.name,
    invoice.id,
    ...items.map(item => item.name)
  ].filter(Boolean).join(" "));

  if (total > 0.009) return false;

  const hasRealCookieMatch = items.some(item => {
    const recipe = matchRecipeFromOrderItem(item);
    return recipe && !/july|placeholder|test|deposit|draft/.test(norm(item.name));
  });

  if (!hasRealCookieMatch) return true;
  if (/july|placeholder|test|draft|zero/.test(text)) return true;

  return true;
}

function openSquareInvoicesForBakeryWork() {
  return openSquareInvoices().filter(invoice => !isPlaceholderInvoice(invoice));
}

function placeholderOpenInvoices() {
  return openSquareInvoices().filter(isPlaceholderInvoice);
}

function combinedOpenSquareDocuments() {
  return dedupeOpenSquareDocuments([
    ...openSquareOrders().map(o => ({...o, docType:"Order"})),
    ...openSquareInvoicesForBakeryWork().map(i => ({...i, docType:"Invoice"}))
  ]);
}
function formatDateShort(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined,{month:"short",day:"numeric"}) + " " + d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
}
function matchRecipeFromOrderItem(item) {
  const itemKeys = matchingKeys(`${item.name} ${item.variationName || ""}`);
  let best = null, bestScore = 0;
  mergedRecipes().forEach(r => {
    const rKeys = recipeKeys(r);
    const direct = itemKeys.some(ik => rKeys.some(rk => ik === rk || (ik.length > 4 && rk.includes(ik)) || (rk.length > 4 && ik.includes(rk))));
    if (direct) { best = r; bestScore = 1; return; }
    [r.name, ...(r.aliases || [])].forEach(name => {
      const score = tokenScore(item.name, name);
      if (score > bestScore) { bestScore = score; best = r; }
    });
  });
  return bestScore >= 0.42 ? best : null;
}
function buildOrderDemand() {
  const rows = {};
  combinedOpenSquareDocuments().forEach(doc => {
    const items = doc.docType === "Invoice" ? invoiceItems(doc) : orderItems(doc);
    items.forEach(item => {
      const recipe = matchRecipeFromOrderItem(item);
      const key = recipe ? recipe.key : norm(item.name);
      if (!rows[key]) rows[key] = { key, recipe, name: recipe ? recipe.name : item.name, quantity: 0, revenue: 0, orders: new Set(), unmatched: !recipe };
      rows[key].quantity += item.quantity;
      rows[key].revenue += item.total;
      rows[key].orders.add(doc.id || doc.orderId || doc.name || "Square");
    });
  });
  return Object.values(rows).map(row => ({...row, orderCount: row.orders.size})).sort((a,b) => b.quantity - a.quantity || b.revenue - a.revenue);
}
function productionDemandBatches() {
  return buildOrderDemand().map(row => {
    const yieldOne = row.recipe ? yieldPerSingleBatch(row.recipe) : 0;
    const batches = yieldOne ? Math.ceil(row.quantity / yieldOne) : 0;
    const recipeCost = row.recipe ? singleBatchCost(row.recipe.costProduct) * batches : 0;
    return { ...row, yieldOne, batches, recipeCost };
  });
}
function buildDemandIngredientTotals() {
  const totals = {};
  productionDemandBatches().forEach(row => {
    if (row.unmatched || !row.recipe || row.batches <= 0) return;
    const p = row.recipe.costProduct;
    if (!p) return;
    const multiplier = row.batches / sheetBatches(p);
    (p.recipe || []).forEach(line => {
      const name = line.ingredient || "Unknown";
      const unit = line.unit || "";
      const key = `${name}__${unit}`;
      if (!totals[key]) totals[key] = { name, unit, amount: 0, cost: 0 };
      totals[key].amount += number(line.amount) * multiplier;
      totals[key].cost += number(line.ingredientCost) * multiplier;
    });
  });
  return Object.values(totals).filter(x => x.amount > 0).sort((a,b) => b.cost - a.cost);
}
function demandProductionCost() { return productionDemandBatches().reduce((s,row) => s + number(row.recipeCost), 0); }
function squareOrderSummary() {
  const orders = allSquareOrders();
  const invoices = allSquareInvoices();
  const open = openSquareOrders();
  const openInvoices = openSquareInvoices();
  const combinedOpen = combinedOpenSquareDocuments();
  const openRevenue = open.reduce((s,o) => s + orderTotal(o), 0);
  const openInvoiceRevenue = openSquareInvoicesForBakeryWork().reduce((s,i) => s + invoiceTotal(i), 0);
  const totalRevenue = orders.reduce((s,o) => s + orderTotal(o), 0);
  const totalInvoiceRevenue = invoices.reduce((s,i) => s + invoiceTotal(i), 0);
  const demand = buildOrderDemand();
  return { orders, invoices, open, openInvoices, combinedOpen, openRevenue, openInvoiceRevenue, totalRevenue, totalInvoiceRevenue, demand };
}
function openSquareValue() { const s = squareOrderSummary(); return s.openRevenue + s.openInvoiceRevenue; }
function orderHubProfitEstimate() { return openSquareValue() - demandProductionCost(); }
function marginFromProfit(profit, revenue) { return revenue > 0 ? (profit / revenue) * 100 : 0; }
function applyDemandToProductionPlanner() {
  mergedRecipes().forEach(r => productionBatchState[r.key] = 0);
  productionDemandBatches().forEach(row => { if (row.recipe && row.batches > 0) productionBatchState[row.recipe.key] = row.batches; });
  saveState("cdawgProductionBatchState", productionBatchState);
  renderAll();
}
function renderOrderHub() {
  const summary = squareOrderSummary();
  const status = String(dashboardData.squareStatus || (summary.orders.length || summary.invoices.length ? "connected" : "not_connected"));
  const message = dashboardData.squareMessage || ((summary.orders.length || summary.invoices.length) ? "Square data loaded." : "No Square orders or invoices returned yet.");
  const pill = document.getElementById("orderCountPill");
  if (pill) pill.textContent = `${summary.orders.length + summary.invoices.length} docs`;
  const squareStatus = document.getElementById("squareStatus");
  if (squareStatus) squareStatus.innerHTML = `<div class="status-dot ${status}"></div><div><b>Square ${status.replace(/_/g," ")}</b><span>${message}</span></div><small>${dashboardData.squareCatalog?.length || 0} catalog records</small>`;
  const orderSummary = document.getElementById("orderSummary");
  if (orderSummary) {
    orderSummary.innerHTML = [
      ["Open Orders", summary.combinedOpen.length, "Unique bakery orders"],
      ["Open Invoices", summary.openInvoices.length, "Unpaid records; $0 ignored"],
      ["Open Value", money(summary.openRevenue + summary.openInvoiceRevenue), "Real bakery work"],
      ["30-Day Orders", summary.orders.length, "Returned by backend"],
      ["Invoices", summary.invoices.length, "Returned by backend"],
      ["30-Day Value", money(summary.totalRevenue + summary.totalInvoiceRevenue), "Orders + invoices"],
      ["Demand Groups", summary.demand.length, "Matched line items"],
      ["Catalog Items", dashboardData.squareCatalog?.length || 0, "Square retail layer"]
    ].map(([label,value,detail]) => `<article><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join("");
  }
  const openPill = document.getElementById("openOrderPill");
  if (openPill) openPill.textContent = `${summary.open.length + summary.openInvoices.length} open`;
  const openOrders = document.getElementById("openOrders");
  if (openOrders) {
    const skippedPlaceholders = typeof placeholderOpenInvoices === "function" ? placeholderOpenInvoices() : [];
    openOrders.innerHTML = summary.combinedOpen.length ? summary.combinedOpen.slice(0,20).map(doc => {
      const items = doc.docType === "Invoice" ? invoiceItems(doc) : orderItems(doc);
      const total = doc.docType === "Invoice" ? invoiceTotal(doc) : orderTotal(doc);
      const statusText = doc.docType === "Invoice" ? invoiceStatus(doc) : orderStatus(doc);
      return `<article class="order-card"><div class="order-card-top"><div><b>${doc.customer || doc.customerName || "Square Customer"}</b><span>${formatDateShort(doc.docType === "Invoice" ? invoiceDate(doc) : orderDate(doc)) || "Date pending"}</span></div><strong>${money(total)}</strong></div><p><em>${doc.docType} · ${statusText}${doc.invoiceStatus ? " · Invoice " + doc.invoiceStatus : ""}</em> <small>${doc.id || ""}</small></p><ul>${items.map(item => `<li><span>${item.quantity}× ${item.name}</span><b>${money(item.total)}</b></li>`).join("")}</ul></article>`;
    }).join("") + (skippedPlaceholders.length ? `<div class="zero-invoice-note">Ignored ${skippedPlaceholders.length} $0 placeholder invoice${skippedPlaceholders.length===1?"":"s"} for bakery order count and production demand.</div>` : "") : `<div class="empty-state">No pending/open Square orders or invoices right now.</div>`;
  }
  const demandRows = productionDemandBatches();
  const demandPill = document.getElementById("demandPill");
  if (demandPill) demandPill.textContent = `${demandRows.reduce((s,r) => s + r.quantity, 0)} items`;
  const demand = document.getElementById("orderDemand");
  if (demand) {
    demand.innerHTML = demandRows.length ? `<button type="button" class="apply-demand-btn" id="applyDemandButton">Send demand to Production Planner</button>${demandRows.map(row => `<article class="demand-card ${row.unmatched ? "unmatched" : ""}"><div><b>${row.name}</b><span>${row.quantity} ordered across ${row.orderCount} order${row.orderCount===1?"":"s"}</span></div><strong>${row.unmatched ? "Match needed" : `${row.batches} batch${row.batches===1?"":"es"}`}</strong><small>${row.unmatched ? "Add alias or matching recipe/product name" : `Yield ${Math.round(row.yieldOne)} each batch · est cost ${money(row.recipeCost)}`}</small></article>`).join("")}` : `<div class="empty-state">No production demand yet.</div>`;
    document.getElementById("applyDemandButton")?.addEventListener("click", applyDemandToProductionPlanner);
  }
}
function buildPriorityItems() {
  const summary = squareOrderSummary();
  const demand = productionDemandBatches();
  const unmatched = demand.filter(row => row.unmatched);
  const matched = demand.filter(row => !row.unmatched && row.batches > 0);
  const revenue = openSquareValue();
  const cost = demandProductionCost();
  const profit = revenue - cost;
  const margin = marginFromProfit(profit, revenue);
  const ingredients = buildDemandIngredientTotals();
  const items = [];
  items.push(summary.combinedOpen.length ? { label:"Square Work", title:`${summary.combinedOpen.length} open order/invoice item${summary.combinedOpen.length===1?"":"s"}`, detail:`${money(revenue)} open value waiting for Caleb.`, tone:"hot" } : { label:"Square Work", title:"No open Square work", detail:"Order Hub is connected and waiting for the next order/invoice.", tone:"calm" });
  if (matched.length) items.push({ label:"Bake First", title:matched.map(row => `${row.batches}× ${row.name}`).join(" · "), detail:`Demand engine matched ${matched.length} recipe group${matched.length===1?"":"s"}.`, tone:"success" });
  if (unmatched.length) items.push({ label:"Needs Match", title:unmatched.map(row => row.name).join(" · "), detail:"Add recipe aliases or align Square names so Brain can batch these.", tone:"warn" });
  if (revenue > 0) items.push({ label:"Order Profit", title:`${money(profit)} est. profit · ${percent(margin)} margin`, detail:`Based on ${money(cost)} estimated recipe production cost.`, tone: margin >= 65 ? "success" : margin >= 45 ? "calm" : "warn" });
  if (ingredients.length) items.push({ label:"Prep Pull", title:ingredients.map(i => `${i.amount.toFixed(1).replace(/\.0$/,"")} ${i.unit} ${i.name}`).join(" · "), detail:"Ingredient prep based on live Square demand only.", tone:"calm" });
  return items;
}
function percent(value) { return !isFinite(value) ? "0%" : `${value.toFixed(1).replace(/\.0$/,"")}%`; }
function buildBrain() {
  const all = mergedRecipes();
  const planned = all.filter(r => selectedBatches(r) > 0);
  const productionCost = all.reduce((s,r) => s + batchCostForRecipe(r), 0);
  const activeRevenue = all.reduce((s,r) => s + estimatedRevenue(r), 0);
  const activeProfit = activeRevenue - productionCost;
  const activeMargin = activeRevenue > 0 ? (activeProfit / activeRevenue) * 100 : 0;
  const corpRevenue = all.reduce((s,r) => s + revenueForMode(r,"corporate"), 0);
  const squareDzRevenue = all.reduce((s,r) => s + revenueForMode(r,"square"), 0);
  const squareEachRevenue = all.reduce((s,r) => s + revenueForMode(r,"squareRetailEach"), 0);
  const corpProfit = corpRevenue - productionCost;
  const squareDzProfit = squareDzRevenue - productionCost;
  const squareEachProfit = squareEachRevenue - productionCost;
  const corpMargin = corpRevenue > 0 ? (corpProfit / corpRevenue) * 100 : 0;
  const squareDzMargin = squareDzRevenue > 0 ? (squareDzProfit / squareDzRevenue) * 100 : 0;
  const squareEachMargin = squareEachRevenue > 0 ? (squareEachProfit / squareEachRevenue) * 100 : 0;
  const totalYield = all.reduce((s,r) => s + productionYield(r), 0);
  const avgProfitPerDozen = totalYield ? activeProfit / (totalYield / 12) : 0;
  const zeroMatch = all.filter(r => !r.costProduct);
  const ingredientTotals = buildIngredientTotals().slice(0,18);
  const demandRows = productionDemandBatches();
  const orderValue = openSquareValue();
  const demandCost = demandProductionCost();
  const orderProfit = orderHubProfitEstimate();
  const orderMargin = marginFromProfit(orderProfit, orderValue);
  const recs = [
    { type:"success", title:"Brain 8.0 live refresh", text:"Square + Google Sheets refresh on load, focus, Refresh, and every 60 seconds." }
  ];
  if (orderValue > 0) recs.push({ type: orderMargin >= 65 ? "success" : "money", title:"ERP profit health", text:`Open value ${money(orderValue)} · demand cost ${money(demandCost)} · est. profit ${money(orderProfit)} · ${percent(orderMargin)} margin.` });
  if (demandRows.length) recs.push({ type:"success", title:"Production queue", text:demandRows.filter(r => !r.unmatched).map(r => `${r.batches}× ${r.name}`).join(", ") || "No matched production yet." });
  if (!planned.length) recs.push({ type:"warning", title:"No production selected", text:"Set Production Planner batches above 0 or send Square demand to planner." });
  if (zeroMatch.length) recs.push({ type:"warning", title:"Finish sheet matching", text:`${zeroMatch.length} recipes still need sheet matches before all pricing math is fully trusted.` });
  return { all, planned, productionCost, activeRevenue, activeProfit, activeMargin, corpProfit, corpMargin, squareDzProfit, squareDzMargin, squareEachProfit, squareEachMargin, avgProfitPerDozen, totalYield, zeroMatch, ingredientTotals, recs };
}
function renderBrain() {
  const brain = buildBrain();
  const summary = document.getElementById("brainSummary");
  if (summary) summary.innerHTML = `
    <article><span>Open Square</span><strong>${squareOrderSummary().combinedOpen.length}</strong><small>${money(openSquareValue())} pending</small></article>
    <article><span>Demand Cost</span><strong>${money(demandProductionCost())}</strong><small>from Square demand</small></article>
    <article><span>Demand Profit</span><strong>${money(orderHubProfitEstimate())}</strong><small>${percent(marginFromProfit(orderHubProfitEstimate(), openSquareValue()))} margin</small></article>
    <article><span>Planner Cost</span><strong>${money(brain.productionCost)}</strong><small>manual planner batches</small></article>
    <article><span>Active Revenue</span><strong>${money(brain.activeRevenue)}</strong><small>selected pricing modes</small></article>
    <article><span>Active Profit</span><strong>${money(brain.activeProfit)}</strong><small>projected net</small></article>
    <article><span>Active Margin</span><strong>${percent(brain.activeMargin)}</strong><small>profit ÷ revenue</small></article>
    <article><span>Corporate Profit</span><strong>${money(brain.corpProfit)}</strong><small>${percent(brain.corpMargin)} margin</small></article>
    <article><span>Square DZ Profit</span><strong>${money(brain.squareDzProfit)}</strong><small>${percent(brain.squareDzMargin)} margin</small></article>
    <article><span>Square Each Profit</span><strong>${money(brain.squareEachProfit)}</strong><small>${percent(brain.squareEachMargin)} margin</small></article>
    <article><span>Profit / Dozen</span><strong>${money(brain.avgProfitPerDozen)}</strong><small>active pricing</small></article>`;
  const priority = document.getElementById("priorityList");
  if (priority) {
    priority.innerHTML = `<div class="priority-head"><div><p class="eyebrow">Brain 8.0</p><h3>Caleb’s Today List</h3></div><button type="button" id="priorityApplyDemand">Send Square demand to planner</button></div><div class="priority-grid">${buildPriorityItems().map(item => `<article class="${item.tone}"><span>${item.label}</span><b>${item.title}</b><small>${item.detail}</small></article>`).join("")}</div>`;
    document.getElementById("priorityApplyDemand")?.addEventListener("click", applyDemandToProductionPlanner);
  }
  const brainCards = document.getElementById("brainCards");
  if (brainCards) brainCards.innerHTML = brain.recs.map(item => `<article class="brain-card ${item.type}"><p>${item.title}</p><span>${item.text}</span></article>`).join("");
  const shopping = document.getElementById("shoppingList");
  if (shopping) shopping.innerHTML = `<div class="panel-head slim"><div><p class="eyebrow">Smart Prep List</p><h2>Ingredients Needed for Production Planner Batches</h2><p class="muted">Only Production Planner batch counts feed this list. Kitchen recipe batches do not.</p></div></div><div class="shopping-grid">${brain.ingredientTotals.length ? brain.ingredientTotals.map(item => `<article><b>${item.name}</b><span>${item.amount.toFixed(2).replace(/\.?0+$/,"")} ${item.unit}</span><small>${money(item.cost)} planned cost</small></article>`).join("") : `<div class="empty-state">No production batches selected yet. Set Production Planner batches above 0 to build this prep list.</div>`}</div>`;
}

function bindControls() {
  document.querySelectorAll(".batch-control").forEach(control => {
    const key = control.dataset.key;
    const mode = control.dataset.mode || "production";
    const isKitchen = mode === "kitchen";
    const min = isKitchen ? 1 : 0;
    const getCurrent = () => isKitchen ? getKitchenBatch(key,1) : getProductionBatch(key,0);
    const setCurrent = value => isKitchen ? setKitchenBatch(key,value) : setProductionBatch(key,value);
    control.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const current = getCurrent();
        const next = btn.dataset.action === "plus" ? current + 1 : Math.max(min, current - 1);
        setCurrent(next);
        renderAll();
      });
    });
    control.querySelector("input")?.addEventListener("change", e => {
      setCurrent(Math.max(min, number(e.target.value)));
      renderAll();
    });
  });
  document.querySelectorAll(".dual-price-control").forEach(control => {
    const key = control.dataset.key;
    control.querySelectorAll("input").forEach(input => input.addEventListener("change", () => { setPriceField(key, input.dataset.field, input.value); renderAll(); }));
    control.querySelector("select")?.addEventListener("change", e => { setPricingMode(key, e.target.value); renderAll(); });
  });
}
function renderAll() {
  renderTodayFocus();
  renderOverview();
  renderRecipeList(document.getElementById("recipeSearch")?.value || "");
  renderRecipeDetail();
  renderCostCards();
  renderPricing();
  renderIngredients();
  renderCleanup();
  renderBrain();
  renderOrderHub();
  bindControls();
  syncPanel(lastSyncAt ? "LIVE" : "Loading…", lastSyncAt ? "Fresh Square + Google Sheets data loaded" : "Pulling fresh bakery data");
}
async function init() {
  let live = false, msg = "";
  try { await loadBackendData(); live = true; lastSyncAt = new Date(); } catch (e) { hasBackendData = false; console.warn(e); msg = e.message; }
  renderStatus(live, msg);
  renderAll();
  startCountdown();
  document.getElementById("recipeSearch")?.addEventListener("input", e => renderRecipeList(e.target.value));
  document.getElementById("refreshButton")?.addEventListener("click", liveRefresh);
  document.getElementById("printTodayButton")?.addEventListener("click", () => window.print());
  document.getElementById("brainButton")?.addEventListener("click", () => { renderBrain(); renderOrderHub(); });
  startAutoRefresh();
}
init();
window.addEventListener("focus", liveRefresh);


/* v90 mobile marker */
document.documentElement.classList.add("mobile-ready", "v90-mobile");
function cdawgMobileViewportVars() {
  document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
  document.documentElement.style.setProperty("--vw", `${window.innerWidth * 0.01}px`);
}
cdawgMobileViewportVars();
window.addEventListener("resize", cdawgMobileViewportVars);
window.addEventListener("orientationchange", () => setTimeout(cdawgMobileViewportVars, 250));


/* v91 fixed mobile header spacing */
function cdawgUpdateMobileHeaderHeight() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  const height = Math.ceil(sidebar.getBoundingClientRect().height || 0);
  if (height > 0) {
    document.documentElement.style.setProperty("--mobile-header-height", `${height}px`);
  }
}
cdawgUpdateMobileHeaderHeight();
window.addEventListener("load", cdawgUpdateMobileHeaderHeight);
window.addEventListener("resize", cdawgUpdateMobileHeaderHeight);
window.addEventListener("orientationchange", () => setTimeout(cdawgUpdateMobileHeaderHeight, 300));
setTimeout(cdawgUpdateMobileHeaderHeight, 500);
setTimeout(cdawgUpdateMobileHeaderHeight, 1500);


/* v92 remeasure fixed header after nav wraps */
setTimeout(cdawgUpdateMobileHeaderHeight, 250);
setTimeout(cdawgUpdateMobileHeaderHeight, 1000);
setTimeout(cdawgUpdateMobileHeaderHeight, 2500);
