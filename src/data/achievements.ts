import { getTotalStats, getWorkoutStreak, getWeeklyTonnage, getPersonalRecords, db, WorkoutSession } from "@/db";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  iconName: string; // The lucide icon name we will pick
  threshold?: number; // target value for progress display
  checkCriteria: (completedSessions: WorkoutSession[]) => Promise<boolean>;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_workout",
    title: "First Steps",
    description: "Complete your first workout.",
    iconName: "Trophy",
    threshold: 1,
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
    threshold: 3,
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
    threshold: 7,
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
    threshold: 10000,
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
    threshold: 100,
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
    checkCriteria: async (completedSessions) => {
      return completedSessions.some((s) => {
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
    threshold: 1,
    checkCriteria: async (completedSessions) => {
      return completedSessions.some((s) => {
        const hour = new Date(s.date).getHours();
        return hour >= 4 && hour < 8;
      });
    },
  },
  {
    id: "14_day_streak",
    title: "Fortnight",
    description: "Reach a 14-day workout streak.",
    iconName: "Flame",
    threshold: 14,
    checkCriteria: async () => {
      const streak = await getWorkoutStreak();
      return streak >= 14;
    },
  },
  {
    id: "30_day_streak",
    title: "Iron Will",
    description: "Reach a 30-day workout streak.",
    iconName: "Flame",
    threshold: 30,
    checkCriteria: async () => {
      const streak = await getWorkoutStreak();
      return streak >= 30;
    },
  },
  {
    id: "25_workouts",
    title: "Quarterback",
    description: "Complete 25 workouts total.",
    iconName: "Dumbbell",
    threshold: 25,
    checkCriteria: async () => {
      const stats = await getTotalStats();
      return stats.totalWorkouts >= 25;
    },
  },
  {
    id: "50k_tonnage",
    title: "Powerlifter",
    description: "Reach 50,000 kg total volume in a single week.",
    iconName: "Dumbbell",
    threshold: 50000,
    checkCriteria: async () => {
      const tonnage = await getWeeklyTonnage(8);
      return tonnage.some((w) => w.tonnage >= 50000);
    },
  },
  {
    id: "250_workouts",
    title: "Legend",
    description: "Complete 250 workouts total.",
    iconName: "Award",
    threshold: 250,
    checkCriteria: async () => {
      const stats = await getTotalStats();
      return stats.totalWorkouts >= 250;
    },
  },
  {
    id: "10_prs",
    title: "Record Breaker",
    description: "Set 10 personal records.",
    iconName: "Trophy",
    threshold: 10,
    checkCriteria: async () => {
      const prs = await getPersonalRecords();
      return prs.length >= 10;
    },
  },
  {
    id: "weekend_warrior",
    title: "Weekend Warrior",
    description: "Complete workouts on both Saturday and Sunday.",
    iconName: "Trophy",
    threshold: 2,
    checkCriteria: async (completedSessions) => {
      const hasSat = completedSessions.some((s) => new Date(s.date).getDay() === 6);
      const hasSun = completedSessions.some((s) => new Date(s.date).getDay() === 0);
      return hasSat && hasSun;
    },
  },
];
