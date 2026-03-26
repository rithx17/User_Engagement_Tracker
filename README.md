# User Engagement Tracker

Full-stack engagement analytics platform with authentication, event tracking, and an interactive dashboard.

## Final Shareable URLs
- Local production-style: `http://localhost:8080`
- Local dev: `http://localhost:5173`

For public users, deploy backend + frontend (Render + Vercel) and share your Vercel domain.

## Stack
- Frontend: React + Vite + TailwindCSS + Recharts
- Backend: Node.js + Express
- Database: MongoDB
- Auth: JWT + password hashing

## API Endpoints
- POST `/api/auth/login`
- POST `/api/auth/register`
- POST `/api/auth/logout`
- GET `/api/auth/me`
- POST `/api/events/track`
- GET `/api/analytics/overview`
- GET `/api/analytics/events`
- GET `/api/analytics/users` (admin)
- GET `/api/analytics/export` (admin)
- GET `/api/admin/users` (admin)

## Environment Variables
Backend (`backend/.env`):
- `NODE_ENV=development`
- `HOST=127.0.0.1`
- `PORT=5050`
- `MONGO_URI=mongodb://127.0.0.1:27017/engagement_tracker`
- `JWT_SECRET=replace_with_strong_secret`
- `JWT_EXPIRES_IN=7d`
- `CLIENT_URL=http://localhost:5173`
- `COOKIE_SECURE=false`
- `USE_INMEMORY_DB=true|false` (`true` uses a local JSON datastore at `backend/.data/dev-db.json`)
- `AUTO_DEMO_SEED=true|false`

Frontend (`frontend/.env`):
- `VITE_API_BASE_URL=http://localhost:5050/api`

## Run (Recommended: Docker)
```bash
cd /Users/surya/portfolio/user-engagement-tracker
docker compose up --build -d
```

Open:
- `http://localhost:8080`

Stop:
```bash
docker compose down
```

## Run (Local Dev)
1. Copy env files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. Start MongoDB only if you disable the local dev datastore:
```bash
docker compose up -d mongodb
```

3. Backend:
```bash
cd backend
npm install
npm run dev
```

4. Frontend (new terminal):
```bash
cd frontend
npm install
npm run dev -- --host localhost --port 5173
```

Open:
- `http://localhost:5173`

Optional smoke test:
```bash
cd backend
npm run test:smoke
```

## Demo Seed
```bash
curl -X POST http://localhost:5050/api/dev/seed
curl -X POST http://localhost:5050/api/dev/reset-admin
```

Demo admin credentials:
- `admin@example.com`
- `password123`

## Public Deployment (Render + Vercel)

### 1. Backend on Render
Repository includes: [render.yaml](/Users/surya/portfolio/user-engagement-tracker/render.yaml)

Steps:
1. Push this project to GitHub.
2. In Render, create a new Blueprint deployment from repo root.
3. Set required env values in Render:
   - `MONGO_URI` = your MongoDB Atlas URI
   - `JWT_SECRET` = strong random secret
   - `CLIENT_URL` = your Vercel domain (e.g. `https://your-app.vercel.app`)
4. Deploy service `user-engagement-backend`.

Expected backend URL example:
- `https://user-engagement-backend.onrender.com`

Health URL:
- `https://user-engagement-backend.onrender.com/api/health`

### 2. Frontend on Vercel
Use the repo root as the Vercel project source so `vercel.json` can build `frontend/` and rewrite SPA routes correctly.

Set env var in Vercel:
- `VITE_API_BASE_URL=https://user-engagement-backend.onrender.com/api`

(Template available at `frontend/.env.production.example`.)

Expected frontend URL example:
- `https://user-engagement-tracker.vercel.app`

### 3. Final public URL to share
- Your Vercel app URL, e.g. `https://user-engagement-tracker.vercel.app`

## Production Notes
- Disable dev-only behavior with `NODE_ENV=production`.
- Keep `AUTO_DEMO_SEED=false` in production.
- Use `COOKIE_SECURE=true` behind HTTPS.
