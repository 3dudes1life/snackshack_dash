# C-Dawg's Snack Shack Command Center — Recipe First

This version fixes the weird dashboard issue by matching the UI to the live Google Sheet data that is actually coming back from Apps Script.

## What changed

- Recipe costing is now the main dashboard story.
- Overview cards show recipes loaded, ingredient costs loaded, planned cookies, planned cost, average cost per cookie, and recipes needing cleanup.
- Recipe cards use the workbook fields already returned by the backend:
  - `batches`
  - `totalBatchCost`
  - `costPerCookie`
  - `costPerDozen`
  - `yieldLabel`
  - ingredient line costs
- Ingredient section is now an ingredient cost library instead of fake inventory stock.
- Caleb Queue now shows useful costing warnings instead of “no chaos” while orders are not connected.
- Square/Etsy order hub stays in place but now clearly says Phase 2 until those APIs are wired.

## Live backend

The dashboard is already pointed at the deployed Google Apps Script URL in `data/config.js`.

```js
window.SNACKSHACK_API_URL = "https://script.google.com/macros/s/AKfycbx2t2eP2ZTpcwd6bp3L3bJJBqBdxitN2Bs_2kvGxW0h2_bljZd5_jU3wZQ3cPFjURxS0g/exec";
```

## Upload to GitHub

Upload/replace these files in the repo:

- `index.html`
- `src/app.js`
- `src/styles-compact.css`
- `data/config.js`

Then hard refresh the dashboard URL.
