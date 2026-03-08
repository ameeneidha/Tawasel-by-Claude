import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'motion/react';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';

export default function Login() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('ameeneidha@gmail.com');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      setUser(res.data.user);
      navigate('/app');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-black/5 p-8"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#25D366]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-6 h-6 text-[#25D366]" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Welcome Back</h1>
          <p className="text-gray-500 mt-2">Sign in to your WhatsApp operations hub</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none transition-all"
                placeholder="name@company.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-[#25D366] hover:bg-[#128C7E] text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500">
            Don't have an account? <span className="text-[#25D366] font-medium cursor-pointer">Contact sales</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
