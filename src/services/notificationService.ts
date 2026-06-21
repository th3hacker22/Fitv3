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
 * Send a notification of the specified type.
 * Only sends if notifications are enabled and permitted.
 */
export function sendNotification(
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
  sendNotification(
    "pr_celebration",
    `New PR: ${exerciseName} — ${weight}kg × ${reps} reps!`
  );
}

/**
 * Send a streak warning notification.
 */
export function sendStreakWarning(streak: number): void {
  sendNotification(
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
    const existing = (window as unknown as { __pulseNotifInterval?: number }).__pulseNotifInterval;
    if (existing) clearInterval(existing);

    // Set up hourly check
    const interval = setInterval(checkWorkoutReminder, 60 * 60 * 1000);
    (window as unknown as { __pulseNotifInterval?: ReturnType<typeof setInterval> }).__pulseNotifInterval = interval;
  }
}

/**
 * Check if a workout reminder should be sent.
 * Sends if:
 * - Workout reminders are enabled (separate from general notifications)
 * - It's between 8 AM and 8 PM
 * - Today is a planned workout day (based on daysPerWeek spread across the week)
 * - No workout has been completed today
 * - User hasn't been notified in the last 4 hours
 */
function checkWorkoutReminder(): void {
  if (!isNotificationsEnabled()) return;

  // Check workout reminders toggle (stored in localStorage by useSettingsStore)
  const settingsRaw = localStorage.getItem("pulse-settings");
  if (settingsRaw) {
    try {
      const settings = JSON.parse(settingsRaw);
      if (settings.state && settings.state.workoutReminders === false) return;
    } catch { /* default to enabled */ }
  }

  const hour = new Date().getHours();
  if (hour < 8 || hour > 20) return; // Only during waking hours

  // Check last notification time (4-hour cooldown)
  const lastNotif = localStorage.getItem("pulse_last_workout_notif");
  const now = Date.now();
  if (lastNotif) {
    const elapsed = now - parseInt(lastNotif);
    if (elapsed < 4 * 60 * 60 * 1000) return; // 4 hours
  }

  // Check if today is a planned workout day
  if (!isPlannedWorkoutDay()) return;

  // Check if user already trained today (stored by HomePage on load)
  const trainedToday = localStorage.getItem("pulse_trained_today");
  if (trainedToday === "true") return;

  // Get streak for personalized text
  const streak = parseInt(localStorage.getItem("pulse_streak_count") || "0");

  // Send with streak text
  const body = streak > 0
    ? `Your ${streak}-day streak is waiting. Don't break the chain!`
    : "Your workout is waiting. Let's crush today's session.";
  sendNotification("workout_reminder", body);
  localStorage.setItem("pulse_last_workout_notif", String(now));
}

/**
 * Check if today is a planned workout day based on daysPerWeek.
 * Spreads workout days evenly across the week starting from Monday.
 * e.g., 3 days/week → Mon/Wed/Fri. 4 days → Mon/Tue/Thu/Fri.
 */
function isPlannedWorkoutDay(): boolean {
  const storedDays = localStorage.getItem(WORKOUT_DAYS_KEY);
  const daysPerWeek = storedDays ? parseInt(storedDays) : 3;
  if (daysPerWeek >= 7) return true; // every day

  const today = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Convert to Monday-first index: Mon=0, Tue=1, ..., Sun=6
  const dayIdx = today === 0 ? 6 : today - 1;

  // Spread days evenly: for N days, workout on days where (dayIdx * N) % 7 < N
  // This gives an even spread: 3 days → 0,2,4 (Mon, Wed, Fri)
  // 4 days → 0,1,3,4 (Mon, Tue, Thu, Fri)
  return (dayIdx * daysPerWeek) % 7 < daysPerWeek;
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
