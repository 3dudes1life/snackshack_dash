const SPREADSHEET_ID = "1rQnVZ7ZUJRQLYY3BMHlt7u_k4wYUcoE2sDhvSEwdwJw";

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

  return {
    status: "success",
    source: "Google Sheets",
    generatedAt: new Date().toISOString(),
    goal: { current: 18, target: 75, label: "Orders this month" },
    settings: {
      businessName: "C-Dawg's Snack Shack",
      tagline: "Cookies • Treats • Sourdough • Jams",
      currency: "USD"
    },
    ingredients,
    products,
    orders: [],
    customers: []
  };
}

function parseMasterIngredients_(sheet) {
  const values = sheet.getDataRange().getValues();
  const ingredients = [];

  values.forEach(row => {
    const name = clean_(row[7]); // "Cost of Ingredients" column from current workbook
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
