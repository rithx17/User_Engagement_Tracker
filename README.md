# User Engagement Tracker

User Engagement Tracker currently contains two codepaths:

- Legacy Flask app at the repo root
- Active full-stack app with React frontend in [`frontend/`](/Users/surya/portfolio/user-engagement-tracker/frontend) and Express backend in [`backend/`](/Users/surya/portfolio/user-engagement-tracker/backend)

For frontend/backend integration and Render deployment, use the React + Express stack.

## Active Stack
- Frontend: React, Vite, React Router, Recharts
- Backend: Express, JWT auth, cookie auth, analytics/admin APIs
- Data: in-memory demo DB by default, optional MongoDB
- Deployment: Render static site + Render web service

## Features
- JWT-based authentication for REST APIs
- Session-backed server-rendered pages for dashboard navigation
- Password hashing with bcrypt
- Full CRUD for users
- Activity logging with analytics insights
- Search, pagination, and log date filtering
- Chart.js dashboard with line and bar charts
- Secure headers, validation, and structured error handling
- Postman collection for API review

## Project Structure
```text
user-engagement-tracker/
├── backend/
├── frontend/
├── render.fullstack.yaml
├── render.yaml
└── app.py
```

## Local Development

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Notes:

- Frontend dev server runs on `http://localhost:5173`
- Backend runs on `http://127.0.0.1:5050`
- Vite now proxies `/api` to the backend in development
- In production, set `VITE_API_BASE_URL` to your backend Render URL

## API Summary
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/events/track`
- `GET /api/analytics/overview`
- `GET /api/analytics/users`
- `GET /api/analytics/events`
- `GET /api/analytics/export`
- `GET /api/admin/users`
- `GET /api/health`

## Postman Documentation
- Import [docs/postman_collection.json](/Users/surya/portfolio/user-engagement-tracker/docs/postman_collection.json) into Postman.
- Set `base_url`, `token`, and `user_id` collection variables.

## Diagnostics

Frontend build:
```bash
npm run build
```

Backend smoke test:
```bash
cd backend
npm run test:smoke
```

## Render Deployment

Use [`render.fullstack.yaml`](/Users/surya/portfolio/user-engagement-tracker/render.fullstack.yaml) for the active React + Express stack:

- Backend: Render web service from `backend/`
- Frontend: Render static site from `frontend/`
- Set backend `CLIENT_URL` to the frontend Render URL
- Set frontend `VITE_API_BASE_URL` to the backend Render URL plus `/api`

The older [`render.yaml`](/Users/surya/portfolio/user-engagement-tracker/render.yaml) is for the legacy Flask app and should not be used for the React + Express deployment.
