import { db as firestoreDb } from "@/lib/firebase";
import { db as dexieDb } from "@/db/index";
import { doc, collection, getDocs, writeBatch } from "firebase/firestore";
import { useToastStore } from "@/store/useToastStore";

const COLLECTION_MAP = {
  workoutSessions: "workouts",
  bodyMeasurements: "measurements",
  routines: "routines",
  foodEntries: "foodEntries",
  nutritionGoals: "nutritionGoals",
  unlockedAchievements: "unlockedAchievements",
};

export async function pushToCloud(userId: string) {
  if (!firestoreDb) return;

  try {
    for (const [localTable, remoteCollection] of Object.entries(
      COLLECTION_MAP,
    )) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = await (dexieDb as any)[localTable].toArray();
      let batch = writeBatch(firestoreDb);
      let count = 0;

      for (const record of records) {
        if (!record.id) continue;
        const docRef = doc(
          firestoreDb,
          `users/${userId}/${remoteCollection}/${record.id}`,
        );
        batch.set(docRef, record);
        count++;

        if (count >= 450) {
          await batch.commit();
          batch = writeBatch(firestoreDb);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }
    }
  } catch (err) {
    console.error("Push to cloud failed:", err);
    useToastStore
      .getState()
      .addToast("error", "Sync to cloud failed, will retry later.");
    throw err;
  }
}

export async function pullFromCloud(userId: string) {
  if (!firestoreDb) return;

  try {
    for (const [localTable, remoteCollection] of Object.entries(
      COLLECTION_MAP,
    )) {
      const snapshot = await getDocs(
        collection(firestoreDb, `users/${userId}/${remoteCollection}`),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const localCollection = (dexieDb as any)[localTable];
      const toPut: any[] = [];
      const toDelete: string[] = [];

      const localRecordsArr = await localCollection.toArray();
      const localRecords = new Map(localRecordsArr.map((r: any) => [r.id, r]));

      snapshot.forEach((docSnap) => {
        const remoteRecord = docSnap.data() as any;
        const localRecord = localRecords.get(remoteRecord.id) as any;

        // Last write wins
        if (
          !localRecord ||
          new Date(remoteRecord.updatedAt || 0).getTime() >
            new Date(localRecord.updatedAt || 0).getTime()
        ) {
          if (remoteRecord.deleted) {
            toDelete.push(remoteRecord.id);
          } else {
            toPut.push(remoteRecord);
          }
        }
      });

      if (toPut.length > 0) {
        await localCollection.bulkPut(toPut);
      }
      if (toDelete.length > 0) {
        await localCollection.bulkDelete(toDelete);
      }
    }
  } catch (err) {
    console.error("Pull from cloud failed:", err);
    useToastStore.getState().addToast("error", "Sync from cloud failed.");
    throw err;
  }
}

export async function syncAll(userId: string) {
  if (!firestoreDb) return;
  try {
    await pullFromCloud(userId);
    await pushToCloud(userId);
  } catch (err) {
    console.error("Sync all failed:", err);
  }
}
