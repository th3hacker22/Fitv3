import { create } from "zustand";
import { db, UnlockedAchievement } from "@/db";
import { ACHIEVEMENTS } from "@/data/achievements";
import { pushToCloud } from "@/lib/syncEngine";
import { uid } from "@/utils/id";

interface AchievementsState {
  unlockedList: UnlockedAchievement[];
  newlyUnlocked: string[];
  isLoading: boolean;
  loadUnlocked: () => Promise<void>;
  evaluateAchievements: (userId?: string) => Promise<void>;
  clearNewlyUnlocked: () => void;
}

export const useAchievementsStore = create<AchievementsState>((set, get) => ({
  unlockedList: [],
  newlyUnlocked: [],
  isLoading: false,

  loadUnlocked: async () => {
    set({ isLoading: true });
    try {
      const all = await db.unlockedAchievements.toArray();
      set({ unlockedList: all.filter((a) => !a.deleted), isLoading: false });
    } catch (error) {
      console.error("Failed to load unlocked achievements:", error);
      set({ isLoading: false });
    }
  },

  evaluateAchievements: async (userId?: string) => {
    try {
      const currentUnlocked = await db.unlockedAchievements.toArray();
      const currentIds = new Set(
        currentUnlocked.filter((a) => !a.deleted).map((a) => a.achievementId),
      );

      const newlyUnlockedIds: string[] = [];

      for (const ach of ACHIEVEMENTS) {
        if (currentIds.has(ach.id)) continue;

        const isMet = await ach.checkCriteria();
        if (isMet) {
          const newDoc: UnlockedAchievement = {
            id: uid(),
            achievementId: ach.id,
            unlockedAt: new Date().toISOString(),
            deleted: false,
          };
          await db.unlockedAchievements.add(newDoc);
          newlyUnlockedIds.push(ach.id);
        }
      }

      if (newlyUnlockedIds.length > 0) {
        const newRecords = await db.unlockedAchievements
          .where("achievementId")
          .anyOf(newlyUnlockedIds)
          .toArray();
        set((state) => ({
          unlockedList: [...state.unlockedList, ...newRecords],
          newlyUnlocked: [...state.newlyUnlocked, ...newlyUnlockedIds],
        }));
        if (userId) {
          pushToCloud(userId).catch(console.error);
        }
      }
    } catch (error) {
      console.error("Failed to evaluate achievements:", error);
    }
  },

  clearNewlyUnlocked: () => set({ newlyUnlocked: [] }),
}));
