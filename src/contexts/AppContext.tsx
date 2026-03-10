import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface AppContextType {
  user: User | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setUser: (user: User | null) => void;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      // Verify user still exists and get fresh data
      axios.get(`/api/users/${parsedUser.id}`).then(res => {
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
        fetchWorkspaces(res.data.id);
      }).catch(() => {
        // If user not found, clear session
        setUser(null);
        localStorage.removeItem('user');
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
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

  const handleSetUser = (u: User | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem('user', JSON.stringify(u));
      fetchWorkspaces(u.id);
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('activeWorkspaceId');
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

  return (
    <AppContext.Provider value={{ 
      user, 
      workspaces, 
      activeWorkspace, 
      setUser: handleSetUser, 
      setActiveWorkspace: handleSetActiveWorkspace,
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
