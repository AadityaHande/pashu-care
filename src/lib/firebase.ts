"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence, browserPopupRedirectResolver, createUserWithEmailAndPassword, getAuth, getIdTokenResult,
  getRedirectResult, GoogleAuthProvider, initializeAuth, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithRedirect, signOut, updateProfile, type Auth, type User,
} from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, getFirestore, initializeFirestore,
  onSnapshot, persistentLocalCache, persistentMultipleTabManager, serverTimestamp,
  setDoc, writeBatch, type Firestore, type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadString } from "firebase/storage";
import type { AppData, DemoUser, Role } from "@/lib/types";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId &&
  firebaseConfig.storageBucket && firebaseConfig.messagingSenderId && firebaseConfig.appId,
);

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!firebaseConfigured) throw new Error("Firebase is not configured. Add all NEXT_PUBLIC_FIREBASE_* values to your deployment environment and redeploy.");
  if (appInstance) return appInstance;
  appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return appInstance;
}

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  try {
    authInstance = initializeAuth(app, {
      persistence: browserLocalPersistence,
      // Redirect-based OAuth is more reliable than popups on mobile browsers.
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    authInstance = getAuth(app);
  }
  return authInstance;
}

export function getFirebaseDb(): Firestore {
  if (dbInstance) return dbInstance;
  const app = getFirebaseApp();
  try {
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    dbInstance = getFirestore(app);
  }
  return dbInstance;
}

export function subscribeAuth(callback: (user: User | null) => void, onError?: (error: Error) => void): Unsubscribe {
  return onAuthStateChanged(getFirebaseAuth(), callback, (error) => onError?.(error));
}

export async function signInFirebase(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  return credential.user;
}

/** Starts Google OAuth with a full-page redirect (mobile-friendly, popup-blocker safe). */
export async function signInWithGoogleFirebase(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithRedirect(getFirebaseAuth(), provider);
}

/** Must be called once on the auth screen after returning from Google's redirect. */
export async function completeGoogleRedirectFirebase(): Promise<User | null> {
  const result = await getRedirectResult(getFirebaseAuth());
  return result?.user ?? null;
}

export async function registerFirebase(email: string, password: string, displayName: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  await updateProfile(credential.user, { displayName: displayName.trim() });
  await setDoc(doc(getFirebaseDb(), "users", credential.user.uid), {
    uid: credential.user.uid,
    email: credential.user.email,
    displayName: displayName.trim(),
    role: "FARMER",
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  });
  return credential.user;
}

export async function resetFirebasePassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export async function signOutFirebase(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export async function updateFirebaseProfile(user: User, name: string, phone?: string): Promise<void> {
  const cleanName = name.trim();
  await updateProfile(user, { displayName: cleanName });
  const db = getFirebaseDb();
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email,
    displayName: cleanName,
    phone: phone?.trim() || "",
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  const role = await getAuthenticatedRole(user);
  if (role === "VETERINARIAN") {
    await setDoc(doc(db, "veterinarians", user.uid), {
      uid: user.uid, email: user.email, displayName: cleanName, role,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
}

export async function getAuthenticatedRole(user: User): Promise<Role> {
  const token = await getIdTokenResult(user);
  return token.claims.role === "VETERINARIAN" ? "VETERINARIAN" : "FARMER";
}

export async function getFirebaseDisplayName(user: User): Promise<string> {
  if (user.displayName?.trim()) return user.displayName.trim();
  try {
    const profile = await getDoc(doc(getFirebaseDb(), "users", user.uid));
    const name = profile.data()?.displayName;
    if (typeof name === "string" && name.trim()) return name.trim();
  } catch { /* A cached/offline session can still use the email prefix. */ }
  return user.email?.split("@")[0] || "PashuCare user";
}

const listFields = [
  "farms", "animals", "reports", "clusters", "cases", "vaccinations",
  "healthRecords", "alerts", "cropPlans", "auditLogs", "pendingReports",
] as const;
type ListField = typeof listFields[number];

type StoredRecord = { kind: ListField; id: string; payload: Record<string, unknown> };

function recordsRef(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "workspace", "main", "records");
}
function settingsRef(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "workspace", "main", "config", "settings");
}
function metaRef(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "workspace", "main", "meta", "state");
}
function firestoreDocId(kind: ListField, id: string) {
  return `${kind}__${id.replaceAll("/", "_")}`;
}
function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createEmptyWorkspace(user: DemoUser): AppData {
  return {
    users: [user], farms: [], animals: [], reports: [], clusters: [], cases: [], vaccinations: [],
    healthRecords: [], alerts: [], cropPlans: [], auditLogs: [], pendingReports: [],
    surveillanceSettings: {
      priorityScore: 55, clusterWindowDays: 14, minimumClusterReports: 3,
      matchingSymptomMinimum: 1, followUpReminderDays: 2,
      vaccinationReminderDays: 14, escalationAfterHours: 24, escalationPriorityOnly: true,
    },
    escalationRules: [
      { id: "ESC-01", name: "Priority case not reviewed", enabled: true, condition: "PRIORITY_UNREVIEWED", afterHours: 4, notifyRole: "VETERINARIAN", description: "Raise an escalation when a priority case remains open without assessment." },
      { id: "ESC-02", name: "Overdue follow-up", enabled: true, condition: "FOLLOW_UP_OVERDUE", afterHours: 0, notifyRole: "VETERINARIAN", description: "Flag follow-ups whose scheduled date has passed." },
      { id: "ESC-03", name: "Overdue vaccination", enabled: true, condition: "VACCINATION_OVERDUE", afterHours: 0, notifyRole: "FARMER", description: "Notify the farmer when a vaccination due date has passed." },
      { id: "ESC-04", name: "Unreviewed possible cluster", enabled: true, condition: "CLUSTER_UNREVIEWED", afterHours: 12, notifyRole: "VETERINARIAN", description: "Remind the veterinary team about an unreviewed possible cluster." },
    ],
    counters: { report: 1, case: 1, alert: 1, animal: 1, vaccine: 1 },
  };
}

async function uploadPhotoIfNeeded(uid: string, path: string, value?: string): Promise<string | undefined> {
  if (!value?.startsWith("data:image/")) return value;
  const storage = getStorage(getFirebaseApp());
  const fileRef = ref(storage, `users/${uid}/${path}`);
  await uploadString(fileRef, value, "data_url", { contentType: value.slice(5, value.indexOf(";")) || "image/jpeg" });
  return getDownloadURL(fileRef);
}

function ownerForRecord(kind: ListField, item: Record<string, unknown>, data: AppData, currentUid: string): string {
  if (kind === "farms" || kind === "animals" || kind === "reports" || kind === "cases" || kind === "pendingReports") {
    return typeof item.farmerId === "string" ? item.farmerId : currentUid;
  }
  if (kind === "alerts") return typeof item.recipientId === "string" ? item.recipientId : currentUid;
  if (kind === "auditLogs") return typeof item.actorId === "string" ? item.actorId : currentUid;
  if (kind === "healthRecords" || kind === "vaccinations") {
    const animal = data.animals.find((row) => row.id === item.animalId);
    return animal?.farmerId || currentUid;
  }
  if (kind === "cropPlans") {
    const farm = data.farms.find((row) => row.id === item.farmId);
    return farm?.farmerId || currentUid;
  }
  if (kind === "clusters") {
    const reportIds = Array.isArray(item.reportIds) ? item.reportIds as string[] : [];
    const report = data.reports.find((row) => row.id === reportIds[0]);
    return report?.farmerId || currentUid;
  }
  return currentUid;
}

async function prepareCloudData(currentUid: string, input: AppData): Promise<AppData> {
  const copy = jsonClone(input);
  copy.animals = await Promise.all(copy.animals.map(async (animal) => ({
    ...animal,
    photoDataUrl: await uploadPhotoIfNeeded(animal.farmerId || currentUid, `animals/${animal.id}.jpg`, animal.photoDataUrl),
  })));
  copy.reports = await Promise.all(copy.reports.map(async (report) => ({
    ...report,
    photoDataUrl: await uploadPhotoIfNeeded(report.farmerId || currentUid, `reports/${report.id}.jpg`, report.photoDataUrl),
  })));
  return copy;
}

function toRecordDocs(data: AppData, currentUid: string): Map<string, StoredRecord & { ownerUid: string }> {
  const result = new Map<string, StoredRecord & { ownerUid: string }>();
  for (const kind of listFields) {
    const values = data[kind] as unknown as Array<Record<string, unknown>>;
    for (const item of values || []) {
      const id = String(item.id || "");
      if (!id) continue;
      const ownerUid = ownerForRecord(kind, item, data, currentUid);
      const key = `${ownerUid}/${firestoreDocId(kind, id)}`;
      result.set(key, { ownerUid, kind, id, payload: jsonClone(item) });
    }
  }
  return result;
}

async function readWorkspaceRecords(uid: string): Promise<{ data: Record<string, unknown>[]; settings: Record<string, unknown> | null }> {
  const [recordsSnapshot, settingsSnapshot] = await Promise.all([getDocs(recordsRef(uid)), getDoc(settingsRef(uid))]);
  return {
    data: recordsSnapshot.docs.map((snapshot) => snapshot.data() as Record<string, unknown>),
    settings: settingsSnapshot.exists() ? settingsSnapshot.data() : null,
  };
}

export async function loadFirebaseWorkspace(uid: string, user: DemoUser): Promise<AppData> {
  const db = getFirebaseDb();
  const profileRef = doc(db, "users", uid);
  const profileSnapshot = await getDoc(profileRef);
  const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
  const role: Role = user.role === "VETERINARIAN" ? "VETERINARIAN" : "FARMER";
  const data = createEmptyWorkspace(user);

  if (role === "VETERINARIAN") {
    // A vetted veterinarian can review workspaces in this cooperative Firebase project.
    const profilesSnapshot = await getDocs(collection(db, "users"));
    const profiles = profilesSnapshot.docs.map((item) => ({
      id: item.id,
      name: String(item.data().displayName || item.data().email || "Farmer"),
      email: String(item.data().email || ""),
      role: item.data().role === "VETERINARIAN" ? "VETERINARIAN" as const : "FARMER" as const,
      phone: typeof item.data().phone === "string" ? item.data().phone : undefined,
    }));
    const farmerUids = profiles.filter((item) => item.role === "FARMER").map((item) => item.id);
    const allUids = Array.from(new Set([...farmerUids, uid]));
    const workspaces = await Promise.all(allUids.map(async (ownerUid) => ({ ownerUid, ...(await readWorkspaceRecords(ownerUid)) })));
    for (const workspace of workspaces) {
      for (const raw of workspace.data) {
        const record = raw as unknown as StoredRecord;
        if (!listFields.includes(record.kind) || !record.payload) continue;
        (data[record.kind] as unknown[]).push(record.payload);
      }
    }
    const vetDirectory = await getDocs(collection(db, "veterinarians"));
    const vets = vetDirectory.docs.map((item) => {
      const row = item.data();
      return { id: item.id, name: String(row.displayName || row.name || row.email || "Veterinarian"), email: String(row.email || ""), role: "VETERINARIAN" as const };
    });
    const visibleProfiles = profiles.filter((item) => item.role === "FARMER" || item.id === uid);
    data.users = [...visibleProfiles, ...vets].reduce<DemoUser[]>((acc, row) => {
      if (!acc.some((existing) => existing.id === row.id)) acc.push(row);
      return acc;
    }, []);
    if (!data.users.some((item) => item.id === uid)) data.users.unshift(user);
    const ownWorkspace = workspaces.find((item) => item.ownerUid === uid);
    if (ownWorkspace?.settings) {
      data.surveillanceSettings = (ownWorkspace.settings.surveillanceSettings as AppData["surveillanceSettings"]) || data.surveillanceSettings;
      data.escalationRules = (ownWorkspace.settings.escalationRules as AppData["escalationRules"]) || data.escalationRules;
      data.counters = (ownWorkspace.settings.counters as AppData["counters"]) || data.counters;
    }
  } else {
    const [workspace, vetsSnapshot] = await Promise.all([
      readWorkspaceRecords(uid), getDocs(collection(db, "veterinarians")),
    ]);
    for (const raw of workspace.data) {
      const record = raw as unknown as StoredRecord;
      if (!listFields.includes(record.kind) || !record.payload) continue;
      (data[record.kind] as unknown[]).push(record.payload);
    }
    data.users = [{ ...user, phone: typeof profile.phone === "string" ? profile.phone : undefined }, ...vetsSnapshot.docs.map((item) => {
      const row = item.data();
      return { id: item.id, name: String(row.displayName || row.name || row.email || "Veterinarian"), email: String(row.email || ""), role: "VETERINARIAN" as const };
    })];
    if (workspace.settings) {
      data.surveillanceSettings = (workspace.settings.surveillanceSettings as AppData["surveillanceSettings"]) || data.surveillanceSettings;
      data.escalationRules = (workspace.settings.escalationRules as AppData["escalationRules"]) || data.escalationRules;
      data.counters = (workspace.settings.counters as AppData["counters"]) || data.counters;
    }
  }
  // Prefer the authenticated Firebase profile over stale embedded display data.
  if (profile.displayName && typeof profile.displayName === "string") {
    data.users = data.users.map((entry) => entry.id === uid ? { ...entry, name: profile.displayName as string, phone: typeof profile.phone === "string" ? profile.phone : entry.phone } : entry);
  }
  return data;
}

export async function saveFirebaseWorkspace(uid: string, previous: AppData | null, next: AppData, writerId: string): Promise<AppData> {
  const normalized = await prepareCloudData(uid, next);
  const before = previous ? toRecordDocs(previous, uid) : new Map<string, StoredRecord & { ownerUid: string }>();
  const after = toRecordDocs(normalized, uid);
  const operations: Array<{ type: "set" | "delete"; id: string; ownerUid: string; value?: StoredRecord }> = [];

  for (const [key, item] of after) {
    const old = before.get(key);
    if (!old || JSON.stringify(old.payload) !== JSON.stringify(item.payload)) operations.push({ type: "set", id: firestoreDocId(item.kind, item.id), ownerUid: item.ownerUid, value: item });
  }
  for (const [key, item] of before) if (!after.has(key)) operations.push({ type: "delete", id: firestoreDocId(item.kind, item.id), ownerUid: item.ownerUid });

  const db = getFirebaseDb();
  const affectedOwners = new Set<string>([uid]);
  operations.forEach((operation) => affectedOwners.add(operation.ownerUid));
  for (let offset = 0; offset < operations.length; offset += 400) {
    const batch = writeBatch(db);
    for (const operation of operations.slice(offset, offset + 400)) {
      const reference = doc(recordsRef(operation.ownerUid), operation.id);
      if (operation.type === "delete") batch.delete(reference);
      else batch.set(reference, { ...operation.value, updatedAt: new Date().toISOString() });
    }
    await batch.commit();
  }

  const settingsChanged = !previous || JSON.stringify({
    surveillanceSettings: previous.surveillanceSettings, escalationRules: previous.escalationRules, counters: previous.counters,
  }) !== JSON.stringify({
    surveillanceSettings: normalized.surveillanceSettings, escalationRules: normalized.escalationRules, counters: normalized.counters,
  });
  if (settingsChanged || operations.length === 0) {
    await setDoc(settingsRef(uid), {
      surveillanceSettings: normalized.surveillanceSettings,
      escalationRules: normalized.escalationRules,
      counters: normalized.counters,
      schemaVersion: 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
  await Promise.all(Array.from(affectedOwners).map((ownerUid) => setDoc(metaRef(ownerUid), {
    writerId, revision: Date.now(), updatedAt: serverTimestamp(),
  }, { merge: true })));
  return normalized;
}

export function subscribeWorkspace(uid: string, user: DemoUser, callback: (writerId: string | null) => void, onError: (error: Error) => void): Unsubscribe {
  if (user.role !== "VETERINARIAN") {
    const stopWorkspace = onSnapshot(metaRef(uid), { includeMetadataChanges: true }, (snapshot) => {
      if (!snapshot.exists()) return;
      callback(typeof snapshot.data().writerId === "string" ? snapshot.data().writerId : null);
    }, onError);
    let directoryInitialized = false;
    const stopDirectory = onSnapshot(collection(getFirebaseDb(), "veterinarians"), () => {
      if (directoryInitialized) callback("veterinarian-directory-update");
      directoryInitialized = true;
    }, onError);
    return () => { stopWorkspace(); stopDirectory(); };
  }
  const unsubscribers = new Map<string, Unsubscribe>();
  let disposed = false;
  const refreshWatchers = (uids: string[]) => {
    const wanted = new Set([...uids, uid]);
    for (const [ownerUid, unsubscribe] of unsubscribers) {
      if (!wanted.has(ownerUid)) { unsubscribe(); unsubscribers.delete(ownerUid); }
    }
    for (const ownerUid of wanted) {
      if (unsubscribers.has(ownerUid)) continue;
      const unsubscribe = onSnapshot(metaRef(ownerUid), { includeMetadataChanges: true }, (snapshot) => {
        if (!disposed && snapshot.exists()) callback(typeof snapshot.data().writerId === "string" ? snapshot.data().writerId : null);
      }, onError);
      unsubscribers.set(ownerUid, unsubscribe);
    }
  };
  const stopProfiles = onSnapshot(collection(getFirebaseDb(), "users"), (snapshot) => {
    refreshWatchers(snapshot.docs.filter((item) => item.data().role !== "VETERINARIAN" || item.id === uid).map((item) => item.id));
  }, onError);
  let directoryInitialized = false;
  const stopDirectory = onSnapshot(collection(getFirebaseDb(), "veterinarians"), () => {
    if (directoryInitialized) callback("veterinarian-directory-update");
    directoryInitialized = true;
  }, onError);
  return () => {
    disposed = true;
    stopProfiles();
    stopDirectory();
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    unsubscribers.clear();
  };
}

export async function initializeWorkspaceIfEmpty(uid: string, user: DemoUser): Promise<AppData> {
  const profileRef = doc(getFirebaseDb(), "users", uid);
  const [recordsSnapshot, settingsSnapshot, profileSnapshot] = await Promise.all([
    getDocs(recordsRef(uid)), getDoc(settingsRef(uid)), getDoc(profileRef),
  ]);
  // Repair a Farmer profile if Auth registration succeeded but the profile write was interrupted.
  // Veterinarian profiles are provisioned only by the trusted Admin utility.
  if (!profileSnapshot.exists() && user.role === "FARMER") {
    await setDoc(profileRef, {
      uid, email: user.email, displayName: user.name, role: "FARMER",
      createdAt: new Date().toISOString(), schemaVersion: 1,
    });
  }
  if (recordsSnapshot.empty && !settingsSnapshot.exists()) {
    const empty = createEmptyWorkspace(user);
    await saveFirebaseWorkspace(uid, null, empty, `bootstrap-${uid}`);
  }
  return loadFirebaseWorkspace(uid, user);
}
