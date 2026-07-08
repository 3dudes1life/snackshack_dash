# Data Model

## Orders

Required fields:

- `id`
- `platform` — `Square` or `Etsy`
- `customer`
- `dueDate`
- `pickupOrShip`
- `status`
- `notes`
- `items`

## Order Items

- `sku`
- `name`
- `qty`
- `unitPrice`

## Products

- `sku`
- `name`
- `category`
- `salePrice`
- `yieldLabel`
- `batchYieldUnits`
- `unitLabel`
- `packagingCost`
- `recipe`

## Recipe Lines

- `ingredient`
- `amount`
- `unit`

The ingredient name and unit must match the ingredient inventory list.

## Ingredients

- `name`
- `costPerUnit`
- `unit`
- `stock`
- `reorderAt`
- `shoppingUnit`

Example:

```js
{ name: "Sugar", costPerUnit: 0.18, unit: "cup", stock: 28, reorderAt: 12, shoppingUnit: "4 lb bag" }
```

## Customers

- `name`
- `orders`
- `lifetimeValue`
- `notes`
