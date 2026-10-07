# Portal update

Machinery uploads enter the existing admin Machinery review queue. Only approved
or verified active listings appear in the marketplace, details for other users,
or sponsored placements. Hire requests require approval and availability; owners
cannot book their own equipment. Changes to listing content require a new review.
Availability-only changes take effect immediately.

The duplicate admin Machinery tab placeholder was removed. Owner status labels
and upload confirmation text now explain approval. Driver and passenger portals
include journey guidance and a link to approved machinery. All rendered portals
include Android and iOS download controls.

## Release

1. Apply `sql/machinery_approval_visibility.sql` in Supabase SQL Editor. It limits
   public reads and requires the trusted API for hire creation.
2. Deploy the updated trusted backend and website on the existing Render service,
   including `downloads/`. See `DEPLOYMENT.md` for GitHub auto-deployment settings.
3. `downloads/transmove-android.apk` is the rebuilt debug APK for testing. A signed
   release APK is needed for production distribution.
4. Build and publish an iOS application separately, then set its HTTPS App Store
   link in `src/config/downloads.js`. The iOS control currently says Coming soon.

The database migration and production deployment have not been performed.

## Verification

- `node scripts/test-machinery-approval-local.mjs`: isolated backend approval,
  authorization, sponsored listing visibility and booking guard checks.
- `node scripts/test-portal-responsive-local.mjs`: machinery owner layout and
  download controls at 320, 375, 768 and 1440 pixels, checking horizontal overflow
  and download button overlap. This is not a full test of every authenticated screen.
- Android debug build completed successfully.

October 2026 professional flow update:
- Shared trip progress cards explain the next action for passengers and drivers.
- Drivers can withdraw pending offers; offer history preserves closed statuses.
- Machinery hire forms show a monthly calendar of confirmed reservations without renter details.
- Hire dates are calculated from start date and rate period; both API and PostgreSQL reject overlapping confirmed hires.
- Admin rejection reasons are saved and shown beside the owner's update/resubmit control.
- Completed trips support one review per participant and downloadable HTML receipts that can be printed or saved as PDF in a browser.
- Fleet, marketplace and bid screens provide retry controls on load failures.
- Applied sql/professional_portal_flow.sql to Supabase and verified all three changes on 7 October 2026.
- Android APK rebuilt; iOS source synced. Native iOS signing and device testing require macOS/Xcode and Apple credentials.
