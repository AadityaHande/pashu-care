# PashuCare v2.1.0 — Google OAuth and Firestore application upgrade

## Authentication
- Added Firebase Google OAuth using a full-page redirect flow, chosen for better compatibility with mobile browsers and popup blockers.
- Kept email/password registration, sign-in and password reset.
- Added readable errors for disabled Google provider, unauthorized host, network failures and existing accounts using another provider.
- First-time Google sign-ins are initialized as Farmer accounts; veterinarian privileges still require trusted Admin provisioning.
- Auth is persisted with Firebase browser-local persistence; redirect resolver is explicitly enabled in Firebase Auth initialization.

## Data persistence
- Firestore remains the durable source of truth for profiles, workspace records, settings and sync metadata.
- Documents are stored under account UID-scoped workspace paths; photos are uploaded to Firebase Storage.
- Existing offline cache, per-account recovery copy and reconnect sync are retained.
- New Google accounts bootstrap their Firestore profile and empty workspace on first authenticated session.

## Setup required
- Enable Google and Email/Password under Firebase Authentication → Sign-in method.
- Configure the Firebase support email and add all deployment hostnames under Authentication → Settings → Authorized domains.
- Set the six Firebase Web app environment variables in Vercel and redeploy.
- Publish the included Firestore and Storage rules.

## Validation
- Source-level checks cover auth imports/exports, redirect handlers, TypeScript/TSX parsing, configuration shape, rules files and ZIP integrity.
- A live Google OAuth exchange and Firestore read/write cannot be verified without the user's Firebase project, enabled Google provider, authorized host and credentials. Run the documented end-to-end checklist against the configured project before production data is entered.
