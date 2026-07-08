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
