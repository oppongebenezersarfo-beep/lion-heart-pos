const Table = require('cli-table3');
const chalk = require('chalk');

const G = chalk.hex('#b8860b');
const W = chalk.white;
const G2 = chalk.gray;
const R = chalk.red;
const G3 = chalk.green;

function table(title, headers, rows) {
  if (title) console.log('\n' + G('  ' + title));
  const t = new Table({
    head: headers.map(h => chalk.bold(h)),
    style: { head: ['cyan'] },
    chars: {
      'top': G2('─'), 'top-mid': G2('┬'), 'top-left': G2('┌'), 'top-right': G2('┐'),
      'bottom': G2('─'), 'bottom-mid': G2('┴'), 'bottom-left': G2('└'), 'bottom-right': G2('┘'),
      'left': G2('│'), 'left-mid': G2('├'), 'mid': G2('─'), 'mid-mid': G2('┼'),
      'right': G2('│'), 'right-mid': G2('┤'), 'middle': G2('│'),
    },
  });
  rows.forEach(r => t.push(r));
  console.log(t.toString());
  return t;
}

function success(msg) { console.log(G3('  ✓ ' + msg)); }
function error(msg) { console.log(R('  ✗ ' + msg)); }
function info(msg) { console.log(G2('  ℹ ' + msg)); }
function warn(msg) { console.log(chalk.yellow('  ⚠ ' + msg)); }
function heading(msg) { console.log('\n' + G('━━━ ' + msg + ' ━━━')); }

function currency(amount) {
  if (amount === null || amount === undefined) return '-';
  return 'GH₵ ' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function printDashboard(data) {
  heading('DASHBOARD');
  table('Today\'s Summary', ['Metric', 'Value'], [
    ['Sales Today', currency(data.salesToday?.total)],
    ['Transactions Today', data.salesToday?.count || 0],
    ['Sales This Week', currency(data.salesWeek?.total)],
    ['Sales This Month', currency(data.salesMonth?.total)],
  ]);

  if (data.lowStock?.length) {
    table('Low Stock Alerts', ['Product', 'Current', 'Reorder'], data.lowStock.map(p => [
      chalk.red(p.name),
      chalk.red(p.current_stock),
      p.reorder_level,
    ]));
  }

  if (data.topProducts?.length) {
    table('Top Products (This Month)', ['Product', 'Qty Sold', 'Revenue'], data.topProducts.map(p => [
      p.name,
      p.total_quantity,
      currency(p.total_revenue),
    ]));
  }
}

function printProducts(products) {
  table('PRODUCTS', ['SKU', 'Name', 'Price', 'Stock', 'Category'], products.map(p => [
    p.sku,
    p.name,
    currency(p.selling_price),
    p.current_stock <= (p.reorder_level || 0) ? chalk.red(p.current_stock) : chalk.green(p.current_stock),
    p.category_name || '-',
  ]));
}

function printSales(sales) {
  table('SALES', ['Invoice', 'Date', 'Total', 'Payment', 'Cashier'], sales.map(s => [
    s.invoice_number,
    formatDate(s.created_at),
    currency(s.total),
    s.payment_method?.toUpperCase() || '-',
    s.cashier_name || '-',
  ]));
}

function printCustomers(customers) {
  table('CUSTOMERS', ['Name', 'Phone', 'Balance', 'Credit Limit', 'Status'], customers.map(c => [
    c.name,
    c.phone || '-',
    currency(c.outstanding_balance),
    currency(c.credit_limit),
    c.is_credit_approved ? G3('Approved') : G2('Pending'),
  ]));
}

function printSuppliers(suppliers) {
  table('SUPPLIERS', ['Name', 'Contact', 'Phone', 'Email'], suppliers.map(s => [
    s.name,
    s.contact_person || '-',
    s.phone || '-',
    s.email || '-',
  ]));
}

function printUsers(users) {
  table('USERS', ['Username', 'Full Name', 'Role', 'Status'], users.map(u => [
    u.username,
    u.full_name,
    u.role,
    u.is_active ? G3('Active') : R('Inactive'),
  ]));
}

function printShifts(shifts) {
  table('SHIFT HISTORY', ['Cashier', 'Start', 'End', 'Opening', 'Closing', 'Diff', 'Status'], shifts.map(s => [
    s.cashier_name || '-',
    formatDateTime(s.start_time),
    s.end_time ? formatDateTime(s.end_time) : '-',
    currency(s.opening_cash),
    s.closing_cash !== null ? currency(s.closing_cash) : '-',
    s.difference !== null ? (s.difference >= 0 ? G3(currency(s.difference)) : R(currency(s.difference))) : '-',
    s.status === 'open' ? G3('OPEN') : G2('CLOSED'),
  ]));
}

function printAuditLog(logs) {
  table('AUDIT LOG', ['Time', 'User', 'Action', 'Details'], logs.map(l => [
    formatDateTime(l.created_at),
    l.username || 'system',
    l.action,
    l.details ? (typeof l.details === 'string' ? l.details.substring(0, 60) : JSON.stringify(l.details).substring(0, 60)) : '-',
  ]));
}

function printProfitReport(products) {
  table('PROFITABILITY', ['Product', 'Qty Sold', 'Revenue', 'Cost', 'Profit', 'Margin%'], products.map(p => [
    p.name,
    p.quantity_sold,
    currency(p.revenue),
    currency(p.cost),
    p.profit >= 0 ? G3(currency(p.profit)) : R(currency(p.profit)),
    p.margin ? p.margin.toFixed(1) + '%' : '-',
  ]));
}

function handleResponse(res, successMsg, errorMsg) {
  if (res.status === 200 || res.status === 201) {
    if (successMsg) success(successMsg);
    return true;
  } else if (res.status === 429) {
    error('Rate limited. Please wait and try again.');
    return false;
  } else if (res.status === 401) {
    error('Session expired. Run: lion-agent login <username> <password>');
    return false;
  } else if (res.status === 403) {
    error('Insufficient permissions. Admin/Manager role required.');
    return false;
  } else {
    error(errorMsg || res.body?.error || 'Request failed (' + res.status + ')');
    return false;
  }
}

module.exports = {
  table, success, error, info, warn, heading, currency, formatDate, formatDateTime,
  printDashboard, printProducts, printSales, printCustomers, printSuppliers,
  printUsers, printShifts, printAuditLog, printProfitReport, handleResponse,
};
