import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionCurrentPeriodEnd?: string | null;
  subscriptionCancelAtPeriodEnd?: boolean;
}

interface AppContextType {
  user: User | null;
  token: string | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  hasVerifiedEmail: boolean;
  hasActiveSubscription: boolean;
  hasFullAccess: boolean;
  setUser: (user: User | null, token: string | null) => void;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  verifyEmail: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedToken) {
      const parsedUser = JSON.parse(savedUser);
      setToken(savedToken);
      
      // Configure axios with token
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      
      // Verify user still exists and get fresh data
      axios.get(`/api/users/${parsedUser.id}`).then(res => {
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
        fetchWorkspaces(res.data.id);
      }).catch(() => {
        // If user not found or token invalid, clear session
        handleSetUser(null, null);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    // Add interceptor for 401 errors
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          handleSetUser(null, null);
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const fetchWorkspaces = async (userId: string) => {
    try {
      const res = await axios.get(`/api/workspaces?userId=${userId}`);
      const data = Array.isArray(res.data) ? res.data : [];
      console.log('Workspaces fetched:', data.length);
      setWorkspaces(data);
      if (data.length > 0) {
        const savedWsId = localStorage.getItem('activeWorkspaceId');
        const ws = data.find((w: Workspace) => w.id === savedWsId) || data[0];
        console.log('Setting active workspace:', ws.name);
        setActiveWorkspace(ws);
      } else {
        console.warn('No workspaces found for user:', userId);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetUser = (u: User | null, t: string | null) => {
    setUser(u);
    setToken(t);
    if (u && t) {
      localStorage.setItem('user', JSON.stringify(u));
      localStorage.setItem('token', t);
      axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
      fetchWorkspaces(u.id);
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('activeWorkspaceId');
      delete axios.defaults.headers.common['Authorization'];
      setWorkspaces([]);
      setActiveWorkspace(null);
    }
  };

  const handleSetActiveWorkspace = (ws: Workspace | null) => {
    setActiveWorkspace(ws);
    if (ws) {
      localStorage.setItem('activeWorkspaceId', ws.id);
    } else {
      localStorage.removeItem('activeWorkspaceId');
    }
  };

  const verifyEmail = async () => {
    try {
      const res = await axios.post('/api/auth/verify-email');
      if (res.data.success) {
        const updatedUser = { ...user!, emailVerified: true };
        setUser(updatedUser, token);
      }
    } catch (error) {
      console.error('Failed to verify email', error);
      throw error;
    }
  };

  const refreshWorkspaces = async () => {
    if (!user) return;
    await fetchWorkspaces(user.id);
  };

  const hasVerifiedEmail = !!user?.emailVerified;
  const hasActiveSubscription = ['active', 'trialing'].includes((activeWorkspace?.subscriptionStatus || '').toLowerCase());
  const hasFullAccess = hasVerifiedEmail && hasActiveSubscription;

  return (
    <AppContext.Provider value={{ 
      user, 
      token,
      workspaces, 
      activeWorkspace, 
      hasVerifiedEmail,
      hasActiveSubscription,
      hasFullAccess,
      setUser: handleSetUser, 
      setActiveWorkspace: handleSetActiveWorkspace,
      verifyEmail,
      refreshWorkspaces,
      isLoading 
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
