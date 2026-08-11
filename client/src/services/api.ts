import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pos_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  getMe: () => api.get('/auth/me'),
  verifyPin: (pin: string, action: string) =>
    api.post('/auth/verify-pin', { pin, action }),
};

// Products
export const productsAPI = {
  getAll: (params?: any) => api.get('/products', { params }),
  getById: (id: string) => api.get(`/products/${id}`),
  getByBarcode: (barcode: string) => api.get(`/products/barcode/${barcode}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
  getCategories: () => api.get('/products/meta/categories'),
  createCategory: (data: any) => api.post('/products/categories', data),
  delete: (id: string) => api.delete(`/products/${id}`),
  adjustStock: (id: string, data: any) => api.post(`/products/${id}/adjust-stock`, data),
};

// Sales
export const salesAPI = {
  create: (data: any) => api.post('/sales', data),
  getAll: (params?: any) => api.get('/sales', { params }),
  getById: (id: string) => api.get(`/sales/${id}`),
  hold: (saleData: any) => api.post('/sales/hold', { sale_data: saleData }),
  getHeld: () => api.get('/sales/held/all'),
  deleteHeld: (id: string) => api.delete(`/sales/held/${id}`),
  processReturn: (id: string, data: any) => api.post(`/sales/${id}/return`, data),
};

// Customers
export const customersAPI = {
  getAll: (params?: any) => api.get('/customers', { params }),
  getById: (id: string) => api.get(`/customers/${id}`),
  create: (data: any) => api.post('/customers', data),
  update: (id: string, data: any) => api.put(`/customers/${id}`, data),
  getSales: (id: string) => api.get(`/customers/${id}/sales`),
  recordPayment: (id: string, data: any) => api.post(`/customers/${id}/payments`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
};

// Suppliers
export const suppliersAPI = {
  getAll: (params?: any) => api.get('/suppliers', { params }),
  getById: (id: string) => api.get(`/suppliers/${id}`),
  create: (data: any) => api.post('/suppliers', data),
  update: (id: string, data: any) => api.put(`/suppliers/${id}`, data),
  delete: (id: string) => api.delete(`/suppliers/${id}`),
};

// Purchases
export const purchasesAPI = {
  getAll: (params?: any) => api.get('/purchases', { params }),
  getById: (id: string) => api.get(`/purchases/${id}`),
  create: (data: any) => api.post('/purchases', data),
  receive: (id: string, data: any) => api.post(`/purchases/${id}/receive`, data),
};

// Reports
export const reportsAPI = {
  getDashboard: () => api.get('/reports/dashboard'),
  getSales: (params?: any) => api.get('/reports/sales', { params }),
  getProfit: (params?: any) => api.get('/reports/profit', { params }),
  getLowStock: () => api.get('/reports/low-stock'),
  getOfflineSync: () => api.get('/reports/offline-sync'),
};

// Shifts
export const shiftsAPI = {
  start: (openingCash: number) => api.post('/shifts/start', { opening_cash: openingCash }),
  getCurrent: () => api.get('/shifts/current'),
  close: (id: string, closingCash: number) => api.post(`/shifts/${id}/close`, { closing_cash: closingCash }),
  getHistory: (params?: any) => api.get('/shifts/history', { params }),
};

// Sync
export const syncAPI = {
  syncOfflineSales: (sales: any[]) => api.post('/sync', { sales }),
};

// Users
export const usersAPI = {
  getAll: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

export default api;
