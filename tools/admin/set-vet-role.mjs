import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'node:fs/promises';

const [emailArg, roleArg = 'VETERINARIAN'] = process.argv.slice(2);
const email = (emailArg || '').trim().toLowerCase();
const role = roleArg.toUpperCase();
if (!email || !['FARMER', 'VETERINARIAN'].includes(role)) {
  console.error('Usage: npm run set-vet -- user@example.com [VETERINARIAN|FARMER]');
  process.exit(2);
}

let credential = applicationDefault();
if (process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
  const serviceAccount = JSON.parse(await readFile(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8'));
  credential = cert(serviceAccount);
}
const app = getApps()[0] || initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);
const user = await auth.getUserByEmail(email);
const currentClaims = user.customClaims || {};
await auth.setCustomUserClaims(user.uid, { ...currentClaims, role });
const profile = { uid: user.uid, email: user.email || email, displayName: user.displayName || email.split('@')[0], role, roleUpdatedAt: new Date().toISOString() };
await db.doc(`users/${user.uid}`).set(profile, { merge: true });
if (role === 'VETERINARIAN') {
  await db.doc(`veterinarians/${user.uid}`).set({ uid: user.uid, email: profile.email, displayName: profile.displayName, role, updatedAt: new Date().toISOString() }, { merge: true });
} else {
  await db.doc(`veterinarians/${user.uid}`).delete();
}
console.log(`${email} is now ${role}. Ask the user to sign out and sign in again to refresh the role claim.`);
