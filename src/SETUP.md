# Setup for Redis, notifications and push

1. Install the new packages:
   npm i ioredis web-push
   npm i -D @types/web-push

2. Environment variables (.env.local / hosting dashboard):
   REDIS_URL=redis://localhost:6379   # Upstash / Redis Cloud / self-hosted. Unset = in-memory cache (single instance only)
   CACHE_TTL_SECONDS=60               # optional; default 60 with Redis, 15 without
   VAPID_PUBLIC_KEY=...               # generate once: npx web-push generate-vapid-keys
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:you@yourdomain.com

3. Check it: open /api/health -> {"status":"ok","cache":"redis","push":true}

Push needs HTTPS (or localhost) and a production build. On iPhone/iPad, add the app to the Home Screen first.

## Production notification / persistent-session verification

- Authentication uses a rolling 30-day session. Active users remain signed in until they explicitly use Logout; inactivity beyond the session window requires sign-in again.
- Web Push subscriptions are synchronized on every authenticated app startup/login, so closing/reopening the browser or installed PWA does not lose the device registration.
- Each push endpoint is bound to one authenticated user. Logging out removes the current device endpoint from that user before the auth cookie is cleared.
- Closed/background delivery requires valid VAPID keys and a browser/PWA that supports Web Push.
- iPhone/iPad: open the site in Safari, choose **Add to Home Screen**, launch the installed Velvotix app, then enable Notifications and allow the iOS permission prompt. iOS Web Push delivery to Notification Center/Lock Screen depends on the installed Home Screen PWA and OS permission.
- Notification click routing uses the notification's stored `link`/`url`. The service worker focuses an existing app window and navigates it, or opens a new app window when none exists.
- Admin test notifications use the normal notification pipeline, so they are persisted in the bell/history and sent to all registered devices for the selected active user.
