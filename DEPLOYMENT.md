# Deployment Guide (Render + Vercel)

## Architecture
- Backend: Render Web Service (`server`)
- Frontend: Vercel Project (`frontend`)

## 1) Deploy Backend on Render

### Option A: Use `server/render.yaml` Blueprint
1. In Render, create a **Blueprint** from your GitHub repo.
2. Render will automatically detect the root-level `render.yaml`.
3. Set required env vars before first deploy.

### Option B: Manual Web Service
- Root Directory: `server`
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Environment: `Node`

### Required backend env vars
- `NODE_ENV=production`
- `PORT=4000`
- `DATABASE_URL` (Postgres connection string)
- `DB_SSL=true`
- `JWT_ACCESS_SECRET` (32+ chars)
- `JWT_REFRESH_SECRET` (32+ chars)
- `ACCESS_TOKEN_TTL=15m`
- `REFRESH_TOKEN_TTL=7d`
- `BCRYPT_COST=12`
- `CORS_ORIGINS=https://<your-vercel-domain>`

### If using secret admin page
- `ADMIN_PROVISIONING_SECRET=<your-secret>`

### Optional but recommended (features)
- SMTP (credential emails): `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`
- Supabase storage: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`

### Verify backend
- Health endpoint: `https://<render-backend-domain>/health`
- Should return `{ "ok": true }`

## 2) Deploy Frontend on Vercel

1. In Vercel, import the same GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Next.js** (auto).
4. Add environment variable:
   - `NEXT_PUBLIC_API_URL=https://<your-render-backend-domain>`

> You can also set `NEXT_PUBLIC_API_BASE_URL` if needed, but `NEXT_PUBLIC_API_URL` is sufficient in this codebase.

## 3) Wire both sides together

1. Deploy backend first and copy Render URL.
2. Set Vercel `NEXT_PUBLIC_API_URL` to that URL and redeploy frontend.
3. Add Vercel app URL to backend `CORS_ORIGINS` on Render.
   - If you have preview + prod domains, use comma-separated values.
   - Example: `https://my-app.vercel.app,https://my-app-git-main-user.vercel.app`
4. Redeploy backend after updating `CORS_ORIGINS`.

## 4) Notes for auth/session

- Backend refresh cookie is configured for cross-origin production (`SameSite=None`, `Secure=true`).
- Frontend already uses `credentials: include` where needed.
- Ensure all deployed URLs are `https`.

## 5) Post-deploy smoke test

1. Open frontend login page.
2. Log in as hotel and corporate users.
3. Open:
   - Corporate reconciliation contract view
   - Employee stays row click -> invoice details
   - Secret admin page (`/hotel-finance/secret-admin`) if used
4. Confirm no CORS errors in browser console/network.
