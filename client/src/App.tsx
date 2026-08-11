import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useOfflineSync } from './hooks/useOfflineSync';
import Layout from './components/Layout';
import Login from './pages/Login';
import Checkout from './pages/POS/Checkout';
import Dashboard from './pages/Reports/Dashboard';
import Inventory from './pages/Inventory/Inventory';
import CustomerList from './pages/Customers/CustomerList';
import SupplierList from './pages/Suppliers/SupplierList';
import PurchaseOrders from './pages/Purchasing/PurchaseOrders';
import SalesReport from './pages/Reports/SalesReport';
import ShiftManager from './pages/Shifts/ShiftManager';
import UserManagement from './pages/Settings/UserManagement';
import Returns from './pages/Sales/Returns';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/pos" />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();
  // Activate offline sync when logged in
  useOfflineSync();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/pos" /> : <Login />} />
      <Route path="/pos" element={
        <ProtectedRoute roles={['admin', 'manager', 'cashier']}>
          <Checkout />
        </ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute roles={['admin', 'manager']}>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/inventory" element={
        <ProtectedRoute roles={['admin', 'manager']}>
          <Inventory />
        </ProtectedRoute>
      } />
      <Route path="/customers" element={
        <ProtectedRoute roles={['admin', 'manager']}>
          <CustomerList />
        </ProtectedRoute>
      } />
      <Route path="/suppliers" element={
        <ProtectedRoute roles={['admin', 'manager']}>
          <SupplierList />
        </ProtectedRoute>
      } />
      <Route path="/purchases" element={
        <ProtectedRoute roles={['admin', 'manager']}>
          <PurchaseOrders />
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute roles={['admin', 'manager']}>
          <SalesReport />
        </ProtectedRoute>
      } />
      <Route path="/shifts" element={
        <ProtectedRoute roles={['admin', 'manager', 'cashier']}>
          <ShiftManager />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute roles={['admin']}>
          <UserManagement />
        </ProtectedRoute>
      } />
      <Route path="/returns" element={
        <ProtectedRoute roles={['admin', 'manager']}>
          <Returns />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/pos" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000,
          style: { background: '#1f2937', color: '#fff', border: '1px solid #374151' }
        }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
