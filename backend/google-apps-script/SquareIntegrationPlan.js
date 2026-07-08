/*
Snack IQ 4.0 Square Integration Plan

This dashboard is ready to consume orders in this normalized shape:

{
  orders: [
    {
      id: "SQ-123",
      source: "Square",
      customer: "Customer Name",
      due: "2026-07-10T15:00:00",
      status: "OPEN",
      total: 48.00,
      items: [
        { name: "Red Velvet Cookies", quantity: 2, modifiers: [] }
      ]
    }
  ]
}

When you connect Square:
1. Use Apps Script or a small serverless function as the secure backend.
2. Store Square access token server-side only.
3. Fetch Square Orders API / Payments API.
4. Normalize line items into the shape above.
5. Return them with the existing Google Sheet recipe/cost JSON.
6. Snack IQ 4.0 will match line items to recipes and calculate:
   - batches needed
   - production gaps
   - ingredient totals
   - order cleanup warnings
   - top next actions
*/
