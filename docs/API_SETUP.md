# Square + Etsy API Setup Plan

## Important

Do **not** put Square or Etsy API tokens in frontend JavaScript on GitHub Pages.

Use this flow:

```text
Square API / Etsy API
        ↓
Google Apps Script, Cloudflare Worker, Netlify Function, or GitHub Action
        ↓
Sanitized JSON endpoint
        ↓
C-Dawg's dashboard frontend
```

## Square Data To Pull

Use Square for direct/local business:

- Orders
- Payments
- Customers
- Invoices
- Pickup notes
- Itemized products
- Taxes, tips, discounts, service charges

Suggested normalized fields:

```js
{
  id: "SQ-2201",
  platform: "Square",
  customer: "Customer Name",
  dueDate: "2026-07-08",
  pickupOrShip: "Pickup 4:00 PM",
  status: "New",
  notes: "Porch pickup",
  items: [
    { sku: "COOKIE-CHOC-DOZEN", name: "Chocolate Chip Cookies", qty: 2, unitPrice: 18 }
  ]
}
```

## Etsy Data To Pull

Use Etsy for online orders:

- Receipts/orders
- Buyer name
- Transaction line items
- Quantity
- Ship-by date
- Shipping address/state
- Fulfillment/shipped status
- Tracking if available

Suggested normalized fields match Square so both platforms merge into the same `orders` array.

## Google Apps Script Bridge Option

The DCW Grows dashboard already uses a Google Apps Script JSONP pattern. This dashboard can use the same idea.

Suggested actions:

- `?action=orders`
- `?action=stats`
- `?action=ingredients`
- `?action=customers`
- `?action=recipes`

## GitHub Actions Option

A scheduled GitHub Action can run every hour, call Square/Etsy APIs with encrypted repo secrets, and write a static JSON file into `/data/live-orders.json`.

Pros:

- No exposed API keys
- Dashboard stays static
- Cheap/free for small usage

Cons:

- Not real-time; usually hourly
- Commits data into repo unless configured carefully

## Recommended First Build

Start with:

1. Manual `sample-data.js`
2. Add products + true recipe costs
3. Connect Square
4. Connect Etsy
5. Add alerting later through email/SMS/push
