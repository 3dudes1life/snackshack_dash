# C-Dawg's Snack Shack Command Center — Live Sheet Fix

This ZIP fixes the broken/fallback dashboard problem.

## What was wrong

The GitHub dashboard still had old demo data with only 4 products:
Chocolate Chip, Sugar Sprinkle, Molasses, and Cowboy Candy.

This version removes that silent fallback behavior. If the live Google Sheet backend fails, the dashboard now shows a clear backend error instead of pretending the 4 demo products are real.

## Files to upload to GitHub

Replace the current files with these:

- `index.html`
- `src/app.js`
- `src/styles.css`
- `data/config.js`
- `manifest.webmanifest`
- `icon.svg`

Optional but recommended:

- `backend/google-apps-script/Code.gs`

## Current backend URL

`data/config.js` already points to:

https://script.google.com/macros/s/AKfycbx2t2eP2ZTpcwd6bp3L3bJJBqBdxitN2Bs_2kvGxW0h2_bljZd5_jU3wZQ3cPFjURxS0g/exec

## Apps Script

Your Apps Script should contain the code in:

`backend/google-apps-script/Code.gs`

After replacing Apps Script code:

1. Save
2. Deploy
3. Manage deployments
4. Edit pencil
5. Version: New version
6. Deploy

## GitHub Pages cache fix

`index.html` now loads all files with:

`?v=8-live-sheet-fix`

That forces Safari/Chrome/GitHub Pages to stop using stale old dashboard files.

## Expected result

The dashboard should show around:

- 13 recipes loaded
- 40+ ingredient costs loaded
- Recipe cards for all cookie sheets
- Batch cost
- Cost per cookie
- Cost per dozen
- Cleanup queue for recipes showing $0

## Next phase

Add a price/sell-price tab so the dashboard can calculate true profit and margin.
Right now it is intentionally focused on recipe cost first.
