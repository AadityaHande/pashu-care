# PashuCare deployment checklist

## Vercel (Next.js)

1. Extract the ZIP and import the project into Vercel (or upload the project using Vercel's supported deployment flow).
2. Select **Next.js** as the framework preset. Do not deploy this source ZIP as a static WordPress asset.
3. Set Node.js to **22.x** in Vercel project settings.
4. For real authenticated use, add all six `NEXT_PUBLIC_FIREBASE_*` variables from `.env.example`. For a presentation-only deployment without Firebase, the local preview is enabled by default. Set `NEXT_PUBLIC_PASHUCARE_DEMO_MODE=false` to block preview access. Google OAuth uses the same Firebase web configuration; no separate Google client secret belongs in the browser environment.
5. Deploy, then check the build log. `NEXT_PUBLIC_*` values are compiled into the client bundle; changing them requires a new deployment.
6. In Firebase Authentication → Sign-in method, enable **Email/Password** and **Google**, select a support email, and save.
7. In Firebase Authentication → Settings → Authorized domains, add the exact deployed Vercel hostname and `localhost` if using local development.
8. Publish the included Firestore and Storage rules before inviting users.
9. Test Google sign-in on desktop and mobile, email registration/sign-in/reset, add farm, add animal, create report, case update, add vaccination, photo upload, offline edit, reconnect sync, backup export and restore.

## Firebase rules

The included `firebase.json`, `firestore.rules` and `storage.rules` can be deployed with Firebase CLI. The rules restrict Farmers to their own workspaces and allow accounts with an Admin-provisioned VETERINARIAN custom claim to review/update workspaces in this single cooperative Firebase project. Signed-in users can read the vetted veterinarian directory; only the Admin SDK can modify it. Storage images remain owner-scoped, with vetted veterinarians allowed to review case evidence. Do not replace these with public read/write rules.

## Google OAuth checklist

- Enable the Google provider in Firebase Authentication → Sign-in method and configure the project support email.
- Add the exact public host used for sign-in to Firebase Authentication → Settings → Authorized domains. Include the deployed Vercel hostname, any custom domain, and `localhost` for local testing.
- Google sign-in uses `signInWithRedirect` and `getRedirectResult` through the Firebase Web SDK. This is intentional for mobile reliability; popup blockers are not required.
- No Google OAuth client secret, Firebase Admin SDK secret, or service-account JSON is needed in the client app. Do not create `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET` or expose privileged credentials.
- First-time Google sign-ins are initialized as Farmer accounts. Veterinarian privileges require the included Admin provisioning utility and a forced re-login to refresh custom claims.

## Required environment variables

| Variable | Purpose | Public? |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web app config | Yes |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | Yes |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket | Yes |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID | Yes |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web app ID | Yes |

The six variables are used for both Firebase Authentication (Email/Password and Google OAuth), Firestore and Firebase Storage. There is no additional public OAuth secret.

No service-account JSON is required by the deployed client app. New registrations are Farmers by default. To authorize a veterinarian, create the account in the app, then run the Admin utility locally with a private service-account credential; it creates the vetted directory entry and sets the custom claim. The credential must remain outside the repository and deployment bundle.

## Pre-launch operational checklist

- Confirm billing/quotas and configure budget alerts in Google Cloud/Firebase.
- Configure automated Firestore export/backup for the chosen project.
- Restrict Firebase Authentication sign-up according to your organization’s policy.
- Test Firebase rules with the Firebase Emulator Suite before real users.
- Confirm the single-project cooperative model: each Farmer record remains stored under that Farmer UID; vetted Veterinarians in the same Firebase project can read and update those records for case handling. All Veterinarians in this Firebase project can access all Farmer records. Use separate Firebase projects if organizations must be strictly isolated.
- Provide a privacy notice, retention policy and user support route before collecting real personal/animal-health data.


## Presentation-only deployment without Firebase

When Firebase variables are absent, the preview is enabled by default. Set `NEXT_PUBLIC_PASHUCARE_DEMO_MODE=false` in the Vercel environment to require Firebase configuration instead. When Firebase variables are absent, this enables the fictional seeded local preview on the production host. The preview includes Farmer and Veterinarian role selection and a reset control.

The preview is intended only for a controlled presentation. It uses browser-local storage, does not authenticate users, does not sync to Firestore, and must not be used to store real personal or animal-health records. Set the flag to `false` and configure Firebase before using real accounts.
