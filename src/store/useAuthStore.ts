import { create } from "zustand";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}));

// Listener
if (auth) {
  onAuthStateChanged(auth, (user) => {
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setLoading(false);

    if (user) {
      import("@/services/socialService").then(({ socialService }) => {
        socialService
          .updatePublicProfile(
            user.uid,
            user.displayName || "Unknown Athlete",
            user.photoURL,
          )
          .catch(console.error);
      });
      import("@/lib/syncEngine").then(({ syncAll }) => {
        syncAll(user.uid).catch(console.error);
      });
    }
  });
} else {
  useAuthStore.getState().setLoading(false);
}
