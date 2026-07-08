# C-Dawg's Snack Shack Command Center — V3 Pro Rebuild

This is the full layout rebuild.

## What changed

- Removed all horizontal scrolling.
- Replaced giant card wall with a professional recipe workspace.
- Cook Mode now has a recipe list + recipe detail panel.
- Costed Recipes now use compact responsive cards.
- Ingredient Costs now use compact chips.
- Mobile/tablet/desktop layouts are responsive.
- Sidebar collapses to a top nav on smaller screens.
- Cache-busted as `v=13-pro-rebuild`.

## Upload to GitHub

Replace these files:

- `index.html`
- `src/app.js`
- `src/styles.css`
- `data/recipe-library.js`
- `data/config.js`
- `icon.svg`
- `manifest.webmanifest`

Your current Apps Script can stay if it is already returning Google Sheet JSON.


## v14 Batch Controls

- Added + / − batch controls in Cook Mode.
- Added + / − batch controls on every Recipe Cost card.
- Batch counts are saved in the browser with localStorage.
- Production cost recalculates instantly.
- Overview totals update instantly.
- Does not require Google Sheet edits.


## v15 Snack IQ Brain

Adds a rule-based AI-style brain:
- Production cost summary
- Batch-aware ingredient totals
- Smart cleanup warnings
- Expensive recipe warnings
- Best-value recipe callouts
- Smart shopping/prep list
- Uses current batch controls
- Still works without paid AI/API keys


## v16 Smart Linking

Fixes recipe linking between the built-in recipe library and Google Sheet products.

The old matcher only handled exact-ish name/alias matches. This version adds:
- typo normalization (`Chocoloate` → `Chocolate`)
- abbreviation normalization (`Choc.` → `Chocolate`)
- generic word removal (`cookies`, `treats`, `recipe`, etc.)
- manual match map for Chocolate Chip, Rice Krispie Treats, Blackberry Jam, etc.
- token-score fuzzy matching

This should link recipes that are already in Google Sheets but had slightly different names.


## v17 Snack IQ 4.0

Adds a Square-ready production brain.

### What it can do now
- Understand current recipe batch controls.
- Calculate production cost.
- Calculate top ingredients needed.
- Warn about missing recipe/cost links.
- Identify expensive and low-cost recipes.
- Prepare for incoming Square/Etsy/manual orders.

### What it will do when Square is integrated
If the backend returns an `orders` or `squareOrders` array, Snack IQ 4.0 will:
- normalize orders
- read customer/source/due date/status
- read line items and quantities
- match order items to recipes
- calculate batches needed
- compare order demand to planned batches
- warn Caleb when batches are too low
- create a Square-ready production plan
- build shopping/prep needs from real orders

### Security note
Do not put Square access tokens in GitHub Pages. Square keys must live in Apps Script, Cloudflare Worker, Netlify Function, or another secure backend.


## v18 Kitchen / Production Split

This version separates the two workflows:

### Cook Mode
- No accounting clutter.
- No cost per cookie.
- No cost per dozen.
- No cleanup flags.
- Batch controls only.
- Ingredients scale by selected batches.
- Steps stay clean.

### Production Costs
- Business/planning only.
- Batch controls.
- Production yield.
- Production cost.
- Editable sell price.
- Estimated revenue.
- Estimated profit.
- Margin.

### Snack IQ Brain
- Reads selected batches.
- Builds smart prep/shopping list.
- Summarizes production cost, revenue, and profit.
- Keeps cleanup recommendations separate from kitchen instructions.


## v19 Scaled Recipes

Cook Mode now scales ingredient amounts when Caleb changes the batch count.

Improved scaler handles:
- Google Sheet numeric recipe rows
- photo/baked recipe text fallback
- fractions like `1/2`, `2/3`, `3/4`
- mixed numbers like `1 1/2`
- phrases like `2 and 3/4`
- multiple amounts in one line like `1 cup + 2 tbsp`

Costs stay in Production Costs. Cook Mode stays focused on baking.


## v20 Production Planner Final

Fixes:
- Batch count can now be 0.
- Default production batch count is 0 so Caleb only adds what he is actually making.
- Batch 0 recipes do not contribute to production cost, projected yield, or Smart Prep ingredients.
- Added planner buttons:
  - Set all batches to 0
  - Set costed recipes to 1
- Improved Google Sheet recipe matching for:
  - Red Velvet
  - Nanny Pound Cake
  - Chocolate Chip
  - Rice Krispie Treats
  - Blackberry Jam
  - typo/abbreviation variants
- Added ingredient-signature fallback matching when names are messy.


## v22 True Separated Batches

This fixes the sync issue for real.

### Separate localStorage keys
- `cdawgKitchenBatchState`
- `cdawgProductionBatchState`

### Kitchen Recipe Workspace
- Uses `kitchenBatches(recipe)`.
- Minimum batch is 1.
- Only scales the recipe currently being cooked.
- Does not affect Production Planner.
- Does not affect Smart Prep.

### Production Planner
- Uses `selectedBatches(recipe)` from production state only.
- Minimum batch is 0.
- Drives:
  - production cost
  - production yield
  - projected revenue
  - projected profit
  - Ingredients Needed for Production Planner Batches

### Important
Old shared `cdawgBatchState` is migrated into Production Planner only, never Kitchen.


## v23 Brain 5.0

Adds bakery business intelligence:

- Profit Margin %
- ROI %
- Average Profit Per Dozen
- Total planned yield
- Revenue / cost / profit summary
- Low-margin recipe warnings
- Negative-profit recipe warnings
- Best-margin recipe callout
- Best profit-driver callout
- Square-ready recommendation language

Formulas:
- Profit Margin = Profit / Revenue
- ROI = Profit / Production Cost
- Avg Profit Per Dozen = Profit / Projected Dozens

Still respects the separated batch system:
- Kitchen batches only scale the visible recipe.
- Production Planner batches drive Brain 5.0, profit, margin, ROI, and Smart Prep.


## v24 Dual Pricing Brain 5.5

Adds separate pricing layers:

### Recipe Cost
Still comes from Google Sheets recipe + ingredient costs.

### Corporate DZ Pricing
Used for corporate / bulk dozen orders.

### Square Retail Pricing
Used for Square retail / market / pop-up pricing.
Supports:
- Square DZ price
- Square each price

### Brain 5.5 adds
- Active pricing mode per recipe
- Corporate profit/margin
- Square DZ profit/margin
- Square each profit/margin
- Suggested dozen price for target margin
- Underpriced corporate warnings
- Best pricing channel recommendation

Important:
Square catalog pricing should be treated as sales/catalog data, not the only pricing authority.
Google Sheets can remain the strategic pricing authority.


## v25 Brain 6.0

This version keeps everything from Dual Pricing Brain 5.5 and moves the AI Brain to the top of the dashboard.

Included:
- Brain 6.0 section at the top, before recipe/workspace sections
- Corporate DZ pricing layer
- Square DZ pricing layer
- Square Each pricing layer
- Active pricing mode per recipe
- Corporate vs Square margin comparison
- ROI
- Profit per dozen
- Suggested dozen price for target margin
- Smart Prep ingredients from Production Planner batches only
- Kitchen batches remain separate from Production Planner batches
- Square-ready logic without storing Square tokens in GitHub Pages

Recommended upload:
Replace the entire GitHub Pages folder contents with this ZIP contents.


## v26 Brain 6.0 Order Hub

Adds Square order handling to the GitHub dashboard.

### New Order Hub
- Shows Square connection status.
- Shows open/pending Square orders.
- Shows open revenue.
- Shows 30-day Square order total.
- Shows production demand from pending/open Square line items.
- Attempts to match Square line items to recipe/product names.
- Flags unmatched Square items so aliases can be cleaned up.

### Brain 6.0 updates
- Adds open Square orders into AI recommendations.
- Adds top order demand into AI recommendations.
- Keeps Corporate DZ vs Square Retail pricing separate.
- Keeps Kitchen Recipe Workspace batches separate from Production Planner batches.
- Smart Prep still uses only Production Planner batches.

### Backend
A reference Apps Script file is included at:

`backend/google-apps-script/Code.gs`

The Square token must stay in Apps Script Script Properties, never in GitHub.


## v27 Brain 6.0 Invoice Hub

Fixes:
- Adds Square invoices to Order Hub.
- Pending invoices count as open Square work.
- Open value now includes open orders + unpaid/open invoices.
- Brain 6.0 recommendations now mention open invoices.
- Backend reference includes `fetchSquareInvoices_`.
- Backend reference includes `authorizeSquareFetch_` to force Apps Script OAuth authorization for UrlFetchApp.

Important:
If the dashboard shows `You do not have permission to call UrlFetchApp.fetch`, open Apps Script, select `authorizeSquareFetch_`, click Run, approve permissions, then Deploy > Manage deployments > Edit > New version > Deploy.


## v28 Square Auth + PNG Logo Fix

Fixes:
- Adds real PNG logo at `assets/cdawg-logo.png`.
- Adds favicon at `assets/favicon.png`.
- Patches dashboard logo references to use the PNG file.
- Adds friendlier Square authorization warning.
- Invoice title/description now becomes a fallback invoice item for production demand.
- Backend includes `authorizeSquareFetch_`.
- Backend includes `testSquareConnection_`.
- Backend includes `appsscript.json` with explicit UrlFetchApp scope.

If Apps Script does not ask for permissions:
- Turn on the manifest file in Apps Script project settings.
- Paste `backend/google-apps-script/appsscript.json`.
- Save.
- Select `authorizeSquareFetch_` from the function dropdown.
- Click Run from inside Apps Script, not from the web app URL.


## v29 Brain 7.0

Adds the real uploaded C-Dawg logo and upgrades Brain into a daily action brain.

### Logo
- Uses the uploaded `CDawgs SnackShack copy.jpeg`.
- Saves it as:
  - `assets/cdawg-logo.png`
  - `assets/favicon.png`
  - `assets/apple-touch-icon.png`
- Fixes the broken double-quote logo path from the live GitHub file.

### Brain 7.0
- Adds Caleb’s Today List.
- Calculates open Square value from orders + invoices.
- Calculates estimated production cost from live Square demand.
- Calculates estimated order profit + margin from live Square demand.
- Shows top bake-first items.
- Shows unmatched Square items that need alias cleanup.
- Builds Smart Prep pull list from live Square demand.
- Adds “Send Square demand to Production Planner” button.
- Keeps manual Production Planner separate until Caleb chooses to send demand over.
- Keeps Kitchen Recipe Workspace batch counts separate.

Upload this ZIP over the GitHub Pages files.


## v30 Real Uploaded Logo Fix

This ZIP uses the actual uploaded logo file:

- `assets/cdawgs-snackshack-uploaded-logo.jpeg` ← visible dashboard logo
- `assets/cdawg-logo.png` ← PNG version from the uploaded logo
- `assets/favicon.png`
- `assets/apple-touch-icon.png`

The old/generated generic logo and `icon.svg` fallback were removed.
See `LOGO_PROOF.json`.


## v41 Brain 8.0 Safe Layout

This version fixes the broken raw-HTML layout by rebuilding from the last styled working dashboard line.

Included:
- Original styled dashboard layout preserved.
- Brain 8.0 labels.
- Live Sync panel.
- Auto-refresh every 60 seconds.
- Cache-busted Apps Script calls so Square + Google Sheets refresh fresh.
- Refresh button pulls live data instead of hard reloading.
- ERP cards for profit health, production queue, and Square name cleanup.
- Real uploaded logo remains.
- Normal favicon files only, no embedded base64 favicon.


## v60 Restored App

This build completely replaces the corrupted `src/app.js`.

The live GitHub app was stuck on loading because app.js had invalid JavaScript from a bad text replacement. This ZIP restores a clean rebuilt app while preserving the styled dashboard layout.

Includes:
- Clean app.js with syntax check.
- Brain 8.0.
- Square Order + Invoice Hub.
- Production Demand.
- Send Demand to Production Planner.
- Live sync on load, focus, refresh, and every 60 seconds.
- Real uploaded logo.
- Normal favicon files.
