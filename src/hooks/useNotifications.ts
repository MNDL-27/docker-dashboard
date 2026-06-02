import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/notification-api";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { Notification as DbNotification } from "../types/database";
import { requestNotificationPermission, sendNativeNotification } from "@/lib/browser-notifications";
import { useViewerState } from "./useViewerState";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"];

export function useNotifications(organizationId: string | null) {
  const queryClient = useQueryClient();
  const previousNotificationsRef = useRef<DbNotification[]>([]);
  const { data: viewer } = useViewerState();
  const canUseNative = viewer?.entitlements?.canUseAdvancedAlerts ?? false;

  const query = useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error("Missing organization ID");
      return api.getNotifications(organizationId);
    },
    enabled: !!organizationId,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Request permission on mount (only if entitlement allows)
  useEffect(() => {
    if (organizationId && canUseNative) {
      void requestNotificationPermission();
    }
  }, [organizationId, canUseNative]);

  // Check for newly arrived notifications to trigger toasts and native alerts
  useEffect(() => {
    if (!query.data) return;

    const previousIds = new Set(previousNotificationsRef.current.map((n) => n.id));
    const newNotifications = query.data.filter((n) => !previousIds.has(n.id));

    // Only notify if this isn't the first load (previous is not empty)
    if (previousNotificationsRef.current.length > 0 && newNotifications.length > 0) {
      newNotifications.forEach((n) => {
        // 1. Trigger In-App Toast (Always allowed)
        const toastFn = n.type === "error" ? toast.error 
          : n.type === "success" ? toast.success 
          : n.type === "warning" ? toast.warning 
          : toast.info;

        toastFn(n.title, {
          description: n.message,
          duration: 5000,
        });

        // 2. Trigger Native Browser Notification (Premium only)
        if (canUseNative) {
          sendNativeNotification(n.title, {
            body: n.message,
            tag: n.id, // Prevent duplicate alerts for the same ID
            data: { link: n.link },
          });
        }
      });
    }

    previousNotificationsRef.current = query.data;
  }, [query.data, canUseNative]);

  return {
    ...query,
    unreadCount: query.data?.length || 0,
  };
}

export function useDismissNotification(organizationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => api.dismissNotification(notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: [...NOTIFICATIONS_QUERY_KEY, organizationId] });
      
      const previous = queryClient.getQueryData<Notification[]>([...NOTIFICATIONS_QUERY_KEY, organizationId]);
      
      // Optimistically remove from list
      if (previous) {
        queryClient.setQueryData<Notification[]>(
          [...NOTIFICATIONS_QUERY_KEY, organizationId],
          previous.filter((n) => n.id !== notificationId)
        );
      }
      
      return { previous };
    },
    onError: (err, newTodo, context) => {
      if (context?.previous) {
        queryClient.setQueryData([...NOTIFICATIONS_QUERY_KEY, organizationId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_QUERY_KEY, organizationId] });
    },
  });
}

export function useDismissAllNotifications(organizationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!organizationId) throw new Error("Missing organization ID");
      return api.dismissAllNotifications(organizationId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: [...NOTIFICATIONS_QUERY_KEY, organizationId] });
      const previous = queryClient.getQueryData<Notification[]>([...NOTIFICATIONS_QUERY_KEY, organizationId]);
      
      // Optimistically clear all
      queryClient.setQueryData<Notification[]>([...NOTIFICATIONS_QUERY_KEY, organizationId], []);
      
      return { previous };
    },
    onError: (err, newTodo, context) => {
      if (context?.previous) {
        queryClient.setQueryData([...NOTIFICATIONS_QUERY_KEY, organizationId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_QUERY_KEY, organizationId] });
    },
  });
}
