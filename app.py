import os
import sqlite3
from pathlib import Path

from flask import Flask, flash, redirect, render_template, request, session, url_for


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
        CREATE TABLE IF NOT EXISTS user_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            login_time TEXT,
            logout_time TEXT
        )
        """
    )

    db.execute(
        """
        CREATE TABLE IF NOT EXISTS page_visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            page_name TEXT,
            visit_time TEXT
        )
        """
    )

    db.commit()
    db.close()


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
    return render_template("dashboard.html", user=session["user"])


@app.route("/logout")
def logout():
    session.pop("user", None)
    flash("You have been logged out.", "success")
    return redirect(url_for("login"))


init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
