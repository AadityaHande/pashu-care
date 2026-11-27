# PashuCare — Next.js + Firebase

PashuCare is a livestock health-management PWA with Farmer and Veterinarian workspaces. This release includes Google OAuth and Email/Password authentication through Firebase Auth, Farmer-owned Firestore workspaces, veterinarian collaboration, Firebase Storage photo uploads, offline-first local recovery, automatic reconnect sync, manual sync retry, account backup/restore and responsive mobile layouts.

## Requirements

- Node.js 24.x
- A Firebase project with Authentication, Firestore and Storage enabled
- A deployed Next.js host (Vercel is supported)

## Run locally

```bash
npm install
cp .env.example .env.local
# Fill in the six NEXT_PUBLIC_FIREBASE_* values
npm run dev
```

Open `http://localhost:3000`.

When Firebase configuration is present, users must sign in or create a Farmer account. Without Firebase, local development opens the clearly labelled preview workspace. On a production host without Firebase, the clearly labelled presentation preview is enabled by default. Set `NEXT_PUBLIC_PASHUCARE_DEMO_MODE=false` to disable it and show the setup screen. The preview uses fictional records in browser storage only; it is not a real account system and must not be used for real farmer or animal-health data. When Firebase is configured, authenticated accounts are used and the preview mode is ignored.

## Presentation demo without Firebase

For a time-limited presentation where Firebase credentials are not available:

1. Leave Firebase variables empty; the production presentation preview is enabled by default.
2. Optionally set `NEXT_PUBLIC_PASHUCARE_DEMO_MODE=false` to disable the preview.
3. Open the site and choose Farmer or Veterinarian from the local preview screen.
4. Use the **Reset** control to restore the fictional starter dataset between walkthroughs.

This mode intentionally keeps role switching and seeded records so both sides of the workflow can be demonstrated. It is local to each browser and does not persist to Firestore or sync across devices. Do not enter real personal data.

## Firebase setup

1. Create a Firebase project and register a Web app.
2. In **Authentication → Sign-in method**, enable **Email/Password** and **Google**. For Google, choose a support email and save the provider configuration.
3. Create a **Cloud Firestore** database in production mode.
4. Enable **Firebase Storage** and finish the bucket setup.
5. Copy the Web app values into `.env.local` or your Vercel Project → Settings → Environment Variables:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
6. Publish the included `firestore.rules` and `storage.rules` in Firebase Console, or deploy them with Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,storage
```

7. Add the exact Vercel production hostname and any custom host to Firebase Authentication → Settings → Authorized domains. Keep `localhost` authorized for local testing.
8. Add the same six public Web app variables to Vercel for **Production**, **Preview** and **Development** as required. Redeploy after changing environment variables; Next.js reads `NEXT_PUBLIC_*` values during the build.

### Security model

- Each Farmer's records are stored at `users/{farmerUid}/workspace/main`; Farmers only access their own workspace.
- Accounts with the Firebase Admin-provisioned `VETERINARIAN` custom claim can review and update Farmer workspaces in this Firebase project.
- A signed-in Farmer can read the approved veterinarian directory; only Firebase Admin can add or remove directory entries. A veterinarian can update their own directory display name.
- New accounts are Farmers by default. A normal user cannot promote themselves by editing a profile field.
- The Firebase Admin service account must never be put in a `NEXT_PUBLIC_*` variable, committed to this repository, or uploaded as part of the ZIP. Provision veterinarians using the Admin utility below; it sets the custom claim and publishes the account to the approved veterinarian directory.

## Provision a veterinarian account

1. Create the account normally in PashuCare using its email and password.
2. Download a service-account JSON from Firebase Console → Project settings → Service accounts. Keep it private on your own machine.
3. In the project folder, run:

```bash
cd tools/admin
npm install
# Set FIREBASE_SERVICE_ACCOUNT_FILE to the private JSON path.
# Set FIREBASE_PROJECT_ID to your Firebase project ID.
npm run set-vet -- vet@example.com VETERINARIAN
```

For PowerShell, for example:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_FILE="C:\private\pashucare-service-account.json"
$env:FIREBASE_PROJECT_ID="your-firebase-project-id"
npm run set-vet -- vet@example.com VETERINARIAN
```

Ask the user to sign out and sign back in to refresh the Firebase custom claim. Use `FARMER` to revert an account.

## Google OAuth and account provisioning

- The sign-in screen offers **Continue with Google**. It uses Firebase's redirect flow instead of popups, which avoids common mobile popup-blocker issues.
- New Google users are created as **FARMER** accounts by default. The Firebase Auth observer bootstraps their `users/{uid}` profile and empty Firestore workspace on first successful sign-in.
- Existing Google users return to the same Firebase UID and therefore the same Firestore workspace across devices.
- Veterinarian status is never inferred from a Google email address or a client-side role picker. Provision it through the trusted Admin utility, then sign out and sign in again to refresh the custom claim.
- If the same email already exists under Email/Password, sign in with that method first. Firebase's one-account-per-email policy can reject an attempted second provider until the account is deliberately linked.

## Firestore data model

| Path | Stored data |
|---|---|
| `users/{uid}` | Account profile, display name, phone and role marker |
| `users/{uid}/workspace/main/records/{kind}__{recordId}` | Farms, animals, reports, cases, vaccinations, alerts, audit records and other workspace records |
| `users/{uid}/workspace/main/config/settings` | Surveillance thresholds, escalation rules and counters |
| `users/{uid}/workspace/main/meta/state` | Workspace revision and sync writer metadata |
| `veterinarians/{uid}` | Admin-approved veterinarian directory entry |
| Firebase Storage `users/{uid}/...` | Animal and report photo evidence |

The app writes records to Firestore through `saveFirebaseWorkspace`, reads them when an authenticated workspace is initialized, and watches revision metadata to refresh data changed by another signed-in device or a veterinarian. Firestore's persistent browser cache plus the per-account recovery copy supports offline use. Firebase Storage holds images rather than embedding base64 photos in Firestore documents.

## Offline and online behaviour

- Firestore persistent local cache is enabled in the browser where supported.
- The app also keeps a per-account local recovery copy in local storage.
- Data changes made while offline remain in the local copy; when connectivity returns, the app loads the latest cloud workspace, merges records by ID (local changes win for the same ID), and retries cloud writes.
- Photo evidence is uploaded to Firebase Storage before the corresponding cloud record is saved. A failed upload leaves the local copy intact and sync retries.
- The header shows Online/Offline and cloud sync state. Use the circular sync icon to request a retry.
- Fresh login on a device that has never signed in still requires internet. An already signed-in user can continue in offline mode with that device's cached data.

### Conflict policy

The current sync is record-level merge with **local-wins for same-ID edits** when recovering an offline copy. Concurrent edits to the same record from two devices are not field-level merged; the most recent successful write wins. Export a backup before major data migrations or bulk restore.

## Included operational features

- Google OAuth sign-in using Firebase redirect flow (mobile-friendly), plus email/password registration, sign-in and password reset
- Farmer and veterinarian role-based navigation
- Farm, animal, health report, case, vaccination, follow-up and in-app alert workflows
- Preliminary rule-based risk assessment and possible-cluster review (decision support only)
- Animal/report photo uploads to Firebase Storage
- In-app notifications plus browser notifications on supported devices when permission is granted
- Offline report queue and reconnect processing
- CSV export, JSON workspace backup and restore
- Audit history, reminder processing, localization and PWA installation support

## Important limitations

- Each Farmer’s records are stored under that Farmer’s Firebase UID. Vetted Veterinarians in the same Firebase project can review and update Farmer workspaces, and Farmers can assign cases to the approved veterinarian directory. This is a single-cooperative trust model: every veterinarian provisioned in one Firebase project can access every Farmer workspace in that project. Use separate Firebase projects for strict organization-level isolation. It is not a multi-tenant SaaS model.
- Browser notifications are local device notifications while the app/service worker is active. Background push delivery to closed browsers needs Firebase Cloud Messaging sender setup and is not included in this release.
- Risk scoring and cluster grouping are illustrative decision-support logic, not a veterinary diagnosis or a confirmed disease outbreak.
- The app is a strong deployment candidate, but production use still requires a real Firebase project, rules deployment, operational monitoring, backups, privacy review and end-to-end testing on your own Firebase project. No Firebase credentials are bundled.

## Commands

```bash
npm run dev       # Local development
npm run typecheck # TypeScript check
npm run lint      # ESLint via Next.js
npm run check      # Run typecheck and lint
npm run build     # Production build
npm start         # Start production server after build
```
