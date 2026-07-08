# Google Sheets Backend Setup

## 1. Create the Google Sheet

Create one Google Sheet with these tabs exactly:

- Settings
- Ingredients
- Products
- Recipes
- Orders
- OrderItems
- Customers

Use the CSV files in `/google-sheet-template/` as the column headers and starting data.

## 2. Add Apps Script

In the Google Sheet:

Extensions → Apps Script

Paste:

`backend/google-apps-script/Code.gs`

Replace:

```js
const SPREADSHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
```

with the Google Sheet ID from the sheet URL.

## 3. Deploy

Deploy → New Deployment → Web app

Use:

- Execute as: Me
- Who has access: Anyone with the link

Copy the Web App URL.

## 4. Connect dashboard

Open `data/config.js` and paste the URL:

```js
window.SNACKSHACK_API_URL = "https://script.google.com/macros/s/YOUR_ID/exec";
```

Now the GitHub Pages dashboard reads from the Google Sheet.

## Notes

Do not put Square or Etsy API tokens in GitHub. When Square/Etsy are added, keep tokens in Apps Script PropertiesService and have Apps Script merge those orders into the same `orders` array.
