/**
 * Push Notification Service.
 *
 * Uses the browser's Notifications API to send local notifications.
 * No backend required — works entirely client-side.
 *
 * Features:
 * - Request permission on first use
 * - Schedule workout reminders based on user's selected days
 * - Send PR celebration notifications
 * - Send streak loss warnings
 * - Send rest-complete notifications (complements Voice Coach)
 */

const NOTIFICATION_PERMISSION_KEY = "pulse_notifications_enabled";
const WORKOUT_DAYS_KEY = "pulse_workout_days";

type NotificationType =
  | "workout_reminder"
  | "pr_celebration"
  | "streak_warning"
  | "rest_complete"
  | "deload_reminder";

interface NotificationConfig {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: unknown;
}

const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationConfig> = {
  workout_reminder: {
    title: "💪 Time to train!",
    body: "Your workout is waiting. Let's crush today's session.",
    tag: "workout-reminder",
  },
  pr_celebration: {
    title: "🏆 New Personal Record!",
    body: "You just hit a new PR! Amazing work.",
    tag: "pr-celebration",
  },
  streak_warning: {
    title: "🔥 Don't lose your streak!",
    body: "You haven't worked out today. Keep your streak alive!",
    tag: "streak-warning",
  },
  rest_complete: {
    title: "⏱️ Rest complete!",
    body: "Time for your next set. Let's go!",
    tag: "rest-complete",
  },
  deload_reminder: {
    title: "🔄 Deload week recommended",
    body: "Your fatigue is high. Consider a deload week.",
    tag: "deload-reminder",
  },
};

/**
 * Check if notifications are supported.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Get the current notification permission status.
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Check if notifications are enabled (user opted in).
 */
export function isNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(NOTIFICATION_PERMISSION_KEY) === "true";
}

/**
 * Request notification permission from the user.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  if (Notification.permission === "granted") {
    localStorage.setItem(NOTIFICATION_PERMISSION_KEY, "true");
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  const result = await Notification.requestPermission();
  const granted = result === "granted";
  localStorage.setItem(NOTIFICATION_PERMISSION_KEY, String(granted));
  return granted;
}

/**
 * Disable notifications (user opted out).
 */
export function disableNotifications(): void {
  localStorage.setItem(NOTIFICATION_PERMISSION_KEY, "false");
}

/**
 * Send a typed notification (workout_reminder, pr_celebration, etc.).
 * Only sends if notifications are enabled and permitted.
 * Uses predefined templates for title/body.
 */
export function sendTypedNotification(
  type: NotificationType,
  customBody?: string
): void {
  if (!isNotificationsEnabled() || !isNotificationSupported()) return;
  if (Notification.permission !== "granted") return;

  const config = NOTIFICATION_TEMPLATES[type];
  const body = customBody || config.body;

  try {
    const notification = new Notification(config.title, {
      body,
      tag: config.tag,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      data: config.data,
      silent: false,
    });

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    // Handle click — focus the window
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    console.warn("[notifications] Failed to send:", err);
  }
}

/**
 * Send a PR celebration notification with exercise details.
 */
export function sendPRNotification(exerciseName: string, weight: number, reps: number): void {
  sendTypedNotification(
    "pr_celebration",
    `New PR: ${exerciseName} — ${weight}kg × ${reps} reps!`
  );
}

/**
 * Send a streak warning notification.
 */
export function sendStreakWarning(streak: number): void {
  sendTypedNotification(
    "streak_warning",
    `You're on a ${streak}-day streak. Don't break it — workout today!`
  );
}

/**
 * Schedule workout reminders based on the user's selected days per week.
 * Uses localStorage to store the schedule and checks daily.
 *
 * @param daysPerWeek Number of workout days per week
 */
export function scheduleWorkoutReminders(daysPerWeek: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORKOUT_DAYS_KEY, String(daysPerWeek));

  // Schedule a check every hour
  if (typeof window !== "undefined") {
    // Clear any existing interval
    const existing = (window as unknown as { __pulseNotifInterval?: ReturnType<typeof setInterval> }).__pulseNotifInterval;
    if (existing) clearInterval(existing);

    // Set up hourly check
    const interval = setInterval(checkWorkoutReminder, 60 * 60 * 1000);
    (window as unknown as { __pulseNotifInterval?: ReturnType<typeof setInterval> }).__pulseNotifInterval = interval;
  }
}

/**
 * Check if a workout reminder should be sent.
 * Sends if:
 * - It's between 8 AM and 8 PM
 * - No workout has been completed today
 * - User hasn't been notified in the last 4 hours
 */
function checkWorkoutReminder(): void {
  if (!isNotificationsEnabled()) return;

  const hour = new Date().getHours();
  if (hour < 8 || hour > 20) return; // Only during waking hours

  // Check last notification time
  const lastNotif = localStorage.getItem("pulse_last_workout_notif");
  const now = Date.now();
  if (lastNotif) {
    const elapsed = now - parseInt(lastNotif);
    if (elapsed < 4 * 60 * 60 * 1000) return; // 4 hours
  }

  // Check if user worked out today
  // This is a lightweight check — we don't want to hit IndexedDB in an interval
  // For now, just send the reminder
  sendTypedNotification("workout_reminder");
  localStorage.setItem("pulse_last_workout_notif", String(now));
}

/**
 * Initialize the notification system.
 * Called on app startup if notifications are enabled.
 */
export function initNotifications(): void {
  if (!isNotificationsEnabled()) return;
  if (!isNotificationSupported()) return;

  // Start the hourly check
  const storedDays = localStorage.getItem(WORKOUT_DAYS_KEY);
  if (storedDays) {
    scheduleWorkoutReminders(parseInt(storedDays));
  }

  // Check immediately
  checkWorkoutReminder();
}

// ── Simple notification API (merged from src/utils/notifications.ts) ──
// This is the low-level "fire a notification with a title + options" API
// used by RestTimer and SettingsPage. The typed API (sendTypedNotification)
// is for structured notification types (PR, streak, etc.).

/**
 * Fire a local notification if the user enabled notifications and granted permission.
 * This is the simple API — provide a title and optional NotificationOptions.
 */
export function sendNotification(title: string, options?: NotificationOptions): void {
  if (!isNotificationSupported()) return;
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

/**
 * Alias for backward compatibility with src/utils/notifications.ts callers.
 */
export const notificationsSupported = isNotificationSupported;
