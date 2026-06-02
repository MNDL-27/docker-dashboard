import { apiFetch } from "@/lib/api";
import { Notification as DbNotification } from "../types/database";

const API_BASE = "/notifications";

export const getNotifications = async (
  organizationId: string | null
): Promise<DbNotification[]> => {
  const queryParams = organizationId ? `?organizationId=${organizationId}` : '';
  const response = await apiFetch(`${API_BASE}${queryParams}`) as { notifications: DbNotification[] };
  return response.notifications;
};

export const dismissNotification = async (
  notificationId: string
): Promise<void> => {
  await apiFetch(`${API_BASE}/${notificationId}/dismiss`, {
    method: "POST"
  });
};

export const dismissAllNotifications = async (
  organizationId: string | null
): Promise<void> => {
  await apiFetch(`${API_BASE}/dismiss-all`, {
    method: "POST",
    body: { organizationId },
  });
};

