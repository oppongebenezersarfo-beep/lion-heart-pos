-- Lion Heart Hardware POS - SQLite Schema

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
    pin TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_id TEXT REFERENCES categories(id),
    supplier_id TEXT REFERENCES suppliers(id),
    unit_of_measure TEXT NOT NULL DEFAULT 'piece',
    cost_price REAL NOT NULL CHECK (cost_price >= 0),
    selling_price REAL NOT NULL CHECK (selling_price >= 0),
    current_stock REAL DEFAULT 0 CHECK (current_stock >= 0),
    reorder_level REAL DEFAULT 0 CHECK (reorder_level >= 0),
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    credit_limit REAL DEFAULT 0 CHECK (credit_limit >= 0),
    credit_terms_days INTEGER DEFAULT 30,
    outstanding_balance REAL DEFAULT 0,
    is_credit_approved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    invoice_number TEXT UNIQUE NOT NULL,
    cashier_id TEXT NOT NULL REFERENCES users(id),
    customer_id TEXT REFERENCES customers(id),
    subtotal REAL NOT NULL CHECK (subtotal >= 0),
    discount_amount REAL DEFAULT 0 CHECK (discount_amount >= 0),
    total REAL NOT NULL CHECK (total >= 0),
    payment_method TEXT NOT NULL,
    payment_details TEXT,
    status TEXT DEFAULT 'completed',
    is_offline_sale INTEGER DEFAULT 0,
    offline_queue_id TEXT,
    synced_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL CHECK (unit_price >= 0),
    discount REAL DEFAULT 0 CHECK (discount >= 0),
    total REAL NOT NULL CHECK (total >= 0),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    product_id TEXT NOT NULL REFERENCES products(id),
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    reference_id TEXT,
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_number TEXT UNIQUE NOT NULL,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id),
    status TEXT DEFAULT 'pending',
    total REAL DEFAULT 0,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    received_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL CHECK (quantity > 0),
    unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
    received_quantity REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS held_sales (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    sale_data TEXT NOT NULL,
    cashier_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    cashier_id TEXT NOT NULL REFERENCES users(id),
    start_time TEXT NOT NULL DEFAULT (datetime('now')),
    end_time TEXT,
    opening_cash REAL DEFAULT 0 CHECK (opening_cash >= 0),
    closing_cash REAL,
    expected_cash REAL,
    difference REAL,
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier ON shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

-- Seed default admin user (password: admin123)
INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role, pin) VALUES
('admin001', 'admin', '$2a$10$SEkfTwMa2BlLNrEXpt9n8.97U5YHECKhgEl/6K/o4IhsRLYqTObQe', 'System Administrator', 'admin', '1234');

-- Seed default categories
INSERT OR IGNORE INTO categories (id, name, description) VALUES
('cat001', 'Cement', 'All types of cement bags'),
('cat002', 'Roofing Sheets', 'Roofing materials and sheets'),
('cat003', 'Nails', 'Various sizes and types of nails'),
('cat004', 'Plumbing', 'Pipes, fittings, and plumbing supplies'),
('cat005', 'Electrical', 'Wires, switches, and electrical supplies'),
('cat006', 'Tools', 'Hand tools and power tools'),
('cat007', 'Paint', 'Paints, brushes, and painting supplies'),
('cat008', 'Timber', 'Wood and timber products'),
('cat009', 'Glass', 'Windows and glass products'),
('cat010', 'Fittings', 'Door locks, hinges, and fittings');

-- Seed sample products
INSERT OR IGNORE INTO products (id, sku, name, category_id, unit_of_measure, cost_price, selling_price, current_stock, reorder_level) VALUES
('prod001', 'CEM-001', 'Diamond Cement 50kg', 'cat001', 'bag', 55.00, 65.00, 200, 50),
('prod002', 'CEM-002', 'Ghacem Portland Cement 50kg', 'cat001', 'bag', 58.00, 68.00, 150, 50),
('prod003', 'ROF-001', 'Aluzinc Roofing Sheet 0.55mm', 'cat002', 'piece', 45.00, 58.00, 100, 20),
('prod004', 'NAIL-001', 'Concrete Nails 3 inch (1kg)', 'cat003', 'kg', 8.00, 12.00, 80, 20),
('prod005', 'PLB-001', 'PVC Pipe 1 inch (3m)', 'cat004', 'piece', 12.00, 18.00, 60, 15),
('prod006', 'WIR-001', 'Electrical Cable 2.5mm (100m)', 'cat005', 'roll', 280.00, 350.00, 30, 10),
('prod007', 'TL-001', 'Claw Hammer 16oz', 'cat006', 'piece', 25.00, 38.00, 40, 10),
('prod008', 'PNT-001', 'Azar Paint White 4L', 'cat007', 'piece', 65.00, 85.00, 25, 8);
