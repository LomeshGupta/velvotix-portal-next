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

Push needs HTTPS (or localhost) and a production build. Every logged-in user can enable notifications from the bell. On iPhone/iPad, add the app to the Home Screen first, then tap Enable Notifications. Test notifications are stored in the bell history and delivered to every registered device for the selected user. The same browser subscription is re-bound after logout/login so one user's notifications cannot leak to another user.
