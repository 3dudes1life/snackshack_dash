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
