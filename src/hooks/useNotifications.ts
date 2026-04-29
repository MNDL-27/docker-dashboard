import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/notification-api";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { Notification } from "../types/database";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"];

export function useNotifications(organizationId: string | null) {
  const queryClient = useQueryClient();
  const previousNotificationsRef = useRef<Notification[]>([]);

  const query = useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error("Missing organization ID");
      return api.getNotifications(organizationId);
    },
    enabled: !!organizationId,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Check for newly arrived notifications to trigger toasts
  useEffect(() => {
    if (!query.data) return;

    const previousIds = new Set(previousNotificationsRef.current.map((n) => n.id));
    const newNotifications = query.data.filter((n) => !previousIds.has(n.id));

    // Only toast if this isn't the first load (previous is not empty)
    if (previousNotificationsRef.current.length > 0 && newNotifications.length > 0) {
      newNotifications.forEach((n) => {
        // Find the right toast type
        const toastFn = n.type === "error" ? toast.error 
          : n.type === "success" ? toast.success 
          : n.type === "warning" ? toast.warning 
          : toast.info;

        toastFn(n.title, {
          description: n.message,
          duration: 5000,
        });
      });
    }

    previousNotificationsRef.current = query.data;
  }, [query.data]);

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
