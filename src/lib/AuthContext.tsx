"use client";

/**
 * Enhanced AuthContext for CivicPulse.
 *
 * Wraps Firebase Auth state AND loads the Firestore user profile (role, org, etc.)
 * so every page can access `useAuth()` without redundant getDoc calls.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { UserProfile } from "./types";

type AuthContextType = {
  /** Firebase Auth user object (null if signed out) */
  user: User | null;
  /** Firestore user profile (null if not loaded or signed out) */
  profile: UserProfile | null;
  /** True while auth state or profile is loading */
  loading: boolean;
  /** Sign out and clear state */
  logout: () => Promise<void>;
  /** Force re-fetch of the Firestore profile (e.g. after org changes) */
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile from Firestore
  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const userRef = doc(db, "users", uid);
      const snapshot = await getDoc(userRef);

      if (snapshot.exists()) {
        setProfile(snapshot.data() as UserProfile);
      } else {
        // Fallback if Firestore document doesn't exist yet
        setProfile({
          uid,
          name: "",
          email: "",
          role: "resident",
          trustScore: 50,
        });
      }
    } catch (err) {
      console.error("AuthContext: Failed to load profile", err);
      // Set a minimal fallback profile so pages don't break
      setProfile({
        uid,
        name: "",
        email: "",
        role: "resident",
        trustScore: 50,
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  }, [user, fetchProfile]);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}