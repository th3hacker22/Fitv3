import { auth, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { updateProfile } from "firebase/auth";

const AVATAR_KEY = "pulse_user_avatar";

export async function resizeImage(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = maxSize;
        canvas.height = maxSize;

        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxSize, maxSize);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)![1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

export async function saveAvatar(dataUrl: string, uid: string): Promise<void> {
  const blob = dataUrlToBlob(dataUrl);
  const storageRef = ref(storage, `avatars/${uid}.jpg`);
  await uploadBytesResumable(storageRef, blob);
  const downloadUrl = await getDownloadURL(storageRef);

  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { photoURL: downloadUrl });
  }

  localStorage.setItem(AVATAR_KEY, downloadUrl);
}

export function getAvatar(): string | null {
  if (typeof window === "undefined") return null;
  if (auth.currentUser?.photoURL) return auth.currentUser.photoURL;
  return localStorage.getItem(AVATAR_KEY);
}

export async function removeAvatar(): Promise<void> {
  const user = auth.currentUser;
  if (user?.uid) {
    try {
      const storageRef = ref(storage, `avatars/${user.uid}.jpg`);
      await deleteObject(storageRef);
    } catch {}
    await updateProfile(user, { photoURL: null });
  }
  localStorage.removeItem(AVATAR_KEY);
}

export function hasAvatar(): boolean {
  if (typeof window === "undefined") return false;
  return !!(auth.currentUser?.photoURL || localStorage.getItem(AVATAR_KEY));
}
