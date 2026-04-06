import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from flask import Flask, flash, jsonify, redirect, render_template, request, session, url_for


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", BASE_DIR / "users.db"))

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")


def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
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
    db = get_db()
    db.execute(
        "INSERT INTO logs (username, action, timestamp) VALUES (?, ?, ?)",
        (username, action, datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")),
    )
    db.commit()
    db.close()


def fetch_dashboard_data():
    db = get_db()

    total_users = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    total_logins = db.execute(
        "SELECT COUNT(*) FROM logs WHERE action = ?",
        ("user login",),
    ).fetchone()[0]
    total_visits = db.execute(
        "SELECT COUNT(*) FROM logs WHERE action = ?",
        ("page visit (dashboard)",),
    ).fetchone()[0]

    recent_logs = db.execute(
        """
        SELECT username, action, timestamp
        FROM logs
        ORDER BY datetime(timestamp) DESC, id DESC
        LIMIT 10
        """
    ).fetchall()

    cutoff = (datetime.utcnow() - timedelta(days=6)).strftime("%Y-%m-%d 00:00:00")
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

    db.close()

    day_counts = {row["day"]: row["count"] for row in activity_rows}
    activity_labels = []
    activity_values = []
    for index in range(6, -1, -1):
        day = (datetime.utcnow() - timedelta(days=index)).date()
        key = day.isoformat()
        activity_labels.append(day.strftime("%b %d"))
        activity_values.append(day_counts.get(key, 0))

    return {
        "stats": {
            "total_users": total_users,
            "total_logins": total_logins,
            "total_visits": total_visits,
        },
        "recent_logs": recent_logs,
        "activity_labels": activity_labels,
        "activity_values": activity_values,
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
        user = db.execute(
            "SELECT * FROM users WHERE username = ? AND password = ?",
            (username, password),
        ).fetchone()
        db.close()

        if user:
            session["user"] = username
            log_action(username, "user login")
            flash("Login successful.", "success")
            return redirect(url_for("dashboard"))

        flash("Invalid credentials. Please try again.", "error")
        return redirect(url_for("login"))

    return render_template("login.html")


@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        flash("Please log in to access the dashboard.", "error")
        return redirect(url_for("login"))

    log_action(session["user"], "page visit (dashboard)")
    dashboard_data = fetch_dashboard_data()
    return render_template(
        "dashboard.html",
        user=session["user"],
        stats=dashboard_data["stats"],
        recent_logs=dashboard_data["recent_logs"],
        activity_labels=dashboard_data["activity_labels"],
        activity_values=dashboard_data["activity_values"],
    )


@app.route("/api/stats")
def api_stats():
    if "user" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    dashboard_data = fetch_dashboard_data()
    return jsonify(dashboard_data["stats"])


@app.route("/logout")
def logout():
    session.pop("user", None)
    flash("You have been logged out.", "success")
    return redirect(url_for("login"))


init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
