Exit code: 0
Wall time: 2 seconds
Output:
# Orbit & Oak

Orbit & Oak is an offline-first, mobile-first learning app prototype. It turns a child's interests into physical missions: make something, write something, notice something, then photograph it and bring it back into the app.

## Run locally

Run the bundled zero-dependency local server. ES modules and the service worker are intentionally used instead of a build step, so the app can also be hosted as static files.

```powershell
cd outputs
npm start
```

Then open the local URL shown by the server. A secure origin (`localhost` or HTTPS) is required for the service worker and install prompt.

## Deploy to Vercel

This folder is a zero-build static Vercel project. In Vercel, import the GitHub repository and set:

- Root Directory: `outputs`
- Framework Preset: `Other`
- Build Command: leave blank
- Output Directory: `.`

Every push to the connected production branch deploys automatically. Pull requests receive their own Vercel preview URL.

## Product structure

- `index.html` â€” application shell and PWA metadata links
- `styles.css` â€” responsive design system for phone, tablet, and desktop layouts
- `src/app.js` â€” routing, rendering, event handling, mission execution, photo capture, rewards, and parent/child flows
- `src/data/missions.js` â€” all 49 mission records, four levels, seven badges, and reward definitions
- `src/state.js` â€” local persistence and progress calculations
- `src/integrations/firebase-config.example.js` â€” Firebase config template
- `src/integrations/firebase-service.js` â€” modular Firebase Auth, Firestore, Storage, and App Check helpers
- `firebase/firestore.rules` â€” family/member-aware Firestore rules
- `firebase/storage.rules` â€” private, image-only mission evidence rules
- `manifest.webmanifest` â€” installable app metadata
- `sw.js` â€” offline app-shell caching

## Included flows

1. Parent email sign-in or child access without an email.
2. Parent/child role selection.
3. First-time parent PIN setup and returning parent PIN login.
4. Child dashboard, 49-mission catalogue, badges, and persistent progress.
5. Mission checklist, photo attachment, optional reflection, and completion.
6. Level completion rewards that a parent can approve.
7. Parent activity log with returned mission photos.

## Legacy Firebase adapter

The current UI intentionally runs without credentials and stores state locally. To move it to production:

1. Create a Firebase project and register a Web app.
2. Enable Email/Password (or Google/Apple) in Authentication.
3. Create a Cloud Firestore database and a Cloud Storage bucket.
4. Copy `src/integrations/firebase-config.example.js` to `src/integrations/firebase-config.js` and paste the Web app config from Firebase.
5. Install the SDK from the `outputs` directory:

   ```powershell
   npm install firebase
   ```

6. Initialize the adapter in the app entry point and replace `loadState`/`saveState` calls with `authApi` and `familyApi` calls from `src/integrations/firebase-service.js`.
7. Deploy the rules from the `firebase` folder:

   ```powershell
   npx firebase-tools login
   npx firebase-tools use YOUR_PROJECT_ID
   npx firebase-tools deploy --only firestore:rules,storage
   ```

8. Enable App Check after monitoring traffic. The adapter uses the Enterprise reCAPTCHA provider hook; add its site key to the config before calling `enableAppCheck()`.

Recommended production identity model:

- Parent: Firebase email/password or federated sign-in. The parent UID owns the family document.
- Child: no email. Use Firebase anonymous auth on the child device plus a short-lived parent-generated invite code or QR flow. Validate and bind that code server-side; never let a child query all families looking for a matching code.
- PIN: keep it as a local parent-mode lock, not as the account credential. The Firebase account/password is the actual recovery path.
- Data: store `families/{familyId}`, child profile, mission progress, submissions, and approved rewards in separate subcollections. Store photo bytes in Cloud Storage and only the storage path/metadata in Firestore.

Before launch, add Cloud Functions for invite-code creation/claiming, email verification and password reset UX, account deletion/export, abuse monitoring, image resizing, and parental-consent/privacy flows appropriate to the markets where children will use the app.

## Recommended production backend: Supabase

Orbit & Oak now includes a Supabase adapter for parent authentication, family-state sync, and private mission-photo storage. Supabase is the better fit here because the family data is relational and can be protected with Postgres Row Level Security (RLS).

1. Create a Supabase project.
2. In Authentication > Providers, enable Email, set a strong password policy, and configure the Site URL as the Vercel production URL.
3. Open SQL Editor and run `../supabase/schema.sql`.
4. Copy the Project URL and the publishable/anon key from Project Settings > API into `src/integrations/supabase-config.js`:

   ```js
   export const supabaseConfig = {
     url: 'https://YOUR_PROJECT_REF.supabase.co',
     anonKey: 'YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY'
   };
   ```

5. Deploy the updated `outputs` folder. Never put a Supabase service-role key in this file or in browser code.

When configured, parents can create accounts, sign in, reset passwords, sync their child profile/progress, and upload mission evidence to the private `mission-evidence` bucket. The child experience remains email-free on the current device. A later cross-device child flow should use a short-lived invite code and a server-side claim function before enabling anonymous child sessions.

