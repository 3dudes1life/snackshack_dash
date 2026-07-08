const dashboardData = {
  goal: { current: 18, target: 75, label: "Orders this month" },
  settings: {
    businessName: "C-Dawg's Snack Shack",
    tagline: "Cookies, Cowboy Candy & Island Vibes",
    currency: "USD"
  },
  orders: [
    {
      id: "ETSY-1042",
      platform: "Etsy",
      customer: "Megan R.",
      dueDate: "2026-07-10",
      pickupOrShip: "Ship",
      status: "New",
      sourceUrl: "",
      notes: "Gift order. Include thank-you card.",
      items: [{ sku: "COOKIE-CHOC-DOZEN", name: "Chocolate Chip Cookies", qty: 2, unitPrice: 18 }]
    },
    {
      id: "SQ-2201",
      platform: "Square",
      customer: "Tina M.",
      dueDate: "2026-07-08",
      pickupOrShip: "Pickup 4:00 PM",
      status: "Baking",
      sourceUrl: "",
      notes: "Porch pickup. Text when ready.",
      items: [{ sku: "COOKIE-SUGAR-DOZEN", name: "Sugar Sprinkle Cookies", qty: 1, unitPrice: 16 }]
    },
    {
      id: "SQ-2202",
      platform: "Square",
      customer: "Daniel C.",
      dueDate: "2026-07-09",
      pickupOrShip: "Pickup 2:30 PM",
      status: "Ready",
      sourceUrl: "",
      notes: "Cowboy candy, mild heat.",
      items: [{ sku: "COWBOY-CANDY-8OZ", name: "Cowboy Candy", qty: 3, unitPrice: 12 }]
    },
    {
      id: "ETSY-1043",
      platform: "Etsy",
      customer: "Alex P.",
      dueDate: "2026-07-11",
      pickupOrShip: "Ship",
      status: "New",
      sourceUrl: "",
      notes: "Repeat customer. Loves molasses cookies.",
      items: [{ sku: "COOKIE-MOLASSES-DOZEN", name: "Molasses Cookies", qty: 1, unitPrice: 17 }]
    }
  ],
  products: [
    {
      sku: "COOKIE-CHOC-DOZEN",
      name: "Chocolate Chip Cookies",
      category: "Cookies",
      salePrice: 18,
      yieldLabel: "1 dozen",
      batchYieldUnits: 24,
      unitLabel: "cookie",
      packagingCost: 0.65,
      recipe: [
        { ingredient: "Flour", amount: 2.25, unit: "cup" },
        { ingredient: "Sugar", amount: 0.75, unit: "cup" },
        { ingredient: "Brown Sugar", amount: 0.75, unit: "cup" },
        { ingredient: "Butter", amount: 1, unit: "cup" },
        { ingredient: "Eggs", amount: 2, unit: "each" },
        { ingredient: "Chocolate Chips", amount: 2, unit: "cup" }
      ]
    },
    {
      sku: "COOKIE-SUGAR-DOZEN",
      name: "Sugar Sprinkle Cookies",
      category: "Cookies",
      salePrice: 16,
      yieldLabel: "1 dozen",
      batchYieldUnits: 24,
      unitLabel: "cookie",
      packagingCost: 0.65,
      recipe: [
        { ingredient: "Flour", amount: 2.75, unit: "cup" },
        { ingredient: "Sugar", amount: 1.25, unit: "cup" },
        { ingredient: "Butter", amount: 1, unit: "cup" },
        { ingredient: "Eggs", amount: 1, unit: "each" },
        { ingredient: "Sprinkles", amount: 0.5, unit: "cup" }
      ]
    },
    {
      sku: "COOKIE-MOLASSES-DOZEN",
      name: "Molasses Cookies",
      category: "Cookies",
      salePrice: 17,
      yieldLabel: "1 dozen",
      batchYieldUnits: 24,
      unitLabel: "cookie",
      packagingCost: 0.65,
      recipe: [
        { ingredient: "Flour", amount: 2.25, unit: "cup" },
        { ingredient: "Sugar", amount: 1, unit: "cup" },
        { ingredient: "Butter", amount: 0.75, unit: "cup" },
        { ingredient: "Eggs", amount: 1, unit: "each" },
        { ingredient: "Molasses", amount: 0.25, unit: "cup" }
      ]
    },
    {
      sku: "COWBOY-CANDY-8OZ",
      name: "Cowboy Candy",
      category: "Pantry",
      salePrice: 12,
      yieldLabel: "8 oz jar",
      batchYieldUnits: 6,
      unitLabel: "jar",
      packagingCost: 1.2,
      recipe: [
        { ingredient: "Jalapeños", amount: 3, unit: "lb" },
        { ingredient: "Sugar", amount: 4, unit: "cup" },
        { ingredient: "Apple Cider Vinegar", amount: 2, unit: "cup" },
        { ingredient: "Jars + Lids", amount: 6, unit: "each" }
      ]
    }
  ],
  ingredients: [
    { name: "Flour", costPerUnit: 0.12, unit: "cup", stock: 45, reorderAt: 15, shoppingUnit: "5 lb bag" },
    { name: "Sugar", costPerUnit: 0.18, unit: "cup", stock: 28, reorderAt: 12, shoppingUnit: "4 lb bag" },
    { name: "Brown Sugar", costPerUnit: 0.22, unit: "cup", stock: 10, reorderAt: 8, shoppingUnit: "2 lb bag" },
    { name: "Butter", costPerUnit: 1.15, unit: "cup", stock: 7, reorderAt: 4, shoppingUnit: "1 lb box" },
    { name: "Eggs", costPerUnit: 0.31, unit: "each", stock: 18, reorderAt: 12, shoppingUnit: "dozen" },
    { name: "Chocolate Chips", costPerUnit: 0.75, unit: "cup", stock: 8, reorderAt: 4, shoppingUnit: "bag" },
    { name: "Sprinkles", costPerUnit: 0.55, unit: "cup", stock: 2, reorderAt: 2, shoppingUnit: "jar" },
    { name: "Molasses", costPerUnit: 0.95, unit: "cup", stock: 2, reorderAt: 1, shoppingUnit: "bottle" },
    { name: "Jalapeños", costPerUnit: 1.65, unit: "lb", stock: 4, reorderAt: 3, shoppingUnit: "lb" },
    { name: "Apple Cider Vinegar", costPerUnit: 0.75, unit: "cup", stock: 8, reorderAt: 3, shoppingUnit: "bottle" },
    { name: "Jars + Lids", costPerUnit: 0.72, unit: "each", stock: 24, reorderAt: 12, shoppingUnit: "case" }
  ],
  customers: [
    { name: "Alex P.", orders: 5, lifetimeValue: 162, notes: "Molasses fan. Ships to CA." },
    { name: "Tina M.", orders: 3, lifetimeValue: 84, notes: "Local pickup. Text when ready." },
    { name: "Megan R.", orders: 2, lifetimeValue: 72, notes: "Gift orders." }
  ]
};
