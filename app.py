import logging
import os
import shutil
import sqlite3
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path

from flask import Flask, flash, jsonify, redirect, render_template, request, session, url_for


BASE_DIR = Path(__file__).resolve().parent
LEGACY_DATABASE_PATH = BASE_DIR / "users.db"
DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", BASE_DIR / "database.db"))

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.permanent_session_lifetime = timedelta(hours=12)


def configure_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


def migrate_legacy_database():
    if (
        DATABASE_PATH == BASE_DIR / "database.db"
        and not DATABASE_PATH.exists()
        and LEGACY_DATABASE_PATH.exists()
    ):
        shutil.copy2(LEGACY_DATABASE_PATH, DATABASE_PATH)
        app.logger.info("Migrated legacy SQLite data from users.db to database.db")


def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if "user" not in session:
            flash("Please log in to access the dashboard.", "error")
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped_view


def init_db():
    migrate_legacy_database()
    db = get_db()

    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
        """
    )

    db.execute(
        """
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            action TEXT NOT NULL,
            timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    db.commit()
    db.close()


def log_action(username, action):
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    db = get_db()
    db.execute(
        "INSERT INTO logs (username, action, timestamp) VALUES (?, ?, ?)",
        (username, action, timestamp),
    )
    db.commit()
    db.close()
    app.logger.info("Tracked action for %s: %s", username, action)


def build_last_seven_days_series(rows):
    day_counts = {row["day"]: row["count"] for row in rows}
    labels = []
    values = []

    for index in range(6, -1, -1):
        day = (datetime.utcnow() - timedelta(days=index)).date()
        key = day.isoformat()
        labels.append(day.strftime("%b %d"))
        values.append(day_counts.get(key, 0))

    return labels, values


def format_peak_hour(hour_value):
    if hour_value is None:
        return "No login data yet"

    hour = int(hour_value)
    period = "AM" if hour < 12 else "PM"
    display_hour = hour % 12 or 12
    return f"{display_hour}:00 {period}"


def serialize_logs(rows):
    return [
        {
            "username": row["username"],
            "action": row["action"],
            "timestamp": row["timestamp"],
        }
        for row in rows
    ]


def fetch_dashboard_data():
    db = get_db()
    cutoff = (datetime.utcnow() - timedelta(days=6)).strftime("%Y-%m-%d 00:00:00")

    total_users = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    total_logins = db.execute(
        "SELECT COUNT(*) FROM logs WHERE action = ?",
        ("user login",),
    ).fetchone()[0]
    total_visits = db.execute(
        "SELECT COUNT(*) FROM logs WHERE action = ?",
        ("dashboard visit",),
    ).fetchone()[0]

    recent_logs = db.execute(
        """
        SELECT username, action, timestamp
        FROM logs
        ORDER BY datetime(timestamp) DESC, id DESC
        LIMIT 10
        """
    ).fetchall()

    activity_rows = db.execute(
        """
        SELECT DATE(timestamp) AS day, COUNT(*) AS count
        FROM logs
        WHERE datetime(timestamp) >= datetime(?)
        GROUP BY DATE(timestamp)
        ORDER BY day ASC
        """,
        (cutoff,),
    ).fetchall()

    login_frequency_rows = db.execute(
        """
        SELECT DATE(timestamp) AS day, COUNT(*) AS count
        FROM logs
        WHERE action = ? AND datetime(timestamp) >= datetime(?)
        GROUP BY DATE(timestamp)
        ORDER BY day ASC
        """,
        ("user login", cutoff),
    ).fetchall()

    most_active_row = db.execute(
        """
        SELECT username, COUNT(*) AS count
        FROM logs
        GROUP BY username
        ORDER BY count DESC, username ASC
        LIMIT 1
        """
    ).fetchone()

    peak_login_row = db.execute(
        """
        SELECT strftime('%H', timestamp) AS hour_bucket, COUNT(*) AS count
        FROM logs
        WHERE action = ?
        GROUP BY hour_bucket
        ORDER BY count DESC, hour_bucket ASC
        LIMIT 1
        """,
        ("user login",),
    ).fetchone()

    db.close()

    activity_labels, activity_values = build_last_seven_days_series(activity_rows)
    login_labels, login_values = build_last_seven_days_series(login_frequency_rows)

    insights = {
        "most_active_user": most_active_row["username"] if most_active_row else "No activity yet",
        "most_active_count": most_active_row["count"] if most_active_row else 0,
        "peak_login_time": format_peak_hour(
            peak_login_row["hour_bucket"] if peak_login_row else None
        ),
    }

    return {
        "stats": {
            "total_users": total_users,
            "total_logins": total_logins,
            "total_visits": total_visits,
            "recent_activity": [
                {"label": label, "value": value}
                for label, value in zip(activity_labels, activity_values)
            ],
        },
        "charts": {
            "activity": {"labels": activity_labels, "values": activity_values},
            "login_frequency": {"labels": login_labels, "values": login_values},
        },
        "insights": insights,
        "recent_logs": serialize_logs(recent_logs),
    }


@app.route("/")
def home():
    return render_template("home.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()

        if not username or not password:
            flash("Username and password are required.", "error")
            return redirect(url_for("register"))

        db = get_db()
        try:
            db.execute(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                (username, password),
            )
            db.commit()
        except sqlite3.IntegrityError:
            db.close()
            flash("That username already exists. Try another one.", "error")
            return redirect(url_for("register"))
        except sqlite3.Error:
            db.close()
            app.logger.exception("Registration failed for %s", username)
            flash("Something went wrong while creating your account.", "error")
            return redirect(url_for("register"))

        db.close()
        log_action(username, "user registration")
        flash("Registration successful. You can log in now.", "success")
        return redirect(url_for("login"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()

        if not username or not password:
            flash("Please enter both username and password.", "error")
            return redirect(url_for("login"))

        db = get_db()
        try:
            user = db.execute(
                "SELECT * FROM users WHERE username = ? AND password = ?",
                (username, password),
            ).fetchone()
        except sqlite3.Error:
            db.close()
            app.logger.exception("Login query failed for %s", username)
            flash("Unable to sign you in right now. Please try again.", "error")
            return redirect(url_for("login"))

        db.close()

        if user:
            session.clear()
            session["user"] = username
            session.permanent = True
            log_action(username, "user login")
            flash("Login successful.", "success")
            return redirect(url_for("dashboard"))

        flash("Invalid credentials. Please try again.", "error")
        return redirect(url_for("login"))

    return render_template("login.html")


@app.route("/dashboard")
@login_required
def dashboard():
    log_action(session["user"], "dashboard visit")
    dashboard_data = fetch_dashboard_data()
    return render_template(
        "dashboard.html",
        user=session["user"],
        dashboard_data=dashboard_data,
    )


@app.route("/api/stats")
@login_required
def api_stats():
    dashboard_data = fetch_dashboard_data()
    return jsonify(
        {
            **dashboard_data["stats"],
            "charts": dashboard_data["charts"],
            "insights": dashboard_data["insights"],
            "recent_logs": dashboard_data["recent_logs"],
        }
    )


@app.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out.", "success")
    return redirect(url_for("login"))


configure_logging()
init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
