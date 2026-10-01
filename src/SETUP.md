# Notification / Web Push production setup

## Required server environment

Set these on the production server/hosting dashboard (not only in `.env.local`):

```env
REDIS_URL=your-production-redis-url
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

Generate one stable VAPID key pair once:

```bash
npx web-push generate-vapid-keys
```

Do **not** generate a new pair on every deployment. Keep the same keys permanently; changing them invalidates existing browser subscriptions.

## Verify the server before testing a phone

While logged in, open:

```text
/api/push
```

The response must contain:

```json
{
  "enabled": true,
  "publicKey": "..."
}
```

If `enabled` is `false`, Android/iOS cannot receive push notifications regardless of browser permission.

## Android / Chrome

1. Use HTTPS.
2. Open the production app.
3. Allow browser notifications.
4. Keep the app logged in.
5. The app registers `/sw.js`, waits for the service worker to become ready, creates/reuses the Push subscription and sends it to `/api/push`.
6. Close the browser/app and send an admin test notification.

## iPhone / iPad

iOS Web Push requires the site to be installed as a Home Screen web app.

1. Open the production site in Safari.
2. Share → **Add to Home Screen**.
3. Launch the installed Velvotix app from the Home Screen.
4. Log in.
5. Tap **Turn on notifications** and allow the iOS permission prompt.
6. Send an admin test notification.

The notification can then appear in Notification Center / Lock Screen according to the user's iOS notification settings and Focus modes.

## Important implementation details

- Push registration waits for `navigator.serviceWorker.ready`; it no longer races the initial service-worker registration.
- Existing subscriptions are reused instead of calling `subscribe()` again and failing with `InvalidStateError`.
- Every authenticated app start synchronizes the current subscription to the current user.
- Logout detaches the current device from the old user.
- Notification sends are awaited before the notification API returns, so serverless runtimes do not lose a fire-and-forget push task.
- 404/410 push endpoints are removed automatically.
- Notification clicks focus an existing app window and navigate to the stored notification link, or open the link when no app window exists.
