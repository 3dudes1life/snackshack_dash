const SPREADSHEET_ID = "1rQnVZ7ZUJRQLYY3BMHlt7u_k4wYUcoE2sDhvSEwdwJw";

/*
Required Apps Script Project Settings > Script Properties:

SQUARE_ACCESS_TOKEN = your Square production access token
SQUARE_LOCATION_ID = L0575AEJH49FF

Never put the token in GitHub Pages.
*/

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
      current: square.orders.length,
      target: 75,
      label: "Orders this month"
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
    squareCatalog: square.catalog,
    squareInventory: square.inventory,
    squareStatus: square.status,
    squareMessage: square.message
  };
}

/* Square helpers */
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
        customers: [],
        catalog: [],
        inventory: []
      };
    }

    const catalog = fetchSquareCatalog_(token);
    const orders = fetchSquareOrders_(token, locationId);

    return {
      status: "connected",
      message: "Square connected successfully.",
      orders,
      customers: [],
      catalog,
      inventory: []
    };

  } catch (err) {
    return {
      status: "error",
      message: String(err),
      orders: [],
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

/* Existing Google Sheet parsing functions remain in Apps Script. */
