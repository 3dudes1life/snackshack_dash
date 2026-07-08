const SPREADSHEET_ID = "1rQnVZ7ZUJRQLYY3BMHlt7u_k4wYUcoE2sDhvSEwdwJw";

/*
Required Apps Script Project Settings > Script Properties:
SQUARE_ACCESS_TOKEN = your Square production access token
SQUARE_LOCATION_ID = L0575AEJH49FF

After adding this code, run authorizeSquareFetch_ once in Apps Script editor
so Google grants UrlFetchApp permission.
*/

function authorizeSquareFetch_() {
  // Run this manually once from the Apps Script editor.
  // It forces Google to ask permission for UrlFetchApp external requests.
  const token = PropertiesService.getScriptProperties().getProperty("SQUARE_ACCESS_TOKEN");
  if (!token) throw new Error("Missing SQUARE_ACCESS_TOKEN in Script Properties.");

  UrlFetchApp.fetch("https://connect.squareup.com/v2/locations", {
    method: "get",
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + token,
      "Square-Version": "2025-06-18",
      "Content-Type": "application/json"
    }
  });
}


function testSquareConnection_() {
  const data = fetchSquareData_();
  Logger.log(JSON.stringify(data, null, 2));
  return data;
}

function doGet(e) {
  try {
    const data = buildCdawgRecipeData_();
    const callback = e && e.parameter && e.parameter.callback;
    const json = JSON.stringify(data);

    return ContentService
      .createTextOutput(callback ? `${callback}(${json});` : json)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);

  } catch (err) {
    const callback = e && e.parameter && e.parameter.callback;
    const payload = JSON.stringify({
      error: true,
      message: String(err),
      stack: err && err.stack ? err.stack : ""
    });

    return ContentService
      .createTextOutput(callback ? `${callback}(${payload});` : payload)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }
}

function buildCdawgRecipeData_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();

  const masterSheet = sheets.find(sheet =>
    sheet.getName().toLowerCase().includes("master")
  );

  const ingredients = masterSheet ? parseMasterIngredients_(masterSheet) : [];

  const recipeSheets = sheets.filter(sheet => {
    const name = sheet.getName().toLowerCase();
    return !name.includes("master") && !name.includes("sheet") && !name.includes("cost");
  });

  const products = recipeSheets
    .map(parseRecipeSheet_)
    .filter(recipe => recipe && recipe.name && recipe.recipe.length);

  const square = fetchSquareData_();

  return {
    status: "success",
    source: "Google Sheets + Square",
    generatedAt: new Date().toISOString(),
    goal: {
      current: square.orders.length + square.invoices.length,
      target: 75,
      label: "Orders + invoices this month"
    },
    settings: {
      businessName: "C-Dawg's Snack Shack",
      tagline: "Cookies • Treats • Sourdough • Jams",
      currency: "USD"
    },
    ingredients,
    products,
    orders: square.orders,
    customers: square.customers,
    squareInvoices: square.invoices,
    squareCatalog: square.catalog,
    squareInventory: square.inventory,
    squareStatus: square.status,
    squareMessage: square.message
  };
}

/* ---------------- SQUARE ---------------- */

function fetchSquareData_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty("SQUARE_ACCESS_TOKEN");
    const locationId = props.getProperty("SQUARE_LOCATION_ID") || "L0575AEJH49FF";

    if (!token) {
      return {
        status: "not_connected",
        message: "Square token missing from Script Properties.",
        orders: [],
        invoices: [],
        customers: [],
        catalog: [],
        inventory: []
      };
    }

    const catalog = fetchSquareCatalog_(token);
    const orders = fetchSquareOrders_(token, locationId);
    const invoices = fetchSquareInvoices_(token, locationId);

    return {
      status: "connected",
      message: "Square connected successfully.",
      orders,
      invoices,
      customers: [],
      catalog,
      inventory: []
    };

  } catch (err) {
    return {
      status: "error",
      message: String(err),
      orders: [],
      invoices: [],
      customers: [],
      catalog: [],
      inventory: []
    };
  }
}

function squareFetch_(endpoint, method, payload, token) {
  const url = "https://connect.squareup.com" + endpoint;

  const options = {
    method: method || "get",
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + token,
      "Square-Version": "2025-06-18",
      "Content-Type": "application/json"
    }
  };

  if (payload) options.payload = JSON.stringify(payload);

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  const text = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error("Square API error " + code + ": " + text);
  }

  return JSON.parse(text || "{}");
}

function fetchSquareCatalog_(token) {
  const data = squareFetch_(
    "/v2/catalog/list?types=ITEM,ITEM_VARIATION,CATEGORY",
    "get",
    null,
    token
  );

  const objects = data.objects || [];

  return objects.map(obj => {
    const item = obj.item_data || {};
    const variation = obj.item_variation_data || {};
    const priceMoney = variation.price_money || {};

    return {
      id: obj.id,
      type: obj.type,
      name: item.name || variation.name || "",
      description: item.description || "",
      categoryId: item.category_id || "",
      variationName: variation.name || "",
      price: priceMoney.amount ? priceMoney.amount / 100 : 0,
      currency: priceMoney.currency || "USD"
    };
  });
}

function fetchSquareOrders_(token, locationId) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const payload = {
    location_ids: [locationId],
    query: {
      filter: {
        date_time_filter: {
          created_at: {
            start_at: startDate.toISOString()
          }
        }
      },
      sort: {
        sort_field: "CREATED_AT",
        sort_order: "DESC"
      }
    },
    limit: 100
  };

  const data = squareFetch_("/v2/orders/search", "post", payload, token);
  const orders = data.orders || [];

  return orders.map(order => {
    const lineItems = order.line_items || [];

    return {
      id: order.id,
      source: "Square",
      status: order.state || "",
      createdAt: order.created_at || "",
      updatedAt: order.updated_at || "",
      total: order.total_money ? order.total_money.amount / 100 : 0,
      currency: order.total_money ? order.total_money.currency : "USD",
      customer: order.customer_id || "Square Customer",
      items: lineItems.map(item => ({
        name: item.name || "",
        quantity: Number(item.quantity || 1),
        variationName: item.variation_name || "",
        catalogObjectId: item.catalog_object_id || "",
        total: item.total_money ? item.total_money.amount / 100 : 0,
        modifiers: item.modifiers || []
      }))
    };
  });
}

function fetchSquareInvoices_(token, locationId) {
  const data = squareFetch_(
    "/v2/invoices/search",
    "post",
    {
      query: {
        filter: {
          location_ids: [locationId]
        },
        sort: {
          field: "INVOICE_SORT_DATE",
          order: "DESC"
        }
      },
      limit: 100
    },
    token
  );

  const invoices = data.invoices || [];

  return invoices.map(invoice => ({
    id: invoice.id,
    source: "Square Invoice",
    status: invoice.status || "",
    createdAt: invoice.created_at || "",
    updatedAt: invoice.updated_at || "",
    dueDate: invoice.payment_requests && invoice.payment_requests[0] ? invoice.payment_requests[0].due_date : "",
    total: invoice.computed_amount_money ? invoice.computed_amount_money.amount / 100 : 0,
    currency: invoice.computed_amount_money ? invoice.computed_amount_money.currency : "USD",
    customer: invoice.primary_recipient && invoice.primary_recipient.customer_id ? invoice.primary_recipient.customer_id : "Square Invoice Customer",
    title: invoice.title || "",
    description: invoice.description || "",
    items: [
      {
        name: invoice.title || invoice.description || "Invoice item",
        quantity: 1,
        variationName: "",
        catalogObjectId: "",
        total: invoice.computed_amount_money ? invoice.computed_amount_money.amount / 100 : 0
      }
    ]
  }));
}

/* ---------------- GOOGLE SHEET PARSING ---------------- */

function parseMasterIngredients_(sheet) {
  const values = sheet.getDataRange().getValues();
  const ingredients = [];

  values.forEach(row => {
    const name = clean_(row[7]);
    if (!name || name === "Cost of Ingredients") return;

    ingredients.push({
      name,
      price: number_(row[8]),
      packageSize: clean_(row[9]),
      perSize: number_(row[10]),
      packageUnit: clean_(row[11]),
      recipeUnit: clean_(row[12]),
      unitsPerSize: number_(row[13]),
      costPerUnit: number_(row[14]),
      unit: clean_(row[12]),
      stock: 0,
      reorderAt: 0,
      shoppingUnit: clean_(row[9])
    });
  });

  return ingredients;
}

function parseRecipeSheet_(sheet) {
  const values = sheet.getDataRange().getValues();
  const name = sheet.getName();

  let headerRowIndex = -1;

  for (let i = 0; i < values.length; i++) {
    const first = clean_(values[i][0]).toLowerCase();
    const second = clean_(values[i][1]).toLowerCase();

    if (first === "ingredients" && second.includes("base")) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return null;

  const header = values[headerRowIndex];

  const yieldCount = number_(header[6]);
  const yieldUnit = clean_(header[7]) || "Cookies";

  let batches = 1;
  let totalBatchCost = 0;
  let costPerCookie = 0;

  const recipeLines = [];

  for (let i = headerRowIndex + 1; i < values.length; i++) {
    const row = values[i];

    const ingredient = clean_(row[0]);
    const baseAmount = row[1];
    const unit = clean_(row[2]);
    const amountNeeded = row[3];
    const ingredientCost = row[4];
    const label = clean_(row[5]).toLowerCase();

    if (label === "batch") batches = number_(row[6]) || 1;
    if (label === "total batch cost") totalBatchCost = number_(row[6]);
    if (label === "cost per cookie") costPerCookie = number_(row[6]);

    if (!ingredient || ingredient.toLowerCase() === "ingredients") continue;
    if (ingredient.toLowerCase().includes("optional") && !number_(amountNeeded)) continue;

    recipeLines.push({
      ingredient,
      baseAmount: number_(baseAmount),
      amount: number_(amountNeeded),
      unit,
      ingredientCost: number_(ingredientCost)
    });
  }

  return {
    sku: slug_(name),
    name,
    category: "Cookies",
    salePrice: 0,
    yieldLabel: `${yieldCount} ${yieldUnit}`,
    batchYieldUnits: yieldCount,
    unitLabel: yieldUnit,
    batches,
    totalBatchCost,
    costPerCookie,
    costPerDozen: costPerCookie * 12,
    packagingCost: 0,
    recipe: recipeLines
  };
}

function clean_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function number_(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[$,]/g, "").trim();
  return Number(cleaned) || 0;
}

function slug_(value) {
  return clean_(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
