# C-Dawg's Snack Shack Command Center

Compact GitHub Pages dashboard for Caleb's bakery workflow.

## What changed in this version

- Removed the giant hero/header waste of space.
- Dashboard now opens directly to Caleb's action view.
- Kept the live website vibe: cream background, teal headings, coral buttons, faded palm silhouettes.
- Added Google Sheet ingredient-cost backend starter.
- Added cost column in the order hub.
- Built live-data support through Google Apps Script JSONP.

## Files

- `index.html` — dashboard page
- `src/styles-compact.css` — compact website-vibe styling
- `src/app.js` — dashboard logic and optional live backend loader
- `data/sample-data.js` — demo data
- `data/config.js` — paste your Google Apps Script web app URL here
- `backend/google-apps-script/Code.gs` — Apps Script backend
- `google-sheet-template/*.csv` — tabs to create/import into Google Sheets

## Fast setup

1. Upload these files to the GitHub Pages repo.
2. Confirm the page works with sample data.
3. Create a Google Sheet with tabs matching the CSV files in `google-sheet-template`.
4. Open Apps Script and paste `backend/google-apps-script/Code.gs`.
5. Put your Google Sheet ID into `SPREADSHEET_ID`.
6. Deploy as Web App.
7. Paste the Web App URL into `data/config.js`:

```js
window.SNACKSHACK_API_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

## Ingredient costing

The dashboard calculates product and order profit from:

- Products tab: sale price, yield, packaging cost
- Ingredients tab: cost per unit, stock, reorder level
- Recipes tab: ingredient amount per product
- Orders + OrderItems tabs: open orders and quantities

This lets Caleb update sugar/flour/butter costs in Google Sheets and the dashboard recalculates profit without touching code.
