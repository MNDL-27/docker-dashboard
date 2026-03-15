import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
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
      return (await apiFetch('/organizations')) as Organization[];
    },
    enabled: !!user,
  });

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
    const data = await apiFetch('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
    setCurrentOrgId(data.id);
    return { id: data.id, name, slug: '', created_by: user!.id, created_at: '', updated_at: '' } as Organization;
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
