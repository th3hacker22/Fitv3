import { db, type BodyMeasurement, type ProgressPhoto, type UserProfile } from "../schema";

// ── Body Measurements CRUD ──
export async function getBodyMeasurement(id: string): Promise<BodyMeasurement | undefined> {
  return db.bodyMeasurements.get(id);
}

export async function addBodyMeasurement(measurement: BodyMeasurement): Promise<string> {
  return db.bodyMeasurements.add(measurement);
}

export async function updateBodyMeasurement(
  id: string,
  changes: Partial<BodyMeasurement>
): Promise<number> {
  return db.bodyMeasurements.update(id, changes);
}

export async function deleteBodyMeasurement(id: string): Promise<void> {
  await db.bodyMeasurements.delete(id);
}

export async function getAllBodyMeasurements(): Promise<BodyMeasurement[]> {
  return db.bodyMeasurements.toArray();
}

// ── Progress Photos CRUD ──
export async function getProgressPhoto(id: string): Promise<ProgressPhoto | undefined> {
  return db.progressPhotos.get(id);
}

export async function addProgressPhoto(photo: ProgressPhoto): Promise<string> {
  return db.progressPhotos.add(photo);
}

export async function updateProgressPhoto(
  id: string,
  changes: Partial<ProgressPhoto>
): Promise<number> {
  return db.progressPhotos.update(id, changes);
}

export async function deleteProgressPhoto(id: string): Promise<void> {
  await db.progressPhotos.delete(id);
}

export async function getAllProgressPhotos(): Promise<ProgressPhoto[]> {
  return db.progressPhotos.toArray();
}

export async function getProgressPhotosByType(
  type: "front" | "side" | "back"
): Promise<ProgressPhoto[]> {
  return db.progressPhotos.where("type").equals(type).toArray();
}

// ── User Profile CRUD ──
export async function getUserProfile(id: string): Promise<UserProfile | undefined> {
  return db.userProfile.get(id);
}

export async function addUserProfile(profile: UserProfile): Promise<string> {
  return db.userProfile.add(profile);
}

export async function updateUserProfile(
  id: string,
  changes: Partial<UserProfile>
): Promise<number> {
  return db.userProfile.update(id, changes);
}

export async function deleteUserProfile(id: string): Promise<void> {
  await db.userProfile.delete(id);
}

export async function getAllUserProfiles(): Promise<UserProfile[]> {
  return db.userProfile.toArray();
}
