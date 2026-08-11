import React, { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  HiOutlineShoppingCart,
  HiOutlineCube,
  HiOutlineUsers,
  HiOutlineTruck,
  HiOutlineDocumentText,
  HiOutlineChartBar,
  HiOutlineClock,
  HiOutlineCog,
  HiOutlineArrowRightOnRectangle,
  HiOutlineArrowUturnLeft,
} from 'react-icons/hi2';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/pos', label: 'POS', icon: HiOutlineShoppingCart, roles: ['admin', 'manager', 'cashier'] },
  { path: '/dashboard', label: 'Dashboard', icon: HiOutlineChartBar, roles: ['admin', 'manager'] },
  { path: '/inventory', label: 'Inventory', icon: HiOutlineCube, roles: ['admin', 'manager'] },
  { path: '/customers', label: 'Customers', icon: HiOutlineUsers, roles: ['admin', 'manager'] },
  { path: '/suppliers', label: 'Suppliers', icon: HiOutlineTruck, roles: ['admin', 'manager'] },
  { path: '/purchases', label: 'Purchases', icon: HiOutlineDocumentText, roles: ['admin', 'manager'] },
  { path: '/reports', label: 'Reports', icon: HiOutlineChartBar, roles: ['admin', 'manager'] },
  { path: '/returns', label: 'Returns', icon: HiOutlineArrowUturnLeft, roles: ['admin', 'manager'] },
  { path: '/shifts', label: 'Shifts', icon: HiOutlineClock, roles: ['admin', 'manager', 'cashier'] },
  { path: '/settings', label: 'Settings', icon: HiOutlineCog, roles: ['admin'] },
];

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNav = navItems.filter((item) => {
    const userRole = user?.role;
    if (!userRole) return false;
    return item.roles.includes(userRole);
  });

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lion-gold rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-xl">LH</span>
            </div>
            <div>
              <h1 className="font-bold text-white">Lion Heart</h1>
              <p className="text-xs text-gray-400">Hardware POS</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">
                {user?.fullName?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.fullName}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <HiOutlineArrowRightOnRectangle className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">
              {filteredNav.find((n) => location.pathname.startsWith(n.path))?.label || 'Lion Heart Hardware'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Online/Offline indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isOnline
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <div className="text-sm text-gray-400">
              {new Date().toLocaleDateString('en-GH', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
