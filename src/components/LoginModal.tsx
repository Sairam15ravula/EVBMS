import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Mail, User as UserIcon, Shield, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, register } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('fleet_manager');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isRegisterMode) {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName, role }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Registration failed');

        // Automatically log in after registration
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginResponse.json();
        if (!loginResponse.ok) throw new Error(loginData.detail || 'Login failed');

        register(loginData.access_token, loginData.refresh_token, {
          id: loginData.user_id,
          email: loginData.email,
          role: loginData.role as UserRole,
          fullName,
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      } else {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Invalid email or password');

        login(data.access_token, data.refresh_token, {
          id: data.user_id,
          email: data.email,
          role: data.role as UserRole,
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <Shield className="w-5 h-5" />
              <span>{isRegisterMode ? 'Create Platform Account' : 'Sign In to EV Intelligence'}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-950/50 border border-red-900/80 rounded-lg text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Demo Accounts Selection */}
            {!isRegisterMode && (
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                <span className="text-[11px] font-mono text-slate-400 block uppercase font-bold">
                  Quick Demo Accounts (1-Click Fill):
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('owner@evbms.demo');
                      setPassword('Owner123!');
                    }}
                    className="p-1.5 text-left rounded-lg bg-indigo-950/50 hover:bg-indigo-900/80 border border-indigo-800/60 text-indigo-300 transition"
                  >
                    🚗 <strong>EV Owner</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('fleet@evbms.demo');
                      setPassword('Fleet123!');
                    }}
                    className="p-1.5 text-left rounded-lg bg-cyan-950/50 hover:bg-cyan-900/80 border border-cyan-800/60 text-cyan-300 transition"
                  >
                    📊 <strong>Fleet Operator</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('technician@evbms.demo');
                      setPassword('Tech123!');
                    }}
                    className="p-1.5 text-left rounded-lg bg-purple-950/50 hover:bg-purple-900/80 border border-purple-800/60 text-purple-300 transition"
                  >
                    🔧 <strong>Service Center</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@evbms.demo');
                      setPassword('Admin123!');
                    }}
                    className="p-1.5 text-left rounded-lg bg-emerald-950/50 hover:bg-emerald-900/80 border border-emerald-800/60 text-emerald-300 transition"
                  >
                    🛡️ <strong>Admin</strong>
                  </button>
                </div>
              </div>
            )}

            {isRegisterMode && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Engineering Admin"
                    className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="engineer@fleet.ev"
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {isRegisterMode && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Role Type</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="fleet_manager">Fleet Manager</option>
                  <option value="technician">Battery Technician</option>
                  <option value="driver">EV Driver</option>
                  <option value="admin">System Admin</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 font-semibold rounded-lg text-slate-950 transition flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{submitting ? 'Processing...' : isRegisterMode ? 'Register Account' : 'Sign In'}</span>
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setError(null);
                }}
                className="text-xs text-slate-400 hover:text-emerald-400 transition underline"
              >
                {isRegisterMode ? 'Already have an account? Sign in' : "Don't have an account? Register here"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
