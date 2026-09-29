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
