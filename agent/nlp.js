const patterns = [
  // Dashboard / overview
  { match: /dashboard|overview|summary|how.*(doing|business|today)/i, action: 'dashboard' },
  { match: /sales.*(today|summary|this week|this month)|today.*sales|how much.*sell/i, action: 'sales_today' },

  // Products
  { match: /products|inventory|list.*product|show.*product|what.*stock/i, action: 'products_list' },
  { match: /low.?stock|running.?out|need.?reorder|reorder/i, action: 'low_stock' },
  { match: /add.*product|new.*product|create.*product|insert.*product/i, action: 'product_create' },
  { match: /update.*product|edit.*product|change.*price/i, action: 'product_update' },
  { match: /delete.*product|remove.*product/i, action: 'product_delete' },
  { match: /adjust.*stock|stock.*adjust|add.*stock|reduce.*stock/i, action: 'stock_adjust' },
  { match: /categories|category/i, action: 'categories' },

  // Sales
  { match: /sales|invoices|transactions|receipts/i, action: 'sales_list' },
  { match: /return|refund/i, action: 'return' },

  // Customers
  { match: /customers|clients|who.*bought/i, action: 'customers_list' },
  { match: /add.*customer|new.*customer|create.*customer/i, action: 'customer_create' },
  { match: /credit|balance|owing|debt|outstanding/i, action: 'customers_credit' },

  // Suppliers
  { match: /suppliers|vendors|supplier/i, action: 'suppliers_list' },
  { match: /add.*supplier|new.*supplier|create.*supplier/i, action: 'supplier_create' },

  // Purchases
  { match: /purchase|order|restock|procurement/i, action: 'purchases_list' },
  { match: /receive.*goods|received.*delivery|confirm.*delivery/i, action: 'purchase_receive' },

  // Reports
  { match: /profit|margin|profitability|earnings/i, action: 'profit_report' },
  { match: /report|analytics|stats/i, action: 'reports_menu' },

  // Shifts
  { match: /shift|cashier.*shift|open.*shift|close.*shift/i, action: 'shifts' },
  { match: /start.*shift|open.*shift|begin.*shift/i, action: 'shift_start' },
  { match: /close.*shift|end.*shift/i, action: 'shift_close' },

  // Users
  { match: /users|employees|staff|team|accounts/i, action: 'users_list' },
  { match: /add.*user|new.*user|create.*account|hire/i, action: 'user_create' },

  // Audit
  { match: /audit|log|history|activity|events/i, action: 'audit_log' },

  // Help
  { match: /help|commands|what.*can.*do|capabilities|features/i, action: 'help' },
];

function parseNaturalLanguage(input) {
  const trimmed = input.trim();
  for (const p of patterns) {
    if (p.match.test(trimmed)) {
      return { action: p.action, raw: trimmed };
    }
  }
  return { action: 'unknown', raw: trimmed };
}

module.exports = { parseNaturalLanguage };
