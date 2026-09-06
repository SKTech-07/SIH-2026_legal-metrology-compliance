import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, User, Lock, ArrowRight, CheckCircle2, Shield, Search } from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@legalmetrology.gov.in');
  const [password, setPassword] = useState('AdminPassword123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // First seed db if needed
      await api.post('/auth/seed-setup').catch(() => {});

      const response = await fetch(`${api.defaults.baseURL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Login failed. Please check credentials.');
      }

      // Parse the response correctly:
      const data = await response.json();
      
      // Use the actual backend response property:
      const { access_token, user } = data;
      
      if (!access_token || !user) {
         throw new Error('Invalid response structure');
      }

      // Save the access token and user information
      setAuth(user, access_token);
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err: any) {
      // Do NOT show "Login failed" when response.status is 200 (handled above by throwing only on !response.ok or missing tokens)
      // Differentiate token-storage errors from login failure
      if (err.name === 'SecurityError' || err.name === 'QuotaExceededError' || err.message.includes('Storage')) {
        setError('Storage error: Unable to save login state. Please check your browser settings.');
      } else {
        setError(err.message || err.response?.data?.detail || 'Login failed. Please check credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const quickLoginAdmin = () => {
    setEmail('admin@legalmetrology.gov.in');
    setPassword('AdminPassword123!');
  };

  const quickLoginInspector = () => {
    setEmail('inspector.sharma@legalmetrology.gov.in');
    setPassword('InspectorPassword123!');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans text-gray-900 relative overflow-hidden">
      
      {/* Background Graphic Accents (Optional, kept subtle) */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none"></div>

      <div className="w-full max-w-[420px] bg-white border border-gray-200 rounded-2xl p-8 shadow-xl space-y-7 relative z-10">
        
        {/* Emblem & Portal Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex p-3.5 bg-blue-600 text-white rounded-2xl shadow-md">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight uppercase">
              Legal Metrology
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-1">Compliance & Inspection Platform</p>
          </div>
        </div>

        {/* Quick Demo Credentials Banner */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
          <div className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-1.5 text-blue-600" /> Quick Auto-Fill Roles
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-medium">
            <button
              type="button"
              onClick={quickLoginAdmin}
              className="py-2.5 px-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-left transition-colors flex items-center shadow-sm"
            >
              <Shield className="w-3.5 h-3.5 mr-1.5 text-purple-600" /> Admin
            </button>
            <button
              type="button"
              onClick={quickLoginInspector}
              className="py-2.5 px-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-left transition-colors flex items-center shadow-sm"
            >
              <Search className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Inspector
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
              Email Address
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium flex items-start">
               <ShieldAlert className="w-5 h-5 mr-2 shrink-0" />
               <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
          </button>
        </form>

      </div>
      
      {/* Footer text */}
      <div className="mt-8 text-center text-xs text-gray-500 relative z-10">
        <p>&copy; {new Date().getFullYear()} Legal Metrology Department. All rights reserved.</p>
        <p className="mt-1">Authorized personnel only.</p>
      </div>
    </div>
  );
};
