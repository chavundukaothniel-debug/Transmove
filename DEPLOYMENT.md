# Automatic website updates and iOS

## Render: live site and automatic updates

Live website: https://transmove.onrender.com

Use the EXISTING transmove web service in the Render dashboard. Under Settings:

- Repository: connect your GitHub account and select chavundukaothniel-debug/Transmove.
- Branch: main.
- Auto-Deploy: On Commit.
- Build Command: npm ci && npm run build:site
- Start Command: npm start
- Health Check Path: /healthz
- Node version: 22.

A GitHub provider connection is required for auto-deployment. A service created
from a public repository URL without linking the GitHub provider does not deploy
automatically. Preserve your existing Supabase and Google Drive environment
variables. render.yaml records the intended service settings; committing this file
alone does not update a dashboard-managed service. Do not create a duplicate service.

After saving the settings, deploy the latest GitHub commit once. Future pushes to
main will rebuild and deploy both the website and its trusted API together. Changes
in this local folder must be committed and pushed before Render can receive them.

The public server serves the generated site-dist folder. It also retains safe
local development fallback and never serves private server or environment files.
HTML, scripts, styles and APK downloads are revalidated so clients can retrieve
updates. Database migrations and native app releases are separate from deployment.
Apply sql/machinery_approval_visibility.sql before releasing the machinery changes.

## Website build

Run npm run build:site. The site-dist output includes the public app, APK and iPhone
installation instructions. Render starts the Node server, which serves these
files and the existing trusted API from the same address. The Netlify configuration
is optional and is not used by the existing Render service.

## iPhone installation available now

The portal's Install on iPhone button opens instructions for adding TransMove to
the home screen in Safari. This is a web app and uses the updated live website.
It is explicitly labelled Web app rather than an App Store download.

## Native iOS release

The native iOS project uses the existing Capacitor application and the same web
screens. On a Mac with a compatible Xcode installation:

1. Install dependencies with `npm ci`.
2. Run `npm run ios:prepare`, then `npm run ios:open`.
3. Select your Apple development team for bundle ID `zw.co.transmove.app`.
4. Test location, uploads, authentication, booking and account deletion on iPhone.
5. Archive and upload the signed build to App Store Connect. Complete the app
   information, screenshots, privacy disclosures and Apple review.
6. Set the published App Store URL as `ios` in `src/config/downloads.js`, then
   push to `main`. The portal automatically displays the native download link.

Website updates do not replace native binaries. Native updates require a new
signed release. No App Store build or publishing account is available in this
Windows workspace.
