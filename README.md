# 🍪 C-Dawg's Snack Shack Command Center

A ready-to-edit GitHub Pages dashboard for C-Dawg's Snack Shack.

Built for:

- Square + Etsy order visibility
- Caleb's daily baking queue
- Recipe and ingredient costing
- Profit per product and per order
- Pickup/shipping tracking
- Ingredient shopping forecasts
- Cottage food production workflow

## Quick Start

1. Upload this folder to a new GitHub repo, for example:
   `3dudes1life/cdawgs-snackshack-commandcenter`
2. Turn on GitHub Pages from the repo settings.
3. Open `data/sample-data.js` and replace the sample products/orders/ingredients.
4. When ready for live data, connect Square + Etsy through a backend bridge.

## Local Preview

```bash
npm run start
```

Then open:

```text
http://localhost:5173
```

## Data Files

- `data/sample-data.js` — current demo data used by dashboard
- `docs/API_SETUP.md` — Square + Etsy connection plan
- `docs/DATA_MODEL.md` — fields needed for orders, products, recipes, ingredients
- `docs/CALEB_WORKFLOW.md` — recommended daily workflow

## Live API Strategy

This static dashboard can run safely on GitHub Pages if secret API keys are not stored in the frontend.

Recommended flow:

Square/Etsy APIs → Google Apps Script or serverless function → sanitized JSON → dashboard

Do not put Square or Etsy tokens directly inside frontend JavaScript.


## No-Dots Build
This package intentionally removes all sprinkle and dot background layers. The dashboard now loads `src/styles-no-dots.css?v=3-no-dots` so browsers do not reuse the older cached `src/styles.css`.


## Website Vibe Build
This version is restyled to match the live C-Dawg's Snack Shack site: cream background, faded palm silhouettes, teal headings, coral shop-style buttons, rounded treat cards, and no dot/sprinkle background. It loads `src/styles-website-vibe.css?v=4-website-vibe-no-dots` to bypass cached dashboard CSS.
