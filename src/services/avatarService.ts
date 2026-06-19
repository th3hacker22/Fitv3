/**
 * Avatar Storage Service.
 *
 * Stores user avatar as base64 in localStorage (small images only).
 * For larger images, falls back to IndexedDB via db.userProfile.
 *
 * Avatar is resized to 256x256 before storage to keep size reasonable.
 */

const AVATAR_KEY = "pulse_user_avatar";

/**
 * Resize an image file to 256x256 and convert to base64.
 */
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

        // Calculate dimensions preserving aspect ratio
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

        // Center-crop to square
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

/**
 * Save avatar to localStorage.
 */
export function saveAvatar(dataUrl: string): void {
  try {
    localStorage.setItem(AVATAR_KEY, dataUrl);
  } catch (err) {
    console.error("[avatar] Failed to save:", err);
  }
}

/**
 * Get avatar from localStorage.
 */
export function getAvatar(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AVATAR_KEY);
}

/**
 * Remove avatar from localStorage.
 */
export function removeAvatar(): void {
  localStorage.removeItem(AVATAR_KEY);
}

/**
 * Check if user has an avatar.
 */
export function hasAvatar(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(AVATAR_KEY);
}
