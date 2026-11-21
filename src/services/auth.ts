import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { app } from "../lib/firebase";

export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export function watchAuth(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function signInAnonymouslyToApp(): Promise<User> {
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export function currentUser(): User {
  if (!auth.currentUser) {
    throw new Error("Sign in first (anonymous or Google) before saving study data.");
  }
  return auth.currentUser;
}
