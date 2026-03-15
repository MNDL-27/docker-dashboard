import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  setSession: (user: User, token: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  setSession: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch('/auth/me')
      .then(data => {
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem('auth_token');
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const signOut = async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  const setSession = (newUser: User, token: string) => {
    localStorage.setItem('auth_token', token);
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}
