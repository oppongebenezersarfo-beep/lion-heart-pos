#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const PosApi = require('./api');
const fmt = require('./format');
const { parseNaturalLanguage } = require('./nlp');

const api = new PosApi();

const program = new Command();
program.name('lion-agent').description('Lion Heart POS AI Agent').version('1.0.0');

// Helper: confirm dangerous actions
async function confirm(msg) {
  const { ok } = await inquirer.prompt([{ type: 'confirm', name: 'ok', message: msg, default: false }]);
  return ok;
}

// Helper: parse date args
function parseDate(s) {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString().split('T')[0];
}

// ==================== AUTH ====================
program.command('login').argument('[username]').argument('[password]').description('Login to POS')
  .action(async (u, p) => {
    let username = u, password = p;
    if (!username || !password) {
      const ans = await inquirer.prompt([
        { type: 'input', name: 'username', message: 'Username:', when: !username },
        { type: 'password', name: 'password', message: 'Password:', when: !password },
      ]);
      if (!username) username = ans.username;
      if (!password) password = ans.password;
    }
    const res = await api.login(username, password);
    if (res.success) {
      fmt.success(`Logged in as ${res.user.fullName} (${res.user.role})`);
    } else {
      fmt.error(res.error);
    }
  });

program.command('whoami').description('Show current user')
  .action(async () => {
    if (!api.token) { fmt.error('Not logged in'); return; }
    fmt.info(`Logged in as ${api.user.fullName} (${api.user.role})`);
  });

program.command('logout').description('Clear saved session')
  .action(() => { api.clearConfig(); fmt.success('Logged out'); });

// ==================== DASHBOARD ====================
program.command('dashboard').description('Show dashboard summary')
  .action(async () => {
    const res = await api.dashboard();
    if (res.status === 200) fmt.printDashboard(res.body);
    else fmt.handleResponse(res, null, 'Failed to load dashboard');
  });

// ==================== PRODUCTS ====================
const prod = program.command('products').description('Product management');

prod.command('list').description('List all products')
  .option('-s, --search <term>', 'Search by name/SKU')
  .option('-c, --category <id>', 'Filter by category')
  .option('-l, --low-stock', 'Show low stock only')
  .action(async (opts) => {
    const params = {};
    if (opts.search) params.search = opts.search;
    if (opts.category) params.category_id = opts.category;
    if (opts.lowStock) params.low_stock = 'true';
    const res = await api.listProducts(params);
    if (res.status === 200) {
      fmt.printProducts(res.body);
      fmt.info(`${res.body.length} product(s)`);
    } else fmt.handleResponse(res, null, 'Failed to list products');
  });

prod.command('search').argument('<term>').description('Search products')
  .action(async (term) => {
    const res = await api.listProducts({ search: term });
    if (res.status === 200) fmt.printProducts(res.body);
    else fmt.handleResponse(res);
  });

prod.command('add').description('Add a new product')
  .action(async () => {
    const cats = await api.getCategories();
    const categories = cats.status === 200 ? cats.body : [];
    const ans = await inquirer.prompt([
      { type: 'input', name: 'sku', message: 'SKU:', validate: v => !!v || 'Required' },
      { type: 'input', name: 'barcode', message: 'Barcode (optional):' },
      { type: 'input', name: 'name', message: 'Product name:', validate: v => !!v || 'Required' },
      { type: 'input', name: 'description', message: 'Description:' },
      { type: 'list', name: 'category_id', message: 'Category:', choices: categories.map(c => ({ name: c.name, value: c.id })) },
      { type: 'input', name: 'unit_of_measure', message: 'Unit:', default: 'piece' },
      { type: 'number', name: 'cost_price', message: 'Cost price (GH₵):', validate: v => v >= 0 || 'Must be >= 0' },
      { type: 'number', name: 'selling_price', message: 'Selling price (GH₵):', validate: v => v >= 0 || 'Must be >= 0' },
      { type: 'number', name: 'current_stock', message: 'Current stock:', default: 0 },
      { type: 'number', name: 'reorder_level', message: 'Reorder level:', default: 0 },
    ]);
    if (!(await confirm(`Create product "${ans.name}" at GH₵${ans.selling_price}?`))) { fmt.info('Cancelled'); return; }
    const res = await api.createProduct(ans);
    if (res.status === 201) fmt.success(`Product "${ans.name}" created`);
    else fmt.handleResponse(res, null, 'Failed to create product');
  });

prod.command('adjust').description('Adjust stock')
  .action(async () => {
    const prods = await api.listProducts();
    if (prods.status !== 200) { fmt.handleResponse(prods); return; }
    const ans = await inquirer.prompt([
      { type: 'list', name: 'product_id', message: 'Product:', choices: prods.body.map(p => ({ name: `${p.name} (stock: ${p.current_stock})`, value: p.id })) },
      { type: 'number', name: 'adjustment', message: 'Adjustment (+ to add, - to remove):' },
      { type: 'input', name: 'reason', message: 'Reason:', validate: v => !!v || 'Required' },
    ]);
    if (!(await confirm(`Adjust stock by ${ans.adjustment}?`))) { fmt.info('Cancelled'); return; }
    const res = await api.adjustStock(ans.product_id, { adjustment: ans.adjustment, reason: ans.reason });
    if (res.status === 200) fmt.success('Stock adjusted');
    else fmt.handleResponse(res, null, 'Failed to adjust stock');
  });

// ==================== SALES ====================
const sale = program.command('sales').description('Sales management');

sale.command('list').description('List sales')
  .option('-d, --date <date>', 'Filter by date (YYYY-MM-DD)')
  .option('--from <date>', 'Start date')
  .option('--to <date>', 'End date')
  .action(async (opts) => {
    const params = {};
    if (opts.date) { params.start_date = parseDate(opts.date); params.end_date = parseDate(opts.date); }
    if (opts.from) params.start_date = parseDate(opts.from);
    if (opts.to) params.end_date = parseDate(opts.to);
    const res = await api.listSales(params);
    if (res.status === 200) { fmt.printSales(res.body); fmt.info(`${res.body.length} sale(s)`); }
    else fmt.handleResponse(res);
  });

sale.command('today').description('Show today\'s sales')
  .action(async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await api.listSales({ start_date: today, end_date: today });
    if (res.status === 200) {
      fmt.printSales(res.body);
      const total = res.body.reduce((s, x) => s + (x.total || 0), 0);
      fmt.success(`Total: ${fmt.currency(total)} (${res.body.length} transactions)`);
    } else fmt.handleResponse(res);
  });

sale.command('return').description('Process a return')
  .action(async () => {
    const inv = await inquirer.prompt([{ type: 'input', name: 'invoice', message: 'Invoice number:', validate: v => !!v || 'Required' }]);
    const sales = await api.listSales({ invoice_number: inv.invoice });
    if (sales.status !== 200 || !sales.body.length) { fmt.error('Sale not found'); return; }
    const sale = sales.body[0];
    const items = await api.getSale(sale.id);
    if (items.status !== 200) { fmt.error('Cannot load sale details'); return; }
    fmt.info(`Sale ${sale.invoice_number} — ${fmt.currency(sale.total)}`);
    if (!(await confirm('Process return for this sale?'))) { fmt.info('Cancelled'); return; }
    const res = await api.processReturn(sale.id, { reason: 'CLI return' });
    if (res.status === 200) fmt.success('Return processed');
    else fmt.handleResponse(res, null, 'Failed to process return');
  });

// ==================== CUSTOMERS ====================
const cust = program.command('customers').description('Customer management');

cust.command('list').description('List customers')
  .option('-s, --search <term>', 'Search by name/phone')
  .action(async (opts) => {
    const res = await api.listCustomers(opts.search ? { search: opts.search } : {});
    if (res.status === 200) { fmt.printCustomers(res.body); fmt.info(`${res.body.length} customer(s)`); }
    else fmt.handleResponse(res);
  });

cust.command('add').description('Add a customer')
  .action(async () => {
    const ans = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'Name:', validate: v => !!v || 'Required' },
      { type: 'input', name: 'phone', message: 'Phone:' },
      { type: 'input', name: 'email', message: 'Email:' },
      { type: 'input', name: 'address', message: 'Address:' },
      { type: 'number', name: 'credit_limit', message: 'Credit limit (GH₵):', default: 0 },
    ]);
    const res = await api.createCustomer(ans);
    if (res.status === 201) fmt.success(`Customer "${ans.name}" created`);
    else fmt.handleResponse(res, null, 'Failed to create customer');
  });

cust.command('credit').description('Show customers with outstanding balances')
  .action(async () => {
    const res = await api.listCustomers();
    if (res.status === 200) {
      const debtors = res.body.filter(c => c.outstanding_balance > 0);
      if (debtors.length) { fmt.printCustomers(debtors); }
      else { fmt.success('No outstanding balances'); }
    } else fmt.handleResponse(res);
  });

// ==================== SUPPLIERS ====================
const sup = program.command('suppliers').description('Supplier management');

sup.command('list').description('List suppliers')
  .action(async () => {
    const res = await api.listSuppliers();
    if (res.status === 200) { fmt.printSuppliers(res.body); fmt.info(`${res.body.length} supplier(s)`); }
    else fmt.handleResponse(res);
  });

sup.command('add').description('Add a supplier')
  .action(async () => {
    const ans = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'Company name:', validate: v => !!v || 'Required' },
      { type: 'input', name: 'contact_person', message: 'Contact person:' },
      { type: 'input', name: 'phone', message: 'Phone:' },
      { type: 'input', name: 'email', message: 'Email:' },
      { type: 'input', name: 'address', message: 'Address:' },
    ]);
    const res = await api.createSupplier(ans);
    if (res.status === 201) fmt.success(`Supplier "${ans.name}" created`);
    else fmt.handleResponse(res, null, 'Failed to create supplier');
  });

// ==================== PURCHASES ====================
const purch = program.command('purchases').description('Purchase orders');

purch.command('list').description('List purchase orders')
  .option('-s, --status <status>', 'Filter: pending or received')
  .action(async (opts) => {
    const res = await api.listPurchases(opts.status ? { status: opts.status } : {});
    if (res.status === 200) {
      fmt.table('PURCHASE ORDERS', ['Order #', 'Supplier', 'Total', 'Status', 'Date'], res.body.map(p => [
        p.order_number, p.supplier_name || '-', fmt.currency(p.total), p.status, fmt.formatDate(p.created_at)
      ]));
      fmt.info(`${res.body.length} order(s)`);
    } else fmt.handleResponse(res);
  });

// ==================== REPORTS ====================
const rep = program.command('reports').description('Reports and analytics');

rep.command('profit').description('Profitability report')
  .option('--from <date>', 'Start date')
  .option('--to <date>', 'End date')
  .action(async (opts) => {
    const params = {};
    if (opts.from) params.start_date = parseDate(opts.from);
    if (opts.to) params.end_date = parseDate(opts.to);
    const res = await api.profitReport(params);
    if (res.status === 200) { fmt.printProfitReport(res.body); }
    else fmt.handleResponse(res);
  });

rep.command('low-stock').description('Low stock report')
  .action(async () => {
    const res = await api.lowStock();
    if (res.status === 200) {
      if (res.body.length) {
        fmt.table('LOW STOCK ALERTS', ['Product', 'Current', 'Reorder', 'Supplier'], res.body.map(p => [
          fmt.error(p.name), p.current_stock, p.reorder_level, p.supplier_name || '-'
        ]));
      } else fmt.success('All stock levels are healthy');
    } else fmt.handleResponse(res);
  });

// ==================== SHIFTS ====================
const shift = program.command('shifts').description('Shift management');

shift.command('current').description('Show current shift')
  .action(async () => {
    const res = await api.currentShift();
    if (res.status === 200 && res.body) {
      fmt.heading('CURRENT SHIFT');
      fmt.info(`Started: ${fmt.formatDateTime(res.body.start_time)}`);
      fmt.info(`Opening cash: ${fmt.currency(res.body.opening_cash)}`);
      if (res.body.total_sales !== undefined) {
        fmt.info(`Sales: ${fmt.currency(res.body.total_sales)} (${res.body.transaction_count || 0} transactions)`);
      }
    } else if (res.status === 200) {
      fmt.warn('No open shift. Start one with: lion-agent shift start');
    } else fmt.handleResponse(res);
  });

shift.command('start').description('Start a new shift')
  .action(async () => {
    const ans = await inquirer.prompt([{ type: 'number', name: 'opening_cash', message: 'Opening cash (GH₵):', default: 0 }]);
    const res = await api.startShift({ opening_cash: ans.opening_cash });
    if (res.status === 201) fmt.success('Shift started');
    else fmt.handleResponse(res, null, 'Failed to start shift');
  });

shift.command('history').description('View shift history')
  .option('-l, --limit <n>', 'Number of shifts', '10')
  .action(async (opts) => {
    const res = await api.shiftHistory({ limit: opts.limit });
    if (res.status === 200) fmt.printShifts(res.body);
    else fmt.handleResponse(res);
  });

// ==================== USERS ====================
const usr = program.command('users').description('User management (admin only)');

usr.command('list').description('List all users')
  .action(async () => {
    const res = await api.listUsers();
    if (res.status === 200) fmt.printUsers(res.body);
    else fmt.handleResponse(res, null, 'Failed to list users');
  });

usr.command('add').description('Add a new user')
  .action(async () => {
    const ans = await inquirer.prompt([
      { type: 'input', name: 'username', message: 'Username:', validate: v => !!v || 'Required' },
      { type: 'password', name: 'password', message: 'Password:', mask: '*' },
      { type: 'input', name: 'full_name', message: 'Full name:', validate: v => !!v || 'Required' },
      { type: 'list', name: 'role', message: 'Role:', choices: ['cashier', 'manager', 'admin'] },
      { type: 'input', name: 'pin', message: 'PIN (4 digits):', validate: v => /^\d{4}$/.test(v) || 'Must be 4 digits' },
    ]);
    if (!(await confirm(`Create user "${ans.username}" as ${ans.role}?`))) { fmt.info('Cancelled'); return; }
    const res = await api.createUser(ans);
    if (res.status === 201) fmt.success(`User "${ans.username}" created`);
    else fmt.handleResponse(res, null, 'Failed to create user');
  });

// ==================== AUDIT ====================
program.command('audit').description('View audit log')
  .option('-a, --action <type>', 'Filter by action type')
  .option('--from <date>', 'Start date')
  .option('--to <date>', 'End date')
  .option('-l, --limit <n>', 'Number of entries', '20')
  .action(async (opts) => {
    const params = {};
    if (opts.action) params.action = opts.action;
    if (opts.from) params.start_date = parseDate(opts.from);
    if (opts.to) params.end_date = parseDate(opts.to);
    if (opts.limit) params.limit = opts.limit;
    const res = await api.auditLog(params);
    if (res.status === 200) {
      fmt.printAuditLog(res.body.logs || res.body);
      fmt.info(`Showing ${res.body.logs?.length || res.body.length} entry/entries`);
    } else fmt.handleResponse(res);
  });

// ==================== NATURAL LANGUAGE ====================
program.command('ask').argument('<message>').description('Ask the agent in natural language')
  .action(async (message) => {
    const parsed = parseNaturalLanguage(message);
    await executeAction(parsed.action, parsed.raw);
  });

// ==================== HELP ====================
program.command('help-commands').description('Show all available commands')
  .action(() => {
    fmt.heading('LION HEART POS AGENT — COMMANDS');
    fmt.table('Auth', ['Command', 'Description'], [
      ['lion-agent login', 'Login to POS'],
      ['lion-agent whoami', 'Show current user'],
      ['lion-agent logout', 'Clear session'],
    ]);
    fmt.table('Quick Commands', ['Command', 'Description'], [
      ['lion-agent dashboard', 'Sales dashboard summary'],
      ['lion-agent products list', 'List all products'],
      ['lion-agent products search <term>', 'Search products'],
      ['lion-agent products add', 'Add new product (interactive)'],
      ['lion-agent products adjust', 'Adjust stock'],
      ['lion-agent sales today', 'Today\'s sales'],
      ['lion-agent sales list', 'List sales'],
      ['lion-agent customers list', 'List customers'],
      ['lion-agent customers credit', 'Show outstanding balances'],
      ['lion-agent suppliers list', 'List suppliers'],
      ['lion-agent purchases list', 'List purchase orders'],
      ['lion-agent reports profit', 'Profitability report'],
      ['lion-agent reports low-stock', 'Low stock alerts'],
      ['lion-agent shift current', 'Current shift status'],
      ['lion-agent shift start', 'Start a shift'],
      ['lion-agent users list', 'List users (admin)'],
      ['lion-agent users add', 'Add user (admin)'],
      ['lion-agent audit', 'View audit log'],
    ]);
    fmt.table('Natural Language', ['Example', 'Action'], [
      ['lion-agent ask "show me today\'s sales"', 'Sales summary'],
      ['lion-agent ask "which products are low on stock"', 'Low stock report'],
      ['lion-agent ask "add a new product"', 'Product creation'],
      ['lion-agent ask "show customers who owe money"', 'Credit report'],
      ['lion-agent ask "profit report this month"', 'Profit report'],
    ]);
  });

// ==================== ACTION ROUTER ====================
async function executeAction(action) {
  switch (action) {
    case 'dashboard': return program.parseAsync(['node', 'agent', 'dashboard']);
    case 'sales_today': return program.parseAsync(['node', 'agent', 'sales', 'today']);
    case 'products_list': return program.parseAsync(['node', 'agent', 'products', 'list']);
    case 'low_stock': return program.parseAsync(['node', 'agent', 'reports', 'low-stock']);
    case 'product_create': return program.parseAsync(['node', 'agent', 'products', 'add']);
    case 'stock_adjust': return program.parseAsync(['node', 'agent', 'products', 'adjust']);
    case 'categories': {
      const res = await api.getCategories();
      if (res.status === 200) {
        fmt.table('CATEGORIES', ['Name', 'Description'], res.body.map(c => [c.name, c.description || '-']));
      }
      break;
    }
    case 'sales_list': return program.parseAsync(['node', 'agent', 'sales', 'list']);
    case 'customers_list': return program.parseAsync(['node', 'agent', 'customers', 'list']);
    case 'customer_create': return program.parseAsync(['node', 'agent', 'customers', 'add']);
    case 'customers_credit': return program.parseAsync(['node', 'agent', 'customers', 'credit']);
    case 'suppliers_list': return program.parseAsync(['node', 'agent', 'suppliers', 'list']);
    case 'supplier_create': return program.parseAsync(['node', 'agent', 'suppliers', 'add']);
    case 'purchases_list': return program.parseAsync(['node', 'agent', 'purchases', 'list']);
    case 'profit_report': return program.parseAsync(['node', 'agent', 'reports', 'profit']);
    case 'reports_menu': {
      fmt.heading('AVAILABLE REPORTS');
      fmt.table('Reports', ['Command', 'Description'], [
        ['lion-agent reports profit', 'Profitability by product'],
        ['lion-agent reports low-stock', 'Low stock alerts'],
        ['lion-agent dashboard', 'Sales dashboard'],
        ['lion-agent audit', 'Audit log'],
      ]);
      break;
    }
    case 'shifts': return program.parseAsync(['node', 'agent', 'shift', 'current']);
    case 'shift_start': return program.parseAsync(['node', 'agent', 'shift', 'start']);
    case 'shift_close': return program.parseAsync(['node', 'agent', 'shift', 'close']);
    case 'users_list': return program.parseAsync(['node', 'agent', 'users', 'list']);
    case 'user_create': return program.parseAsync(['node', 'agent', 'users', 'add']);
    case 'audit_log': return program.parseAsync(['node', 'agent', 'audit']);
    case 'help': return program.parseAsync(['node', 'agent', 'help-commands']);
    default: fmt.warn('I don\'t understand that. Try: lion-agent help-commands');
  }
}

// ==================== INTERACTIVE MODE ====================
async function interactive() {
  console.log('');
  fmt.heading('LION HEART POS — AI AGENT');
  fmt.info('Type a command or ask me anything. Type "exit" to quit.');
  fmt.info('Try: "show me today\'s sales" or "which products are low on stock"');
  console.log('');

  const askCmd = program.commands.find(c => c._name === 'ask');

  while (true) {
    const { input } = await inquirer.prompt([{
      type: 'input',
      name: 'input',
      message: fmt.currency('lion-agent') + ' >',
    }]);

    if (!input.trim()) continue;
    if (input.trim() === 'exit' || input.trim() === 'quit') { fmt.success('Goodbye!'); break; }

    try {
      const parsed = parseNaturalLanguage(input);
      if (parsed.action === 'unknown') {
        // Try as a direct command
        const args = input.trim().split(/\s+/);
        await program.parseAsync(['node', 'agent', ...args], { from: 'user' });
      } else {
        await executeAction(parsed.action);
      }
    } catch (e) {
      fmt.error(e.message);
    }
  }
}

// Check if running interactively (no args)
const args = process.argv.slice(2);
if (args.length === 0) {
  interactive().catch(e => { fmt.error(e.message); process.exit(1); });
} else {
  program.parse(process.argv);
}
