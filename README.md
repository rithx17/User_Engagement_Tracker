# User Engagement Tracker

User Engagement Tracker is a Flask-based full-stack analytics system built for academic review and deployment demos. It combines REST APIs, JWT authentication, CRUD operations, SQLite analytics, responsive dashboards, and documentation in a single Render-ready project.

## Live URL
- Expected Render URL: `https://user-engagement-tracker.onrender.com`
- Health check: `https://user-engagement-tracker.onrender.com/api/health`

## Tech Stack
- Backend: Flask, SQLAlchemy ORM, Flask-JWT-Extended, Flask-Bcrypt
- Frontend: Jinja templates, vanilla JavaScript, Chart.js, custom CSS
- Database: SQLite
- Testing: Pytest
- Deployment: Render
- CI: GitHub Actions

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
├── app.py
├── database.db
├── requirements.txt
├── render.yaml
├── templates/
│   ├── base.html
│   ├── home.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   └── user_management.html
├── static/
│   ├── auth.js
│   ├── common.js
│   ├── dashboard.js
│   ├── users.js
│   └── style.css
├── tests/
│   └── test_app.py
├── docs/
│   └── postman_collection.json
└── .github/workflows/python-ci.yml
```

## Setup
1. Create and activate a virtual environment.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
4. Run the app locally:
   ```bash
   gunicorn app:app
   ```
   Or for development:
   ```bash
   python app.py
   ```

## Environment Variables
- `SECRET_KEY`: Flask session secret
- `JWT_SECRET_KEY`: JWT signing secret
- `DATABASE_PATH`: SQLite path, defaults to `database.db`
- `PORT`: Flask/Gunicorn port
- `COOKIE_SECURE`: `true` in production behind HTTPS

## REST API Endpoints

### Auth
- `POST /api/register`
- `POST /api/login`

### Users
- `GET /api/users`
- `GET /api/users/<id>`
- `PUT /api/users/<id>`
- `DELETE /api/users/<id>`

### Logs
- `GET /api/logs`
- `POST /api/logs`

### Stats
- `GET /api/stats`

### Utility
- `GET /api/health`

## Example API Responses

### `POST /api/login`
```json
{
  "message": "Login successful.",
  "access_token": "jwt-token",
  "user": {
    "id": 1,
    "username": "alice"
  }
}
```

### `GET /api/stats`
```json
{
  "total_users": 5,
  "total_logins": 18,
  "total_visits": 24,
  "recent_activity": [
    { "label": "Apr 01", "value": 2 }
  ],
  "charts": {
    "activity": {
      "labels": ["Apr 01"],
      "values": [2]
    },
    "login_frequency": {
      "labels": ["Apr 01"],
      "values": [1]
    }
  },
  "insights": {
    "most_active_user": "alice",
    "most_active_count": 7,
    "peak_login_time": "6:00 PM"
  },
  "recent_logs": []
}
```

## Postman Documentation
- Import [docs/postman_collection.json](/Users/surya/portfolio/user-engagement-tracker/docs/postman_collection.json) into Postman.
- Set `base_url`, `token`, and `user_id` collection variables.

## Testing
Run:
```bash
pytest
```

Current tests cover:
- user registration
- login success and failure
- protected user endpoints
- CRUD flow
- stats payload shape

## Deployment on Render
- Runtime: Python
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app`
- Health check: `/api/health`

Use the included [render.yaml](/Users/surya/portfolio/user-engagement-tracker/render.yaml) to create the web service.

## Academic Review Notes
- SQLAlchemy is used for ORM-based database access
- JWT secures the JSON API
- Passwords are stored as bcrypt hashes, not plaintext
- Client pages use fetch + local state with JWT stored in `localStorage`
- Dashboard and user management views demonstrate full-stack integration
