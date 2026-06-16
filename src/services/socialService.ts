import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface PublicProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
}

export interface FeedPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  workoutTitle: string;
  duration: number;
  totalVolume: number;
  exercisesCount: number;
  kudosCount: number;
  createdAt: string;
}

export const socialService = {
  async updatePublicProfile(
    uid: string,
    displayName: string,
    photoURL: string | null,
  ) {
    if (!db) return;
    const ref = doc(db, "publicProfiles", uid);
    await setDoc(
      ref,
      {
        uid,
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  },

  async searchUsers(searchQuery: string): Promise<PublicProfile[]> {
    if (!db || !searchQuery) return [];
    // Basic prefix search using >= and <=
    // Note: Firestore text search is limited, this requires displayName to be exact or prefix.
    const q = query(
      collection(db, "publicProfiles"),
      where("displayName", ">=", searchQuery),
      where("displayName", "<=", searchQuery + "\uf8ff"),
      limit(20),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as PublicProfile);
  },

  async getProfile(uid: string): Promise<PublicProfile | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, "publicProfiles", uid));
    return snap.exists() ? (snap.data() as PublicProfile) : null;
  },

  async followUser(currentUid: string, targetUid: string) {
    if (!db) return;
    const ref = doc(db, `follows/${currentUid}/following`, targetUid);
    await setDoc(ref, { followedAt: serverTimestamp() });
  },

  async unfollowUser(currentUid: string, targetUid: string) {
    if (!db) return;
    const ref = doc(db, `follows/${currentUid}/following`, targetUid);
    await deleteDoc(ref);
  },

  async getFollowingList(currentUid: string): Promise<string[]> {
    if (!db) return [];
    const q = query(collection(db, `follows/${currentUid}/following`));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.id);
  },

  async publishWorkout(
    post: Omit<FeedPost, "id" | "createdAt" | "kudosCount">,
  ) {
    if (!db) return;
    const ref = doc(collection(db, "feedPosts"));
    await setDoc(ref, {
      ...post,
      id: ref.id,
      kudosCount: 0,
      createdAt: new Date().toISOString(),
    });
  },

  async getFeed(followingUids: string[]): Promise<FeedPost[]> {
    if (!db) return [];
    // If user follows no one, maybe we show global or nothing?
    // The prompt says "getFeed(followingUids)".
    if (followingUids.length === 0) return [];

    // Firestore 'in' queries are limited to 10 items. We will chunk them if > 10 in a real app.
    // For simplicity, we chunk up to 10 here.
    const chunks = [];
    for (let i = 0; i < followingUids.length; i += 10) {
      chunks.push(followingUids.slice(i, i + 10));
    }

    let allPosts: FeedPost[] = [];

    for (const chunk of chunks) {
      const q = query(
        collection(db, "feedPosts"),
        where("authorUid", "in", chunk),
        // Without an index, we might not be able to orderBy timestamp easily combined with 'in'.
        // So we will sort client-side.
        limit(50),
      );
      const snap = await getDocs(q);
      allPosts = allPosts.concat(snap.docs.map((d) => d.data() as FeedPost));
    }

    return allPosts.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  async addKudos(postId: string) {
    if (!db) return;
    const ref = doc(db, "feedPosts", postId);
    await updateDoc(ref, {
      kudosCount: increment(1),
    });
  },
};
