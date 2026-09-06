import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  FileCheck2, 
  AlertOctagon, 
  FileSpreadsheet, 
  BarChart3, 
  LogOut, 
  User as UserIcon,
  Search,
  CheckCircle,
  Menu,
  Bell,
  X
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/auth/login');
  };

  // Only displaying existing routes
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Inspections', path: '/inspections', icon: FileCheck2 },
    { label: 'Violations', path: '/violations', icon: AlertOctagon },
    { label: 'Reports', path: '/reports', icon: FileSpreadsheet },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  ];

  // For mobile bottom nav, we take the top 4
  const mobileNavItems = navItems.slice(0, 4);

  return (
    <div className="min-h-screen bg-[var(--color-surface-bg)] text-[var(--color-text-main)] flex font-sans pb-16 md:pb-0">
      
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex ${isSidebarOpen ? 'w-64' : 'w-20'} flex-shrink-0 bg-white border-r border-gray-200 flex-col justify-between transition-all duration-300 z-20 shadow-sm`}>
        <div>
          {/* Logo Area */}
          <div className="h-16 flex items-center px-4 border-b border-gray-100">
            <div className="bg-blue-600 text-white p-2 rounded-lg flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            {isSidebarOpen && (
              <div className="ml-3 overflow-hidden whitespace-nowrap">
                <span className="text-sm font-bold text-gray-900 tracking-tight block">LEGAL METROLOGY</span>
                <span className="text-[10px] text-gray-500 font-medium block">Inspection & Compliance System</span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="p-3 space-y-1 mt-2">
            {isSidebarOpen && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 pb-2">
                Primary Navigation
              </div>
            )}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={!isSidebarOpen ? item.label : undefined}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  {isSidebarOpen && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Area */}
        <div className="p-4 border-t border-gray-100">
          {isSidebarOpen && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center text-blue-700 font-bold text-[11px] uppercase tracking-wide">
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Rule Engine Active
              </div>
              <p className="text-[11px] text-gray-500 leading-normal">
                PCR 2011 Legal Metrology rules active for mandatory verifications.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-10 shadow-sm sticky top-0 md:static">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:block p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Mobile Branding (only visible on sm/md screens) */}
            <div className="md:hidden flex items-center space-x-2">
              <div className="bg-blue-600 text-white p-1.5 rounded-lg flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-gray-900 tracking-tight block">METROLOGY</span>
            </div>

            {/* Global Search - Hidden on mobile */}
            <div className="relative hidden md:block w-96">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search inspections, stores, products..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            {/* System Status - hidden on small mobile */}
            <div className="hidden sm:flex items-center space-x-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-gray-600 font-medium">System Online</span>
            </div>

            <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Desktop User Profile */}
            {user && (
              <div className="hidden md:flex items-center space-x-3 border-l border-gray-200 pl-4">
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">{user.full_name}</div>
                  <div className="text-xs text-gray-500">{user.role_name}</div>
                </div>
                <div className="h-9 w-9 bg-blue-100 text-blue-700 flex items-center justify-center rounded-full font-bold text-sm border border-blue-200">
                  {user.full_name.charAt(0)}
                </div>
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Mobile Flyout Menu (Secondary items) */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-200 z-30 shadow-lg px-4 py-4 space-y-4">
            {user && (
              <div className="flex items-center space-x-3 pb-4 border-b border-gray-100">
                <div className="h-10 w-10 bg-blue-100 text-blue-700 flex items-center justify-center rounded-full font-bold text-base border border-blue-200">
                  {user.full_name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{user.full_name}</div>
                  <div className="text-xs text-gray-500">{user.role_name}</div>
                </div>
              </div>
            )}
            
            <div className="space-y-1">
              <Link 
                to="/analytics" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <BarChart3 className="w-5 h-5 text-gray-400" />
                <span>Analytics & Trends</span>
              </Link>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 bg-gray-50 text-red-600 px-4 py-3 rounded-xl font-semibold border border-gray-200 active:bg-gray-100"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[var(--color-surface-bg)] relative z-0">
          <div className="max-w-7xl mx-auto pb-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-safe shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

