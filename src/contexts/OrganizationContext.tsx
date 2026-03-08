import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Organization } from "@/types/database";

interface OrgContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  setCurrentOrgId: (id: string) => void;
  isLoading: boolean;
  createOrganization: (name: string) => Promise<Organization>;
  hasOrgs: boolean;
}

const OrgContext = createContext<OrgContextType>({
  organizations: [],
  currentOrg: null,
  setCurrentOrgId: () => {},
  isLoading: true,
  createOrganization: async () => { throw new Error('Not ready'); },
  hasOrgs: false,
});

export const useOrganization = () => useContext(OrgContext);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(
    () => localStorage.getItem('currentOrgId')
  );

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ['organizations', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Organization[];
    },
    enabled: !!user,
  });

  // Auto-select first org if none selected
  useEffect(() => {
    if (organizations.length > 0 && (!currentOrgId || !organizations.find(o => o.id === currentOrgId))) {
      setCurrentOrgId(organizations[0].id);
    }
  }, [organizations, currentOrgId]);

  useEffect(() => {
    if (currentOrgId) {
      localStorage.setItem('currentOrgId', currentOrgId);
    }
  }, [currentOrgId]);

  const currentOrg = organizations.find(o => o.id === currentOrgId) || null;

  const createOrganization = async (name: string) => {
    // Use RPC to bypass RLS INSERT+SELECT timing issues
    const { data: orgId, error } = await supabase.rpc('create_organization', { _name: name });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
    setCurrentOrgId(orgId);
    // Return a minimal org object; full data comes from the query refetch
    return { id: orgId, name, slug: '', created_by: user!.id, created_at: '', updated_at: '' } as Organization;
  };

  return (
    <OrgContext.Provider value={{
      organizations,
      currentOrg,
      setCurrentOrgId,
      isLoading,
      createOrganization,
      hasOrgs: organizations.length > 0,
    }}>
      {children}
    </OrgContext.Provider>
  );
}
