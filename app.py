import logging
import os
import shutil
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from flask import Flask, flash, jsonify, redirect, render_template, request, session, url_for
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import joinedload


BASE_DIR = Path(__file__).resolve().parent
LEGACY_DATABASE_PATH = BASE_DIR / "users.db"
DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", BASE_DIR / "database.db"))
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-me")
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", app.config["SECRET_KEY"])
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=12)
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DATABASE_PATH.as_posix()}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
app.permanent_session_lifetime = timedelta(hours=12)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)


class APIError(Exception):
    def __init__(self, message, status_code=400, details=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    logs = db.relationship(
        "Log",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Log(db.Model):
    __tablename__ = "logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = db.Column(db.String(120), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    user = db.relationship("User", back_populates="logs")


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
        app.logger.info("Copied legacy database from users.db to database.db")


def initialize_database():
    migrate_legacy_database()
    with app.app_context():
        db.create_all()
        upgrade_legacy_schema()


def is_api_request():
    return request.path.startswith("/api/")


def serialize_user(user):
    return {
        "id": user.id,
        "username": user.username,
    }


def serialize_log(log):
    timestamp = log.timestamp
    if isinstance(timestamp, datetime):
        timestamp_text = timestamp.strftime("%Y-%m-%d %H:%M:%S")
    else:
        timestamp_text = str(timestamp)

    return {
        "id": log.id,
        "user_id": log.user_id,
        "username": log.user.username if log.user else "Unknown",
        "action": log.action,
        "timestamp": timestamp_text,
    }


def json_response(payload, status_code=200):
    return jsonify(payload), status_code


def validate_required_fields(data, fields):
    missing = [field for field in fields if not str(data.get(field, "")).strip()]
    if missing:
        raise APIError("Missing required fields.", 400, {"fields": missing})


def validate_username(username):
    value = username.strip()
    if len(value) < 3:
        raise APIError("Username must be at least 3 characters long.", 400)
    if len(value) > 80:
        raise APIError("Username must be 80 characters or fewer.", 400)
    return value


def validate_password(password):
    value = password.strip()
    if len(value) < 6:
        raise APIError("Password must be at least 6 characters long.", 400)
    return value


def get_request_data():
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form.to_dict()


def get_current_session_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return db.session.get(User, user_id)


def login_page_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        current_user = get_current_session_user()
        if not current_user:
            session.clear()
            flash("Please log in to continue.", "error")
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped


def get_jwt_user():
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if not user:
        raise APIError("Authenticated user was not found.", 401)
    return user


def issue_access_token(user):
    return create_access_token(identity=str(user.id), additional_claims={"username": user.username})


def set_session_user(user):
    session.clear()
    session.permanent = True
    session["user_id"] = user.id
    session["username"] = user.username


def create_log_entry(user, action):
    log = Log(user_id=user.id, action=action, timestamp=datetime.now(timezone.utc))
    try:
        db.session.add(log)
        db.session.commit()
        app.logger.info("Tracked action '%s' for user '%s'", action, user.username)
        return log
    except SQLAlchemyError as error:
        db.session.rollback()
        app.logger.exception("Failed to create log entry '%s' for '%s': %s", action, user.username, error)
        return None


def register_user(username, password):
    normalized_username = validate_username(username)
    validated_password = validate_password(password)

    existing_user = User.query.filter(func.lower(User.username) == normalized_username.lower()).first()
    if existing_user:
        raise APIError("That username already exists.", 409)

    password_hash = bcrypt.generate_password_hash(validated_password).decode("utf-8")
    user = User(username=normalized_username, password_hash=password_hash)
    try:
        db.session.add(user)
        db.session.commit()
    except SQLAlchemyError as error:
        db.session.rollback()
        app.logger.exception("Failed to register user '%s': %s", normalized_username, error)
        raise APIError(
            "Database write failed. If this is deployed on Render, set DATABASE_PATH to /var/data/database.db and attach a disk.",
            500,
        ) from error
    create_log_entry(user, "user registration")
    return user


def authenticate_user(username, password):
    normalized_username = username.strip()
    candidate = User.query.filter(func.lower(User.username) == normalized_username.lower()).first()
    if not candidate or not bcrypt.check_password_hash(candidate.password_hash, password):
        raise APIError("Invalid username or password.", 401)
    create_log_entry(candidate, "user login")
    return candidate


def paginate_query(query, page, per_page):
    current_page = max(page, 1)
    limit = max(1, min(per_page, 50))
    total = query.count()
    items = query.offset((current_page - 1) * limit).limit(limit).all()
    pages = max((total + limit - 1) // limit, 1)
    return items, {"page": current_page, "per_page": limit, "total": total, "pages": pages}


def build_recent_series(action=None):
    cutoff = datetime.now(timezone.utc) - timedelta(days=6)
    date_key = func.date(Log.timestamp)
    query = db.session.query(date_key.label("day"), func.count(Log.id).label("count")).filter(Log.timestamp >= cutoff)
    if action:
        query = query.filter(Log.action == action)
    rows = query.group_by("day").order_by("day").all()
    lookup = {row.day: row.count for row in rows}

    series = []
    for index in range(6, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=index)).date()
        label = day.strftime("%b %d")
        value = int(lookup.get(day.isoformat(), 0))
        series.append({"label": label, "value": value})
    return series


def build_stats_payload():
    total_users = db.session.query(func.count(User.id)).scalar() or 0
    total_logins = db.session.query(func.count(Log.id)).filter(Log.action == "user login").scalar() or 0
    total_visits = db.session.query(func.count(Log.id)).filter(Log.action == "dashboard visit").scalar() or 0

    activity_series = build_recent_series()
    login_series = build_recent_series("user login")

    most_active_user = (
        db.session.query(User.username, func.count(Log.id).label("activity_count"))
        .join(Log, Log.user_id == User.id)
        .group_by(User.id)
        .order_by(func.count(Log.id).desc(), User.username.asc())
        .first()
    )

    peak_login = (
        db.session.query(func.strftime("%H", Log.timestamp).label("hour_bucket"), func.count(Log.id).label("total"))
        .filter(Log.action == "user login")
        .group_by("hour_bucket")
        .order_by(func.count(Log.id).desc(), "hour_bucket")
        .first()
    )

    if peak_login and peak_login.hour_bucket is not None:
        hour_value = int(peak_login.hour_bucket)
        suffix = "AM" if hour_value < 12 else "PM"
        peak_login_text = f"{hour_value % 12 or 12}:00 {suffix}"
    else:
        peak_login_text = "No login data yet"

    recent_logs = Log.query.options(joinedload(Log.user)).order_by(Log.timestamp.desc(), Log.id.desc()).limit(10).all()

    return {
        "total_users": int(total_users),
        "total_logins": int(total_logins),
        "total_visits": int(total_visits),
        "recent_activity": activity_series,
        "charts": {
            "activity": {
                "labels": [item["label"] for item in activity_series],
                "values": [item["value"] for item in activity_series],
            },
            "login_frequency": {
                "labels": [item["label"] for item in login_series],
                "values": [item["value"] for item in login_series],
            },
        },
        "insights": {
            "most_active_user": most_active_user.username if most_active_user else "No activity yet",
            "most_active_count": int(most_active_user.activity_count) if most_active_user else 0,
            "peak_login_time": peak_login_text,
        },
        "recent_logs": [serialize_log(log) for log in recent_logs],
    }


def build_page_auth_payload(user):
    return {
        "token": issue_access_token(user),
        "user": serialize_user(user),
    }


def upgrade_legacy_schema():
    inspector = inspect(db.engine)
    tables = set(inspector.get_table_names())

    if "users" in tables:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "password_hash" not in user_columns and "password" in user_columns:
            with db.engine.begin() as connection:
                connection.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))
                rows = connection.execute(text("SELECT id, password FROM users")).mappings().all()
                for row in rows:
                    hashed = bcrypt.generate_password_hash(row["password"] or "").decode("utf-8")
                    connection.execute(
                        text("UPDATE users SET password_hash = :password_hash WHERE id = :user_id"),
                        {"password_hash": hashed, "user_id": row["id"]},
                    )
            app.logger.info("Migrated legacy password column to password_hash")

    inspector = inspect(db.engine)
    if "logs" in inspector.get_table_names():
        log_columns = {column["name"] for column in inspector.get_columns("logs")}
        if "user_id" not in log_columns and "username" in log_columns:
            with db.engine.begin() as connection:
                connection.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS logs_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL,
                            action VARCHAR(120) NOT NULL,
                            timestamp DATETIME NOT NULL,
                            FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
                        )
                        """
                    )
                )

                rows = connection.execute(
                    text(
                        """
                        SELECT logs.id, logs.username, logs.action, logs.timestamp, users.id AS user_id
                        FROM logs
                        LEFT JOIN users ON users.username = logs.username
                        ORDER BY logs.id ASC
                        """
                    )
                ).mappings().all()

                for row in rows:
                    if row["user_id"] is None:
                        continue
                    connection.execute(
                        text(
                            """
                            INSERT INTO logs_new (id, user_id, action, timestamp)
                            VALUES (:id, :user_id, :action, :timestamp)
                            """
                        ),
                        {
                            "id": row["id"],
                            "user_id": row["user_id"],
                            "action": row["action"],
                            "timestamp": row["timestamp"],
                        },
                    )

                connection.execute(text("DROP TABLE logs"))
                connection.execute(text("ALTER TABLE logs_new RENAME TO logs"))
            app.logger.info("Migrated legacy logs table to user_id-based schema")


@app.after_request
def apply_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    return response


@jwt.unauthorized_loader
def handle_missing_token(reason):
    return json_response({"error": {"message": reason}}, 401)


@jwt.invalid_token_loader
def handle_invalid_token(reason):
    return json_response({"error": {"message": reason}}, 422)


@jwt.expired_token_loader
def handle_expired_token(jwt_header, jwt_payload):
    return json_response({"error": {"message": "Token has expired."}}, 401)


@app.errorhandler(APIError)
def handle_api_error(error):
    payload = {"error": {"message": error.message}}
    if error.details:
        payload["error"]["details"] = error.details
    if is_api_request():
        return json_response(payload, error.status_code)
    flash(error.message, "error")
    return redirect(request.referrer or url_for("home"))


@app.errorhandler(404)
def handle_not_found(error):
    if is_api_request():
        return json_response({"error": {"message": "Resource not found."}}, 404)
    flash("The page you requested could not be found.", "error")
    return redirect(url_for("home"))


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    app.logger.exception("Unhandled application error: %s", error)
    if is_api_request():
        return json_response({"error": {"message": "Internal server error."}}, 500)
    flash("Something unexpected happened. Please try again.", "error")
    return redirect(url_for("home"))


@app.route("/")
def home():
    return render_template("home.html", session_user=get_current_session_user())


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        data = get_request_data()
        try:
            validate_required_fields(data, ["username", "password"])
            user = authenticate_user(data["username"], data["password"])
            set_session_user(user)
            flash("Login successful.", "success")
            return redirect(url_for("dashboard"))
        except APIError as error:
            flash(error.message, "error")
            return redirect(url_for("login"))

    return render_template("login.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        data = get_request_data()
        try:
            validate_required_fields(data, ["username", "password"])
            register_user(data["username"], data["password"])
            flash("Registration successful. Please log in.", "success")
            return redirect(url_for("login"))
        except APIError as error:
            flash(error.message, "error")
            return redirect(url_for("register"))

    return render_template("register.html")


@app.route("/dashboard")
@login_page_required
def dashboard():
    current_user = get_current_session_user()
    create_log_entry(current_user, "dashboard visit")
    return render_template(
        "dashboard.html",
        bootstrap={
            "auth": build_page_auth_payload(current_user),
            "stats": build_stats_payload(),
        },
    )


@app.route("/user-management")
@login_page_required
def user_management():
    current_user = get_current_session_user()
    users_query = User.query.order_by(User.username.asc())
    users, pagination = paginate_query(users_query, 1, 10)
    return render_template(
        "user_management.html",
        bootstrap={
            "auth": build_page_auth_payload(current_user),
            "users": [serialize_user(user) for user in users],
            "pagination": pagination,
        },
    )


@app.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    if is_api_request() or request.method == "POST":
        return json_response({"message": "Logged out successfully."})
    flash("You have been logged out.", "success")
    return redirect(url_for("login"))


@app.route("/api/health")
def api_health():
    return json_response({"status": "ok", "database": "sqlite", "service": "user-engagement-tracker"})


@app.route("/api/register", methods=["POST"])
def api_register():
    data = get_request_data()
    validate_required_fields(data, ["username", "password"])
    user = register_user(data["username"], data["password"])
    return json_response({"message": "User registered successfully.", "user": serialize_user(user)}, 201)


@app.route("/api/login", methods=["POST"])
def api_login():
    data = get_request_data()
    validate_required_fields(data, ["username", "password"])
    user = authenticate_user(data["username"], data["password"])
    token = issue_access_token(user)
    set_session_user(user)
    return json_response(
        {
            "message": "Login successful.",
            "access_token": token,
            "user": serialize_user(user),
        }
    )


@app.route("/api/users", methods=["GET"])
@jwt_required()
def api_users():
    get_jwt_user()
    search = request.args.get("search", "").strip()
    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=10, type=int)

    query = User.query.order_by(User.username.asc())
    if search:
        query = query.filter(User.username.ilike(f"%{search}%"))

    users, pagination = paginate_query(query, page, per_page)
    return json_response(
        {
            "items": [serialize_user(user) for user in users],
            "pagination": pagination,
        }
    )


@app.route("/api/users/<int:user_id>", methods=["GET"])
@jwt_required()
def api_user_detail(user_id):
    get_jwt_user()
    user = db.session.get(User, user_id)
    if not user:
        raise APIError("User not found.", 404)
    return json_response({"user": serialize_user(user)})


@app.route("/api/users/<int:user_id>", methods=["PUT"])
@jwt_required()
def api_user_update(user_id):
    current_user = get_jwt_user()
    user = db.session.get(User, user_id)
    if not user:
        raise APIError("User not found.", 404)

    data = get_request_data()
    username = data.get("username", user.username)
    password = data.get("password", "").strip()
    user.username = validate_username(username)

    duplicate = User.query.filter(func.lower(User.username) == user.username.lower(), User.id != user.id).first()
    if duplicate:
        raise APIError("That username already exists.", 409)

    if password:
        user.password_hash = bcrypt.generate_password_hash(validate_password(password)).decode("utf-8")

    db.session.commit()
    create_log_entry(current_user, f"updated user {user.username}")
    session["username"] = current_user.username
    return json_response({"message": "User updated successfully.", "user": serialize_user(user)})


@app.route("/api/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
def api_user_delete(user_id):
    current_user = get_jwt_user()
    user = db.session.get(User, user_id)
    if not user:
        raise APIError("User not found.", 404)

    deleted_user = serialize_user(user)
    deleting_self = current_user.id == user.id
    db.session.delete(user)
    db.session.commit()

    if not deleting_self:
        create_log_entry(current_user, f"deleted user {deleted_user['username']}")
    else:
        session.clear()

    return json_response({"message": "User deleted successfully.", "user": deleted_user, "deleted_self": deleting_self})


@app.route("/api/logs", methods=["GET"])
@jwt_required()
def api_logs():
    get_jwt_user()
    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=10, type=int)
    start_date = request.args.get("start_date", "").strip()
    end_date = request.args.get("end_date", "").strip()

    query = Log.query.options(joinedload(Log.user)).order_by(Log.timestamp.desc(), Log.id.desc())

    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError as error:
            raise APIError("Invalid start_date. Use YYYY-MM-DD.", 400) from error
        query = query.filter(Log.timestamp >= start_dt)

    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        except ValueError as error:
            raise APIError("Invalid end_date. Use YYYY-MM-DD.", 400) from error
        query = query.filter(Log.timestamp < end_dt)

    logs, pagination = paginate_query(query, page, per_page)
    return json_response({"items": [serialize_log(log) for log in logs], "pagination": pagination})


@app.route("/api/logs", methods=["POST"])
@jwt_required()
def api_logs_create():
    current_user = get_jwt_user()
    data = get_request_data()
    validate_required_fields(data, ["action"])

    action = data["action"].strip()
    target_user = current_user
    provided_user_id = data.get("user_id")
    if provided_user_id:
        target_user = db.session.get(User, int(provided_user_id))
        if not target_user:
            raise APIError("Target user not found.", 404)

    log = create_log_entry(target_user, action)
    if target_user.id != current_user.id:
        create_log_entry(current_user, f"logged action for user {target_user.username}")
    return json_response({"message": "Log created successfully.", "log": serialize_log(log)}, 201)


@app.route("/api/stats", methods=["GET"])
@jwt_required()
def api_stats():
    get_jwt_user()
    return json_response(build_stats_payload())


configure_logging()
initialize_database()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
