/**
 * C-Dawg's Snack Shack Dashboard Backend
 * Deploy as Google Apps Script Web App: Execute as Me, Anyone with link.
 * Dashboard uses JSONP so GitHub Pages can read it without exposing tokens.
 *
 * Required Google Sheet tabs:
 * - Settings
 * - Ingredients
 * - Products
 * - Recipes
 * - Orders
 * - OrderItems
 * - Customers
 */

const SPREADSHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';

function doGet(e) {
  try {
    const data = buildDashboardData_();
    const callback = e && e.parameter && e.parameter.callback;
    const json = JSON.stringify(data);

    if (callback) {
      return ContentService
        .createTextOutput(`${callback}(${json});`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    const callback = e && e.parameter && e.parameter.callback;
    const payload = JSON.stringify({ error: true, message: String(err) });
    return ContentService
      .createTextOutput(callback ? `${callback}(${payload});` : payload)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }
}

function buildDashboardData_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const settings = keyValueSheet_(ss, 'Settings');
  const ingredients = rows_(ss, 'Ingredients').map(row => ({
    name: clean_(row.Name),
    costPerUnit: number_(row.CostPerUnit),
    unit: clean_(row.Unit),
    stock: number_(row.Stock),
    reorderAt: number_(row.ReorderAt),
    shoppingUnit: clean_(row.ShoppingUnit)
  })).filter(x => x.name);

  const products = rows_(ss, 'Products').map(row => ({
    sku: clean_(row.SKU),
    name: clean_(row.Name),
    category: clean_(row.Category),
    salePrice: number_(row.SalePrice),
    yieldLabel: clean_(row.YieldLabel),
    batchYieldUnits: number_(row.BatchYieldUnits),
    unitLabel: clean_(row.UnitLabel),
    packagingCost: number_(row.PackagingCost),
    recipe: []
  })).filter(x => x.sku);

  const productMap = Object.fromEntries(products.map(p => [p.sku, p]));
  rows_(ss, 'Recipes').forEach(row => {
    const sku = clean_(row.ProductSKU);
    if (!productMap[sku]) return;
    productMap[sku].recipe.push({
      ingredient: clean_(row.Ingredient),
      amount: number_(row.Amount),
      unit: clean_(row.Unit)
    });
  });

  const orders = rows_(ss, 'Orders').map(row => ({
    id: clean_(row.OrderID),
    platform: clean_(row.Platform),
    customer: clean_(row.Customer),
    dueDate: dateString_(row.DueDate),
    pickupOrShip: clean_(row.PickupOrShip),
    status: clean_(row.Status),
    sourceUrl: clean_(row.SourceUrl),
    notes: clean_(row.Notes),
    items: []
  })).filter(x => x.id);

  const orderMap = Object.fromEntries(orders.map(o => [o.id, o]));
  rows_(ss, 'OrderItems').forEach(row => {
    const id = clean_(row.OrderID);
    const sku = clean_(row.SKU);
    const product = productMap[sku];
    if (!orderMap[id]) return;
    orderMap[id].items.push({
      sku,
      name: clean_(row.Name) || (product ? product.name : sku),
      qty: number_(row.Qty),
      unitPrice: number_(row.UnitPrice)
    });
  });

  const customers = rows_(ss, 'Customers').map(row => ({
    name: clean_(row.Name),
    orders: number_(row.Orders),
    lifetimeValue: number_(row.LifetimeValue),
    notes: clean_(row.Notes)
  })).filter(x => x.name);

  return {
    goal: {
      current: number_(settings.GoalCurrent || 0),
      target: number_(settings.GoalTarget || 75),
      label: settings.GoalLabel || 'Orders this month'
    },
    settings: {
      businessName: settings.BusinessName || "C-Dawg's Snack Shack",
      tagline: settings.Tagline || 'Cookies, Cowboy Candy & Island Vibes',
      currency: settings.Currency || 'USD'
    },
    orders,
    products,
    ingredients,
    customers,
    generatedAt: new Date().toISOString()
  };
}

function rows_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Missing sheet tab: ${sheetName}`);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1).filter(r => r.some(cell => cell !== '')).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function keyValueSheet_(ss, sheetName) {
  const out = {};
  rows_(ss, sheetName).forEach(row => {
    if (row.Key) out[String(row.Key).trim()] = row.Value;
  });
  return out;
}

function clean_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function number_(value) {
  if (value === null || value === undefined || value === '') return 0;
  return Number(String(value).replace(/[$,]/g, '')) || 0;
}

function dateString_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).slice(0, 10);
}
