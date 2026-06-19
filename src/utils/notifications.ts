// Browser notification helpers for Pulse.
// Handles permission requests and firing local notifications for workout events
// (e.g. rest timer finished). Respects the user's notification setting.

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Request permission from the browser. Returns true only if granted.
 * Should be called from a user gesture (e.g. toggling the setting on).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

/**
 * Fire a local notification if the user enabled notifications and granted permission.
 */
export function sendNotification(title: string, options?: NotificationOptions) {
  if (!notificationsSupported()) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      ...options,
    });
  } catch {
    // Some browsers require a ServiceWorkerRegistration for notifications;
    // fail silently if direct construction is not allowed.
  }
}
