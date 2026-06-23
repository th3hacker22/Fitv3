/**
 * Sync Engine — Next.js port.
 *
 * The original Vite app used Firebase Firestore for cloud sync. Since this port
 * runs without Firebase, the sync engine persists data locally (Dexie is already
 * persistent) and reports a "synced" state. This keeps the UI functional and the
 * sync indicator meaningful, while all real data stays in IndexedDB.
 *
 * If you later wire up a real backend (e.g. Prisma API routes), replace the
 * no-op bodies below with real fetch() calls to your API.
 */
import { useToastStore } from "@/store/useToastStore";
import { useSyncStore } from "@/store/useSyncStore";

export async function pushToCloud(_userId: string) {
  // Local DB (Dexie/IndexedDB) is the source of truth and already persistent.
  // No remote push in this build.
  return;
}

export async function pullFromCloud(_userId: string) {
  // Nothing to pull — data is local-first.
  return;
}

// In-flight guard: prevents concurrent syncAll calls from racing.
// useBackgroundSync can fire multiple events simultaneously (online +
// visibilitychange), and without this guard, overlapping calls would
// interleave status updates and cause UI flicker.
let syncInFlight = false;

export async function syncAll(userId: string) {
  if (syncInFlight) return; // already syncing — skip
  syncInFlight = true;
  useSyncStore.getState().setStatus("syncing");
  try {
    // Simulate a short sync window for UX feedback.
    await new Promise((r) => setTimeout(r, 300));
    useSyncStore.getState().setStatus("idle");
    useSyncStore.getState().setLastSyncedAt(new Date().toISOString());
  } catch (err) {
    console.error("Sync all failed:", err);
    useSyncStore.getState().setStatus("error");
    useToastStore.getState().addToast("error", "Sync failed.");
  } finally {
    syncInFlight = false;
  }
}

/** Export all local data as a JSON backup (Phase 3 improvement). */
export async function exportLocalBackup() {
  const { db } = await import("@/db");
  const [
    workoutSessions,
    bodyMeasurements,
    progressPhotos,
    routines,
    foodEntries,
    nutritionGoals,
    unlockedAchievements,
    userProfile,
  ] = await Promise.all([
    db.workoutSessions.toArray(),
    db.bodyMeasurements.toArray(),
    db.progressPhotos.toArray(),
    db.routines.toArray(),
    db.foodEntries.toArray(),
    db.nutritionGoals.toArray(),
    db.unlockedAchievements.toArray(),
    db.userProfile.toArray(),
  ]);

  // Photos contain Blobs — convert to base64 for JSON export.
  const photosExport = await Promise.all(
    progressPhotos.map(async (p) => ({
      ...p,
      imageBlob: p.imageBlob ? await blobToBase64(p.imageBlob) : undefined,
      thumbnailBlob: p.thumbnailBlob ? await blobToBase64(p.thumbnailBlob) : undefined,
    }))
  );

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    workoutSessions,
    bodyMeasurements,
    progressPhotos: photosExport,
    routines,
    foodEntries,
    nutritionGoals,
    unlockedAchievements,
    userProfile,
  };
}

/** Import a JSON backup previously created by exportLocalBackup. */
export async function importLocalBackup(backup: {
  workoutSessions?: unknown[];
  bodyMeasurements?: unknown[];
  routines?: unknown[];
  foodEntries?: unknown[];
  nutritionGoals?: unknown[];
  unlockedAchievements?: unknown[];
  progressPhotos?: Array<Record<string, unknown> & { imageBlob?: string }>;
  version?: number;
}) {
  const { db } = await import("@/db");

  if (backup.workoutSessions) await db.workoutSessions.bulkPut(backup.workoutSessions as never[]);
  if (backup.bodyMeasurements) await db.bodyMeasurements.bulkPut(backup.bodyMeasurements as never[]);
  if (backup.routines) await db.routines.bulkPut(backup.routines as never[]);
  if (backup.foodEntries) await db.foodEntries.bulkPut(backup.foodEntries as never[]);
  if (backup.nutritionGoals) await db.nutritionGoals.bulkPut(backup.nutritionGoals as never[]);
  if (backup.unlockedAchievements)
    await db.unlockedAchievements.bulkPut(backup.unlockedAchievements as never[]);

  // Convert base64 photo strings back to Blobs
  if (backup.progressPhotos) {
    const photos = await Promise.all(
      backup.progressPhotos.map(async (p) => ({
        ...p,
        imageBlob: p.imageBlob ? base64ToBlob(p.imageBlob) : new Blob(),
        thumbnailBlob: undefined,
      }))
    );
    await db.progressPhotos.bulkPut(photos as never[]);
  }
}

function base64ToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  const u8 = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
  return new Blob([u8], { type: mime });
}


function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
