const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(require('os').homedir(), '.lion-agent-config.json');

class PosApi {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || 'https://lion-heart-pos-production-6a1f.up.railway.app';
    this.token = null;
    this.user = null;
    this._loadConfig();
  }

  _loadConfig() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        this.token = cfg.token || null;
        this.user = cfg.user || null;
        this.baseUrl = cfg.baseUrl || this.baseUrl;
      }
    } catch {}
  }

  _saveConfig() {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({
      token: this.token,
      user: this.user,
      baseUrl: this.baseUrl,
    }, null, 2));
  }

  clearConfig() {
    this.token = null;
    this.user = null;
    if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
  }

  async _request(method, endpoint, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

      const opts = {
        method,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        headers,
      };

      const req = https.request(opts, (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          let json = null;
          try { json = JSON.parse(raw); } catch {}
          resolve({ status: res.statusCode, body: json || raw, raw });
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async login(username, password) {
    const res = await this._request('POST', '/api/auth/login', { username, password });
    if (res.status === 200 && res.body.token) {
      this.token = res.body.token;
      this.user = res.body.user;
      this._saveConfig();
      return { success: true, user: res.body.user };
    }
    return { success: false, error: res.body.error || 'Login failed' + (res.status === 429 ? ' (rate limited — wait and try again)' : ''), status: res.status };
  }

  _check() {
    if (!this.token) throw new Error('Not logged in. Run: lion-agent login <username> <password>');
  }

  async get(endpoint) { this._check(); return this._request('GET', endpoint); }
  async post(endpoint, data) { this._check(); return this._request('POST', endpoint, data); }
  async put(endpoint, data) { this._check(); return this._request('PUT', endpoint, data); }
  async del(endpoint) { this._check(); return this._request('DELETE', endpoint); }

  async me() { return this.get('/api/auth/me'); }

  // Products
  async listProducts(params) { const q = params ? '?' + new URLSearchParams(params).toString() : ''; return this.get('/api/products' + q); }
  async getProduct(id) { return this.get(`/api/products/${id}`); }
  async createProduct(data) { return this.post('/api/products', data); }
  async updateProduct(id, data) { return this.put(`/api/products/${id}`, data); }
  async deleteProduct(id) { return this.del(`/api/products/${id}`); }
  async adjustStock(id, data) { return this.post(`/api/products/${id}/adjust-stock`, data); }
  async getCategories() { return this.get('/api/products/meta/categories'); }
  async createCategory(data) { return this.post('/api/products/categories', data); }
  async getPriceHistory(params) { const q = params ? '?' + new URLSearchParams(params).toString() : ''; return this.get('/api/products/price-history' + q); }

  // Sales
  async listSales(params) { const q = params ? '?' + new URLSearchParams(params).toString() : ''; return this.get('/api/sales' + q); }
  async getSale(id) { return this.get(`/api/sales/${id}`); }
  async processReturn(id, data) { return this.post(`/api/sales/${id}/return`, data); }

  // Customers
  async listCustomers(params) { const q = params ? '?' + new URLSearchParams(params).toString() : ''; return this.get('/api/customers' + q); }
  async getCustomer(id) { return this.get(`/api/customers/${id}`); }
  async createCustomer(data) { return this.post('/api/customers', data); }
  async updateCustomer(id, data) { return this.put(`/api/customers/${id}`, data); }
  async deleteCustomer(id) { return this.del(`/api/customers/${id}`); }
  async getCustomerSales(id) { return this.get(`/api/customers/${id}/sales`); }
  async recordPayment(id, data) { return this.post(`/api/customers/${id}/payments`, data); }

  // Suppliers
  async listSuppliers(params) { const q = params ? '?' + new URLSearchParams(params).toString() : ''; return this.get('/api/suppliers' + q); }
  async getSupplier(id) { return this.get(`/api/suppliers/${id}`); }
  async createSupplier(data) { return this.post('/api/suppliers', data); }
  async updateSupplier(id, data) { return this.put(`/api/suppliers/${id}`, data); }
  async deleteSupplier(id) { return this.del(`/api/suppliers/${id}`); }

  // Purchases
  async listPurchases(params) { const q = params ? '?' + new URLSearchParams(params).toString() : ''; return this.get('/api/purchases' + q); }
  async getPurchase(id) { return this.get(`/api/purchases/${id}`); }
  async createPurchase(data) { return this.post('/api/purchases', data); }
  async receivePurchase(id, data) { return this.post(`/api/purchases/${id}/receive`, data); }

  // Reports
  async dashboard() { return this.get('/api/reports/dashboard'); }
  async salesReport(params) { const q = params ? '?' + new URLSearchParams(params).toString() : ''; return this.get('/api/reports/sales' + q); }
  async profitReport(params) { const q = params ? '?' + new URLSearchParams(params).toString() : ''; return this.get('/api/reports/profit' + q); }
  async lowStock() { return this.get('/api/reports/low-stock'); }

  // Shifts
  async startShift(data) { return this.post('/api/shifts/start', data); }
  async currentShift() { return this.get('/api/shifts/current'); }
  async closeShift(id, data) { return this.post(`/api/shifts/${id}/close`, data); }
  async shiftHistory(params) { const q = params ? '?' + new URLSearchParams(params).toString() : ''; return this.get('/api/shifts/history' + q); }

  // Users
  async listUsers() { return this.get('/api/users'); }
  async createUser(data) { return this.post('/api/users', data); }
  async updateUser(id, data) { return this.put(`/api/users/${id}`, data); }
  async deleteUser(id) { return this.del(`/api/users/${id}`); }

  // Audit
  async auditLog(params) { const q = params ? '?' + new URLSearchParams(params).toString() : ''; return this.get('/api/audit-log' + q); }

  // Health
  async health() { return this.get('/api/health'); }
}

module.exports = PosApi;
