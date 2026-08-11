# Lion Heart Hardware POS

Point of Sale system for Lion Heart Hardware - a building materials and hardware retail store in Ghana.

## Tech Stack
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **Offline Storage:** IndexedDB via Dexie.js

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)
- npm or yarn

### 1. Database Setup

```bash
# Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE lion_heart_pos;"
```

Update `server/.env` with your PostgreSQL credentials:
```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/lion_heart_pos
JWT_SECRET=your-secret-key
PORT=5000
```

### 2. Run Migrations

```bash
cd server
npm install
npm run migrate
```

This creates all tables and seeds default admin user:
- **Username:** admin
- **Password:** admin123
- **Manager PIN:** 1234

### 3. Start Backend

```bash
cd server
npm run dev
# Server runs on http://localhost:5000
```

### 4. Start Frontend

```bash
cd client
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

### 5. Open POS

Navigate to `http://localhost:3000` and login with admin/admin123.

## Features

### POS Checkout
- Barcode scanner support (USB/Bluetooth keyboard mode)
- Fast product search by name, SKU, or barcode
- Fractional/bulk sales (cut wire by meter, sell half bag)
- Multiple payment methods: Cash, MTN MoMo, Telecel, AirtelTigo, Card, Split
- Hold/resume sales
- Manager PIN required for any discount
- Receipt printing (80mm thermal via browser print)

### Offline Mode
- Full POS functionality without internet
- Product catalog cached locally in IndexedDB
- Sales queued offline, auto-sync when online
- Online/offline status indicator
- Conflict detection for stock issues

### Inventory
- Full CRUD for products with SKU, barcode, category
- Low-stock alerts
- Stock movement tracking

### Customer Management
- Customer profiles with flexible credit terms
- Outstanding balance tracking
- Credit sale support

### Supplier & Purchasing
- Supplier records
- Purchase orders with stock-in workflow

### Reporting
- Daily/weekly/monthly sales summaries
- Best-selling products
- Profit margin reports
- Low-stock reports
- Offline sync report (flagged for manager review)
- CSV export

### User Roles
- **Admin:** Full access including user management
- **Manager:** Inventory, reports, sales oversight, PIN approvals
- **Cashier:** POS checkout screen only

### Shift Management
- Start/end shift with cash count
- Expected vs actual cash reconciliation

## Hardware Setup (In-Store)

### Barcode Scanner
Connect a USB barcode scanner (acts as keyboard input). The POS search field auto-focuses and captures rapid keystroke input ending in Enter.

### Receipt Printer
Use a thermal receipt printer with Windows driver installed. Click "Print Receipt" after sale - uses browser print API styled for 80mm width.

## Offline Testing

1. Open POS screen
2. Open DevTools > Network tab
3. Check "Offline" checkbox
4. Add items to cart and complete a sale
5. Verify the sale is queued (check IndexedDB in Application tab)
6. Uncheck "Offline"
7. Watch the sale auto-sync to server

## Currency
All prices in Ghana Cedis (GHS).
