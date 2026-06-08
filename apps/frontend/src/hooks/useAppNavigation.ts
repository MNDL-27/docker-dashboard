import { useMemo } from "react";
import { useViewerState } from "@/hooks/useViewerState";
import { appNavGroups, type AppNavGroup } from "@/components/layout/app-nav";

/**
 * Single source of truth for application navigation.
 * Filters links based on user permissions (Platform Admin) and plan entitlements.
 */
export function useAppNavigation() {
  const { data: viewer } = useViewerState();
  const entitlements = viewer?.entitlements;

  const filteredGroups = useMemo(() => {
    return appNavGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        // 1. Hide Admin for non-platform-admins
        if (item.href === "/app/admin" && !viewer?.is_platform_admin) {
          return false;
        }
        
        // Potential future: hide based on dedicated deployment status or other flags
        
        return true;
      }),
    }));
  }, [viewer?.is_platform_admin]);

  return {
    navGroups: filteredGroups as AppNavGroup[],
    entitlements,
  };
}
