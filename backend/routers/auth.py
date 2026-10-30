import secrets
import collections
import time
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from ..database import get_db_cursor
from ..schemas import LoginRequest, LoginResponse, UserResponse, ForgotPasswordRequest, ResetPasswordRequest
from ..auth import verify_password, create_access_token, get_current_user, get_password_hash
from ..email_service import send_password_reset_email

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# In-memory security rate-limiting caches
_FAILED_LOGINS = collections.defaultdict(list)    # email -> list of attempt timestamps
_FORGOT_REQUESTS = collections.defaultdict(list)  # email -> list of request timestamps

MAX_FAILED_LOGINS = 5
LOCKOUT_WINDOW_SECONDS = 900   # 15 minutes

MAX_FORGOT_REQUESTS = 3
FORGOT_WINDOW_SECONDS = 600   # 10 minutes

def _is_login_rate_limited(email: str) -> bool:
    now = time.time()
    _FAILED_LOGINS[email] = [t for t in _FAILED_LOGINS[email] if now - t < LOCKOUT_WINDOW_SECONDS]
    return len(_FAILED_LOGINS[email]) >= MAX_FAILED_LOGINS

def _record_failed_login(email: str):
    _FAILED_LOGINS[email].append(time.time())

def _clear_failed_logins(email: str):
    _FAILED_LOGINS.pop(email, None)

def _is_forgot_rate_limited(email: str) -> bool:
    now = time.time()
    _FORGOT_REQUESTS[email] = [t for t in _FORGOT_REQUESTS[email] if now - t < FORGOT_WINDOW_SECONDS]
    return len(_FORGOT_REQUESTS[email]) >= MAX_FORGOT_REQUESTS

def _record_forgot_request(email: str):
    _FORGOT_REQUESTS[email].append(time.time())

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    email = payload.email.strip().lower()

    # Rate limiting protection against brute-force password guessing
    if _is_login_rate_limited(email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. For security reasons, please wait 15 minutes or reset your password."
        )

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT * FROM users WHERE LOWER(email) = %s;", (email,))
        row = cur.fetchone()
        if not row:
            _record_failed_login(email)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

        cols = [desc[0] for desc in cur.description]
        user_dict = dict(zip(cols, row))

        if not user_dict.get("is_active"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated.")

        # Strict bcrypt hash verification — rejects old password immediately
        if not verify_password(payload.password, user_dict.get("password_hash", "")):
            _record_failed_login(email)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

        # Clear failed login counter upon successful authentication
        _clear_failed_logins(email)

        # Update last_login_at
        cur.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = %s;", (user_dict["id"],))

        # Generate JWT token
        token_data = {
            "id": str(user_dict["id"]),
            "email": user_dict["email"],
            "role": user_dict["role"],
            "first_name": user_dict["first_name"],
            "last_name": user_dict["last_name"],
            "organization_id": str(user_dict["organization_id"]) if user_dict.get("organization_id") else None,
            "assigned_site_id": None,
        }
        token = create_access_token(token_data)

        # Remove sensitive password_hash before returning
        user_dict.pop("password_hash", None)
        user_dict["id"] = str(user_dict["id"])
        if user_dict.get("organization_id"):
            user_dict["organization_id"] = str(user_dict["organization_id"])

        return LoginResponse(token=token, user=UserResponse(**user_dict))

@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    user_dict = current_user.copy()
    user_dict["id"] = str(user_dict["id"])
    if user_dict.get("organization_id"):
        user_dict["organization_id"] = str(user_dict["organization_id"])
    return UserResponse(**user_dict)

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    email = payload.email.strip().lower()

    # Rate limiting protection against email bombing / abuse
    if _is_forgot_rate_limited(email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests. Please wait 10 minutes before requesting another reset email."
        )

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, first_name, last_name, is_active FROM users WHERE LOWER(email) = %s;", (email,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account found with this email address. Please check and try again."
            )

        user_id, first_name, last_name, is_active = row
        if not is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated.")

        # Generate 32-byte secure URL-safe token
        token = secrets.token_urlsafe(32)
        # 30-minute token expiration window
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

        cur.execute("""
            UPDATE users 
            SET reset_token = %s, reset_token_expires_at = %s 
            WHERE id = %s;
        """, (token, expires_at, user_id))

        recipient_name = f"{first_name} {last_name}".strip()
        email_result = send_password_reset_email(to_email=email, token=token, recipient_name=recipient_name)

        if not email_result.get("sent"):
            # Clear reset token on email failure so user isn't stuck with unreachable token
            cur.execute("""
                UPDATE users 
                SET reset_token = NULL, reset_token_expires_at = NULL 
                WHERE id = %s;
            """, (user_id,))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to deliver password reset email. Error: {email_result.get('error', 'Mail server error')}"
            )

        _record_forgot_request(email)

        return {
            "success": True,
            "message": "Password reset link sent to your email",
            "email": email,
            "expires_in_minutes": 30
        }

@router.post("/verify-reset-token")
def verify_reset_token(payload: dict):
    token = payload.get("token")
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token is required.")

    with get_db_cursor(commit=False) as cur:
        cur.execute("""
            SELECT id, email, reset_token_expires_at 
            FROM users 
            WHERE reset_token = %s;
        """, (token,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset link.")

        user_id, email, expires_at = row
        if expires_at and expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link has expired (valid for 30 minutes). Please request a new one.")

        return {"valid": True, "email": email}

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest):
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            SELECT id, email, reset_token_expires_at, password_hash, is_active 
            FROM users 
            WHERE reset_token = %s;
        """, (payload.token,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")

        user_id, email, expires_at, current_hash, is_active = row
        if not is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated.")

        if expires_at and expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link has expired. Please request a new one.")

        # Prevent reusing current password
        if verify_password(payload.new_password, current_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password cannot be the same as your current password. Please choose a different password."
            )

        # Hash new password with bcrypt (12 salt rounds)
        new_hash = get_password_hash(payload.new_password)

        # Clear reset token, update password and reset failed login attempts
        cur.execute("""
            UPDATE users 
            SET password_hash = %s, reset_token = NULL, reset_token_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (new_hash, user_id))

        _clear_failed_logins(email)

        return {"success": True, "message": "Password has been updated successfully."}


