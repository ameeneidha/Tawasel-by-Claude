import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

interface VerificationRequestResult {
  success: boolean;
  message: string;
  emailSent?: boolean;
  verificationUrl?: string;
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

interface ConnectedAccount {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  token: string;
  lastUsedAt: string;
  lastWorkspaceId?: string | null;
}

interface AppContextType {
  user: User | null;
  token: string | null;
  connectedAccounts: ConnectedAccount[];
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isSuperadmin: boolean;
  hasVerifiedEmail: boolean;
  hasActiveSubscription: boolean;
  hasFullAccess: boolean;
  setUser: (user: User | null, token: string | null) => void;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  switchAccount: (accountId: string) => Promise<void>;
  logout: () => void;
  signOutAllAccounts: () => void;
  requestEmailVerification: () => Promise<VerificationRequestResult>;
  refreshWorkspaces: () => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
const CONNECTED_ACCOUNTS_STORAGE_KEY = 'connectedAccounts';
const isSuperadminUser = (user: User | null) => (user?.email || '').toLowerCase() === SUPERADMIN_EMAIL;

const sanitizeConnectedAccount = (value: any): ConnectedAccount | null => {
  if (!value || typeof value !== 'object') return null;

  const id = String(value.id || '').trim();
  const email = String(value.email || '').trim();
  const token = String(value.token || '').trim();

  if (!id || !email || !token) {
    return null;
  }

  return {
    id,
    name: String(value.name || '').trim() || email.split('@')[0] || 'Account',
    email,
    emailVerified: Boolean(value.emailVerified),
    token,
    lastUsedAt: String(value.lastUsedAt || new Date(0).toISOString()),
    lastWorkspaceId: value.lastWorkspaceId ? String(value.lastWorkspaceId) : null,
  };
};

const readConnectedAccounts = (): ConnectedAccount[] => {
  try {
    const raw = localStorage.getItem(CONNECTED_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => sanitizeConnectedAccount(item))
      .filter((item): item is ConnectedAccount => Boolean(item))
      .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
  } catch {
    return [];
  }
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>(() => readConnectedAccounts());
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistConnectedAccounts = (accounts: ConnectedAccount[]) => {
    const sorted = [...accounts].sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
    setConnectedAccounts(sorted);
    if (sorted.length > 0) {
      localStorage.setItem(CONNECTED_ACCOUNTS_STORAGE_KEY, JSON.stringify(sorted));
    } else {
      localStorage.removeItem(CONNECTED_ACCOUNTS_STORAGE_KEY);
    }
  };

  const updateConnectedAccounts = (
    updater: (current: ConnectedAccount[]) => ConnectedAccount[]
  ) => {
    const next = updater(readConnectedAccounts());
    persistConnectedAccounts(next);
    return next;
  };

  const upsertConnectedAccount = (
    nextUser: User,
    nextToken: string,
    lastWorkspaceId?: string | null,
  ) => {
    updateConnectedAccounts((current) => {
      const nextAccount: ConnectedAccount = {
        id: nextUser.id,
        name: nextUser.name || nextUser.email.split('@')[0] || 'Account',
        email: nextUser.email,
        emailVerified: !!nextUser.emailVerified,
        token: nextToken,
        lastUsedAt: new Date().toISOString(),
        lastWorkspaceId: lastWorkspaceId ?? current.find((item) => item.id === nextUser.id)?.lastWorkspaceId ?? null,
      };

      return [
        nextAccount,
        ...current.filter((item) => item.id !== nextUser.id),
      ];
    });
  };

  const clearSessionState = () => {
    setUser(null);
    setToken(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('activeWorkspaceId');
    delete axios.defaults.headers.common['Authorization'];
  };

  const logout = () => {
    clearSessionState();
    setIsLoading(false);
  };

  const signOutAllAccounts = () => {
    clearSessionState();
    persistConnectedAccounts([]);
    setIsLoading(false);
  };

  const removeConnectedAccount = (accountId?: string | null) => {
    const normalizedId = String(accountId || '').trim();
    if (!normalizedId) return;
    updateConnectedAccounts((current) => current.filter((item) => item.id !== normalizedId));
  };

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
        upsertConnectedAccount(
          res.data,
          savedToken,
          localStorage.getItem('activeWorkspaceId'),
        );
        if (isSuperadminUser(res.data)) {
          setWorkspaces([]);
          setActiveWorkspace(null);
          setIsLoading(false);
        } else {
          fetchWorkspaces(res.data.id, localStorage.getItem('activeWorkspaceId'));
        }
      }).catch(() => {
        // If user not found or token invalid, clear session
        removeConnectedAccount(parsedUser.id);
        clearSessionState();
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
          const savedUserValue = localStorage.getItem('user');
          const savedUserId = savedUserValue ? JSON.parse(savedUserValue)?.id : user?.id;
          removeConnectedAccount(savedUserId);
          clearSessionState();
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const fetchWorkspaces = async (_userId: string, preferredWorkspaceId?: string | null) => {
    try {
      const res = await axios.get('/api/workspaces');
      const data = Array.isArray(res.data) ? res.data : [];
      setWorkspaces(data);
      if (data.length > 0) {
        const savedWsId = preferredWorkspaceId || localStorage.getItem('activeWorkspaceId');
        const ws = data.find((w: Workspace) => w.id === savedWsId) || data[0];
        setActiveWorkspace(ws);
        localStorage.setItem('activeWorkspaceId', ws.id);
      } else {
        setActiveWorkspace(null);
        localStorage.removeItem('activeWorkspaceId');
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
      upsertConnectedAccount(u, t, localStorage.getItem('activeWorkspaceId'));
      if (isSuperadminUser(u)) {
        setWorkspaces([]);
        setActiveWorkspace(null);
        setIsLoading(false);
      } else {
        fetchWorkspaces(u.id, localStorage.getItem('activeWorkspaceId'));
      }
    } else {
      clearSessionState();
      setIsLoading(false);
    }
  };

  const handleSetActiveWorkspace = (ws: Workspace | null) => {
    setActiveWorkspace(ws);
    if (ws) {
      localStorage.setItem('activeWorkspaceId', ws.id);
    } else {
      localStorage.removeItem('activeWorkspaceId');
    }
    if (user && token) {
      updateConnectedAccounts((current) =>
        current.map((account) =>
          account.id === user.id
            ? {
                ...account,
                lastWorkspaceId: ws?.id || null,
                lastUsedAt: new Date().toISOString(),
              }
            : account
        )
      );
    }
  };

  const switchAccount = async (accountId: string) => {
    const nextAccount = readConnectedAccounts().find((item) => item.id === accountId);
    if (!nextAccount || nextAccount.id === user?.id) return;

    setIsLoading(true);
    axios.defaults.headers.common['Authorization'] = `Bearer ${nextAccount.token}`;

    try {
      const res = await axios.get(`/api/users/${nextAccount.id}`);
      const nextUser = res.data as User;
      setUser(nextUser);
      setToken(nextAccount.token);
      localStorage.setItem('user', JSON.stringify(nextUser));
      localStorage.setItem('token', nextAccount.token);
      upsertConnectedAccount(nextUser, nextAccount.token, nextAccount.lastWorkspaceId);

      if (isSuperadminUser(nextUser)) {
        setWorkspaces([]);
        setActiveWorkspace(null);
        localStorage.removeItem('activeWorkspaceId');
        setIsLoading(false);
      } else {
        await fetchWorkspaces(nextUser.id, nextAccount.lastWorkspaceId);
      }
    } catch (error) {
      console.error('Failed to switch account', error);
      removeConnectedAccount(nextAccount.id);
      clearSessionState();
      setIsLoading(false);
      throw error;
    }
  };

  const requestEmailVerification = async () => {
    try {
      const res = await axios.post('/api/auth/verify-email');
      return {
        success: !!res.data?.success,
        message: res.data?.message || 'Verification email is ready.',
        emailSent: !!res.data?.emailSent,
        verificationUrl: res.data?.verificationUrl || '',
      };
    } catch (error) {
      console.error('Failed to verify email', error);
      throw error;
    }
  };

  const refreshWorkspaces = async () => {
    if (!user || isSuperadminUser(user)) return;
    await fetchWorkspaces(user.id, localStorage.getItem('activeWorkspaceId'));
  };

  const isSuperadmin = isSuperadminUser(user);
  const hasVerifiedEmail = !!user?.emailVerified;
  const hasActiveSubscription = ['active', 'trialing'].includes((activeWorkspace?.subscriptionStatus || '').toLowerCase());
  const hasFullAccess = isSuperadmin || (hasVerifiedEmail && hasActiveSubscription);

  return (
    <AppContext.Provider value={{ 
      user, 
      token,
      connectedAccounts,
      workspaces, 
      activeWorkspace, 
      isSuperadmin,
      hasVerifiedEmail,
      hasActiveSubscription,
      hasFullAccess,
      setUser: handleSetUser, 
      setActiveWorkspace: handleSetActiveWorkspace,
      switchAccount,
      logout,
      signOutAllAccounts,
      requestEmailVerification,
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
