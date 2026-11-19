# PashuCare presentation flow

## One-time setup

1. Create the Firebase Web app, enable Email/Password Authentication, create Firestore and enable Storage.
2. Add the six `NEXT_PUBLIC_FIREBASE_*` variables from `.env.example` in Vercel and redeploy.
3. Publish `firestore.rules` and `storage.rules` from this ZIP.
4. Register one Farmer account and one Veterinarian account in the app.
5. Using a private Firebase Admin service account on your own machine, run the `tools/admin` utility to provision the veterinarian role. Sign the veterinarian out and back in.

## Demo workflow

1. Sign in as the Farmer and register a farm and animal.
2. Create a health report, choose symptoms and severity, and review the preliminary rule-based risk score.
3. Sign in as the Veterinarian. The new Farmer report and case should appear in the veterinary workspace.
4. Open the case, record the assessment, treatment, recommendation and follow-up, then save.
5. Sign back in as the Farmer and show the case update and in-app alert.
6. Add or update vaccination records, review health history, notifications and analytics.
7. Export a JSON backup. For the offline demo, open the app on a device that has already signed in, disconnect the network, make a change, reconnect and show the sync status retrying and then synced.

**Access model:** all approved veterinarians in one Firebase project can access all Farmer workspaces in that project. Use a separate Firebase project for a separate cooperative/organization.

**Safety statement:** risk scoring and cluster detection are illustrative decision-support only. They are not a veterinary diagnosis or confirmation of an outbreak. Clinical decisions must be made by a qualified veterinarian.
