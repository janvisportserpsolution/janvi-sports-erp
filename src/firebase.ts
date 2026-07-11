import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "./types";
import { ALL_PERMISSIONS } from "./rbac";
import { nowISO } from "./utils/id";

const firebaseConfig = {
  apiKey: "AIzaSyCZ9zyUAh4yO4WwxKIuFuIztcuFQ3JVb0c",
  authDomain: "janvi-sports-erp.firebaseapp.com",
  projectId: "janvi-sports-erp",
  storageBucket: "janvi-sports-erp.firebasestorage.app",
  messagingSenderId: "365235329891",
  appId: "1:365235329891:web:eccbaf8d640cafac541156",
  measurementId: "G-2XLGPYXTVP",
};

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);

let analyticsPromise: Promise<Analytics | null> | null = null;

export const getFirebaseAnalytics = () => {
  analyticsPromise ??= isSupported().then((supported) => (supported ? getAnalytics(app) : null));
  return analyticsPromise;
};

export const auth = (() => {
  try {
    return initializeAuth(app, { persistence: browserLocalPersistence });
  } catch {
    return getAuth(app);
  }
})();

setPersistence(auth, browserLocalPersistence).catch(() => undefined);

const normalizeEmail = (value?: string | null) => (value ?? "").trim().toLowerCase();

const demoCredentials: Record<string, { password: string; name: string; mobile: string; role: User["role"] }> = {
  "admin@janvisports.com": { password: "admin123", name: "Admin", mobile: "9999999999", role: "admin" },
  "factory@janvisports.com": {
    password: "factory123",
    name: "Factory Staff",
    mobile: "7777777777",
    role: "factory_ground_staff",
  },
  "tour@janvisports.com": { password: "tour123", name: "Tour User", mobile: "6666666666", role: "tour_user" },
};

export const isDemoCredential = (email: string, password: string) => {
  const demo = demoCredentials[normalizeEmail(email)];
  return Boolean(demo && demo.password === password);
};

const profileFromFirebaseUser = (firebaseUser: FirebaseUser, password = ""): User => {
  const email = normalizeEmail(firebaseUser.email);
  const demo = demoCredentials[email];
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || demo?.name || email.split("@")[0] || "User",
    email,
    mobile: demo?.mobile ?? "",
    password_hash: password,
    role: demo?.role ?? "tour_user",
    permissions: demo?.role === "admin" ? ALL_PERMISSIONS : [],
    is_active: true,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
};

export const userProfileRef = (uid: string) => doc(db, "users", uid);
export const appStateRef = () => doc(db, "erp", "janvi-sports-state");

export const ensureUserProfile = async (firebaseUser: FirebaseUser, password = "") => {
  const ref = userProfileRef(firebaseUser.uid);
  const profile = profileFromFirebaseUser(firebaseUser, password);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ...(snap.data() as User), id: firebaseUser.uid, email: normalizeEmail(firebaseUser.email) };
    }

    await setDoc(ref, { ...profile, updated_at: nowISO(), last_login_at: serverTimestamp() }, { merge: true });
  } catch {
    return profile;
  }
  return profile;
};

export const signInOrBootstrapDemoUser = async (email: string, password: string) => {
  const normalizedEmail = normalizeEmail(email);
  let firebaseUser: FirebaseUser;
  try {
    const result = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    firebaseUser = result.user;
  } catch (error) {
    if (!isDemoCredential(normalizedEmail, password)) throw error;
    const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    firebaseUser = result.user;
  }
  return ensureUserProfile(firebaseUser, password);
};

export const createSecondaryAuthUser = async (email: string, password: string) => {
  const secondaryName = "janvi-secondary-auth";
  const secondaryApp = getApps().find((candidate) => candidate.name === secondaryName) ?? initializeApp(firebaseConfig, secondaryName);
  const secondaryAuth = getAuth(secondaryApp);
  const credential = await createUserWithEmailAndPassword(secondaryAuth, normalizeEmail(email), password);
  await signOut(secondaryAuth).catch(() => undefined);
  return credential.user.uid;
};

export const logoutFirebase = () => signOut(auth);

export const onFirebaseAuthChanged = (callback: (user: FirebaseUser | null) => void): Unsubscribe =>
  onAuthStateChanged(auth, callback);
