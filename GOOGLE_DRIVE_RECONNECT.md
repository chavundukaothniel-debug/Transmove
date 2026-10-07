# Restore TransMove Google Drive uploads

Profile photos and driver documents continue to use Google Drive. No storage migration is required. `invalid_grant` means Google no longer accepts the current authorization; code changes alone cannot renew it.

1. Open https://developers.google.com/oauthplayground/ and click the settings gear. Enable **Use your own OAuth credentials**.
2. Enter the existing `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` from the TransMove Render service's Environment page. Never paste credentials in chat, screenshots, source files or GitHub.
3. The existing Google Cloud OAuth client must list `https://developers.google.com/oauthplayground` as an authorized redirect URI. Use the existing client rather than Playground's default credentials.
4. Select the Google Drive scope used by TransMove. The current folder lookup and file storage implementation uses `https://www.googleapis.com/auth/drive`. Review the requested access, sign into the account that owns the TransMove storage, and approve the connection yourself.
5. Click **Exchange authorization code for tokens**. Copy the new refresh token directly into Render's existing `GOOGLE_OAUTH_REFRESH_TOKEN` environment variable. The account owner must enter and save this replacement credential themselves. Keep the client ID and secret consistent with the client used above.
6. Save and redeploy the Render service. Wait until the deployment is live, then test a profile photo and a driver document. Check that each file uploads and can be viewed by the authorized account.

If the Google OAuth consent application is External and in Testing, Drive refresh tokens typically expire after seven days. Inspect Google Cloud's consent application's publishing status and complete Google's applicable production/verification process to avoid recurring expiry. Do not bypass verification warnings or widen file sharing. Existing files should remain in the same account and folders.

References: https://developers.google.com/identity/protocols/oauth2 and https://developers.google.com/identity/protocols/oauth2/web-server
