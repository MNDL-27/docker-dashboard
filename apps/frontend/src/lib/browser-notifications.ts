/**
 * Utility for managing native browser notifications.
 */

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications");
    return "denied";
  }

  if (Notification.permission === "default") {
    return await Notification.requestPermission();
  }

  return Notification.permission;
}

export function sendNativeNotification(title: string, options?: NotificationOptions) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }

  // Use a default icon if none provided
  const notificationOptions: NotificationOptions = {
    icon: "/favicon.ico",
    badge: "/pwa-icon-192.png",
    ...options,
  };

  try {
    const notification = new Notification(title, notificationOptions);
    
    notification.onclick = () => {
      window.focus();
      if (options?.data?.link) {
        window.location.href = options.data.link;
      }
      notification.close();
    };

    return notification;
  } catch (err) {
    console.error("Failed to send native notification:", err);
    return null;
  }
}
