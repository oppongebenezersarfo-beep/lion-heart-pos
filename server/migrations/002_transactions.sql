CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    reference TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    provider TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'GHS',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    paystack_response TEXT,
    access_code TEXT,
    sale_id TEXT REFERENCES sales(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
