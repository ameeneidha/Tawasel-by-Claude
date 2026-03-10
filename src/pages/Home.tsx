import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import axios from 'axios';
import { motion } from 'motion/react';
import { 
  Check, 
  MessageSquare, 
  Zap, 
  Shield, 
  ArrowRight, 
  LogIn, 
  Mail, 
  Lock, 
  Loader2,
  Globe,
  BarChart3,
  Users
} from 'lucide-react';

const PRICING_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'AED 99',
    description: 'Essential tools for small businesses.',
    features: [
      '1 WhatsApp Number',
      '1 Instagram Account',
      '1 AI Chatbot',
      '1 User',
      'Standard Support'
    ],
    buttonText: 'Get Started',
    highlight: false
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 'AED 299',
    description: 'Perfect for growing teams and automation.',
    features: [
      '2 WhatsApp Numbers',
      '1 Instagram Account',
      '3 AI Chatbots',
      '3 Users',
      'Priority Support'
    ],
    buttonText: 'Get Started',
    highlight: true
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'AED 599',
    description: 'Advanced features for high-volume operations.',
    features: [
      '5 WhatsApp Numbers',
      '2 Instagram Accounts',
      '10 AI Chatbots',
      '5 Users',
      '24/7 Priority Support'
    ],
    buttonText: 'Get Started',
    highlight: false
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    description: 'Tailored solutions for large scale needs.',
    features: [
      'Custom Channels',
      'Custom Bots',
      '10+ Users',
      'Advanced Integrations',
      'Dedicated Manager'
    ],
    buttonText: 'Contact Sales',
    highlight: false
  }
];

export default function Home() {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      setUser(res.data.user, res.data.token);
      navigate('/app');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#25D366]/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#25D366] rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">WABA Hub</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-[#25D366] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#25D366] transition-colors">Pricing</a>
            <a href="#login" className="px-4 py-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors">Sign In</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] text-xs font-bold uppercase tracking-wider mb-6">
              <Zap className="w-3 h-3" />
              Next-Gen WhatsApp CRM
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
              Automate your <span className="text-[#25D366]">WhatsApp</span> operations.
            </h1>
            <p className="text-xl text-slate-600 mb-8 max-w-lg leading-relaxed">
              Connect with customers, automate support with AI, and scale your business using the world's most popular messaging platform.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="#pricing" className="px-8 py-4 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#128C7E] transition-all shadow-lg shadow-[#25D366]/20 flex items-center gap-2">
                View Pricing <ArrowRight className="w-5 h-5" />
              </a>
              <div className="flex -space-x-2 items-center">
                {[1, 2, 3, 4].map(i => (
                  <img 
                    key={i}
                    src={`https://picsum.photos/seed/user${i}/100/100`} 
                    className="w-10 h-10 rounded-full border-2 border-white"
                    alt="User"
                    referrerPolicy="no-referrer"
                  />
                ))}
                <span className="ml-4 text-sm font-medium text-slate-500">Trusted by 2,000+ teams</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            id="login"
            className="bg-slate-50 rounded-3xl p-8 lg:p-12 border border-slate-200"
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">Sign in to Hub</h2>
              <p className="text-slate-500">Access your dashboard and conversations</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none transition-all"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none transition-all"
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
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    Sign In <LogIn className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need to scale</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Powerful tools designed to help you manage thousands of conversations without breaking a sweat.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Globe, title: 'Multi-Channel', desc: 'Manage WhatsApp, Instagram, and Web Chat in one unified inbox.' },
              { icon: Zap, title: 'AI Automation', desc: 'Deploy smart chatbots that handle 80% of routine inquiries automatically.' },
              { icon: BarChart3, title: 'Deep Analytics', desc: 'Track response times, agent performance, and customer satisfaction.' },
              { icon: Users, title: 'Team Collaboration', desc: 'Assign conversations, add internal notes, and work together seamlessly.' },
              { icon: Shield, title: 'Enterprise Secure', desc: 'Bank-grade encryption and full compliance with data regulations.' },
              { icon: MessageSquare, title: 'Broadcasts', desc: 'Send personalized bulk messages to your customers with high open rates.' }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className="w-12 h-12 bg-[#25D366]/10 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-[#25D366]" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-slate-600">Choose the plan that's right for your business growth.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING_PLANS.map((plan) => (
              <div 
                key={plan.id}
                className={`relative p-8 rounded-3xl border transition-all ${
                  plan.highlight 
                    ? 'border-[#25D366] bg-white shadow-2xl scale-105 z-10' 
                    : 'border-slate-200 bg-slate-50 hover:bg-white hover:shadow-xl'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.price !== 'Custom' && <span className="text-slate-500 font-medium">/mo</span>}
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-[#25D366]" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button className={`w-full py-4 rounded-xl font-bold transition-all ${
                  plan.highlight
                    ? 'bg-[#25D366] text-white hover:bg-[#128C7E] shadow-lg shadow-[#25D366]/20'
                    : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                }`}>
                  {plan.buttonText}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-[#25D366] rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">WABA Hub</span>
            </div>
            <p className="text-slate-400 max-w-sm mb-8">
              The ultimate platform for WhatsApp Business automation and customer engagement.
            </p>
            <div className="flex gap-4">
              {/* Social placeholders */}
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-[#25D366] transition-colors cursor-pointer">
                <Globe className="w-5 h-5" />
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-[#25D366] transition-colors cursor-pointer">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-6">Product</h4>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6">Company</h4>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-20 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
          © {new Date().getFullYear()} WABA Hub. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
