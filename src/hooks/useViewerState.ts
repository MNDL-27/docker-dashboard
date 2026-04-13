import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ViewerState {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_approved: boolean;
  has_orgs: boolean;
  needs_onboarding: boolean;
  onboarding_status: string | null;
  active_org_id: string | null;
  active_org_clerk_id: string | null;
  is_platform_admin: boolean;
  is_suspended: boolean;
  is_hard_disabled: boolean;
}

export function useViewerState() {
  return useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const data = await apiFetch('/auth/me');
      return data.user as ViewerState;
    },
    retry: false,
    staleTime: 30_000,
  });
}
