import {
  getTotalStats,
  getWorkoutStreak,
  getWeeklyTonnage,
  getPersonalRecords,
  db,
} from "@/db";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  iconName: string; // The lucide icon name we will pick
  checkCriteria: () => Promise<boolean>;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_workout",
    title: "First Steps",
    description: "Complete your first workout.",
    iconName: "Trophy",
    checkCriteria: async () => {
      const stats = await getTotalStats();
      return stats.totalWorkouts >= 1;
    },
  },
  {
    id: "3_day_streak",
    title: "Momentum",
    description: "Reach a 3-day workout streak.",
    iconName: "Flame",
    checkCriteria: async () => {
      const streak = await getWorkoutStreak();
      return streak >= 3;
    },
  },
  {
    id: "7_day_streak",
    title: "Unstoppable",
    description: "Reach a 7-day workout streak.",
    iconName: "Flame",
    checkCriteria: async () => {
      const streak = await getWorkoutStreak();
      return streak >= 7;
    },
  },
  {
    id: "10k_tonnage",
    title: "Heavy Lifter",
    description: "Reach 10,000 kg total volume in a single week.",
    iconName: "Dumbbell",
    checkCriteria: async () => {
      const tonnage = await getWeeklyTonnage(8); // Check last 8 weeks
      return tonnage.some((w) => w.tonnage >= 10000);
    },
  },
  {
    id: "100_workouts",
    title: "Centurion",
    description: "Complete 100 workouts total.",
    iconName: "Award",
    checkCriteria: async () => {
      const stats = await getTotalStats();
      return stats.totalWorkouts >= 100;
    },
  },
  {
    id: "night_owl",
    title: "Night Owl",
    description: "Complete a workout between 12 AM and 4 AM.",
    iconName: "Moon",
    checkCriteria: async () => {
      const sessions = await db.workoutSessions
        .filter((s) => s.completed === true)
        .toArray();
      return sessions.some((s) => {
        const hour = new Date(s.date).getHours();
        return hour >= 0 && hour < 4;
      });
    },
  },
  {
    id: "early_bird",
    title: "Early Bird",
    description: "Complete a workout between 4 AM and 8 AM.",
    iconName: "Sun",
    checkCriteria: async () => {
      const sessions = await db.workoutSessions
        .filter((s) => s.completed === true)
        .toArray();
      return sessions.some((s) => {
        const hour = new Date(s.date).getHours();
        return hour >= 4 && hour < 8;
      });
    },
  },
];
