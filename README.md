# C-Dawg's Snack Shack Command Center — Cute Recipe Library

Upload these files to GitHub to replace the current dashboard.

## What changed
- Added built-in cook-mode recipe library from the uploaded recipe photos/docs.
- Added horizontal scroll for Cook Mode recipe cards.
- Added horizontal scroll for Recipe Cost cards.
- Made ingredient costs smaller/cuter as compact chips.
- Kept Google Sheet live costs through `data/config.js`.
- Added cache busting: `v=10-cute-final`.

## Upload/replace
- index.html
- src/app.js
- src/styles.css
- data/config.js
- data/recipe-library.js
- icon.svg
- manifest.webmanifest

## Important
Your current Apps Script backend can stay if it is already returning the recipe/cost JSON.


## v11 Scroll Fix

- Cook Mode recipe cards now use forced horizontal scrolling.
- Recipe Cost cards now use forced horizontal scrolling.
- Mouse wheel over those sections scrolls sideways.
- Click-and-drag works on desktop.
- Visible colored scrollbars were added.
- Ingredient cost area heading changed from “Cute Ingredient Cost Chips” to “Ingredient Cost Chips”.
