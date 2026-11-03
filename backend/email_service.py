import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp-relay.brevo.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Foodie Platform")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

def is_smtp_configured() -> bool:
    """Check if SMTP credentials have been provided."""
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD and SMTP_FROM_EMAIL)

def send_password_reset_email(to_email: str, token: str, recipient_name: str = "") -> dict:
    """
    Sends a branded password reset email with a 30-minute expiration token via Brevo SMTP relay.
    """
    reset_url = f"{FRONTEND_URL}/login?view=reset&token={token}&email={to_email}"
    display_name = recipient_name.strip() if recipient_name and recipient_name.strip() else to_email.split('@')[0]

    subject = "Reset your Foodie Dashboard password"

    plain_content = f"""Hello {display_name},

We received a request to reset the password for your Foodie account associated with {to_email}.

Click the link below (or copy and paste it into your browser) to choose a new password:
{reset_url}

This password reset link will expire in 30 minutes for your security.
If you did not request a password reset, you can safely ignore this email — your account remains completely secure.

© 2026 PowerTech Energy Pty Ltd. All rights reserved.
Foodie Platform
"""

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 40px 20px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E3E4E6; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
            
            <tr>
                <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #F3F4F6;">
                    <span style="font-size: 24px; font-weight: 800; color: #171717; letter-spacing: -0.5px;">FOODIE<span style="color: #00C951;">™</span></span>
                    <span style="font-size: 11px; font-weight: 700; color: #E32032; text-transform: uppercase; margin-left: 8px; padding-left: 8px; border-left: 1px solid #D1D5DB;">PowerTech Energy</span>
                </td>
            </tr>
            
            <tr>
                <td style="padding: 32px;">
                    <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">Reset your password</h2>
                    <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 24px 0;">
                        Hello {display_name},<br><br>
                        We received a request to reset the password for your Foodie account associated with <strong>{to_email}</strong>. Click the button below to choose a new password:
                    </p>
                    
                    <table border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                        <tr>
                            <td align="center" style="border-radius: 8px; background-color: #E32032;">
                                <a href="{reset_url}" target="_blank" style="font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; background-color: #E32032;">
                                    Set a new password
                                </a>
                            </td>
                        </tr>
                    </table>
                    <p style="font-size: 12px; color: #6B7280; line-height: 1.5; margin: 20px 0 0 0;">
                        This password reset link will expire in <strong>30 minutes</strong> for your security.<br>
                        If you didn't request a password reset, you can safely ignore this email.
                    </p>
                    <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 28px 0 20px 0;">
                    <p style="font-size: 11px; color: #9CA3AF; line-height: 1.4; margin: 0;">
                        If the button doesn't work, copy and paste this link into your browser:<br>
                        <a href="{reset_url}" style="color: #E32032; word-break: break-all;">{reset_url}</a>
                    </p>
                </td>
            </tr>
            
            <tr>
                <td style="padding: 20px 32px; background-color: #F9FAFB; border-top: 1px solid #F3F4F6; text-align: center;">
                    <p style="font-size: 11px; color: #9CA3AF; margin: 0;">
                        © 2026 PowerTech Energy Pty Ltd. All rights reserved.
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    if not is_smtp_configured():
        err_msg = "SMTP is not fully configured (missing host, user, password, or sender email)."
        print(f"[Brevo SMTP ERROR] [FAIL] {err_msg}")
        return {"sent": False, "method": "none", "reset_url": reset_url, "error": err_msg}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Reply-To"] = SMTP_FROM_EMAIL

        msg.attach(MIMEText(plain_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        print(f"[Brevo SMTP] Connecting to {SMTP_HOST}:{SMTP_PORT} ...")
        print(f"[Brevo SMTP] Authenticating as: {SMTP_USER}")
        print(f"[Brevo SMTP] Sending FROM: {SMTP_FROM_EMAIL} TO: {to_email}")

        is_ssl = (SMTP_PORT == 465)
        server_class = smtplib.SMTP_SSL if is_ssl else smtplib.SMTP
        with server_class(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if not is_ssl:
                server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [to_email], msg.as_string())

        print(f"[Brevo SMTP] [OK] Successfully dispatched password reset email to {to_email}")
        return {"sent": True, "method": "smtp", "reset_url": reset_url}
    except Exception as e:
        print(f"[Brevo SMTP ERROR] [FAIL] {e}")
        print(f"[Brevo SMTP ERROR] Host={SMTP_HOST} Port={SMTP_PORT} User={SMTP_USER} From={SMTP_FROM_EMAIL}")
        return {"sent": False, "method": "smtp", "reset_url": reset_url, "error": str(e)}



def send_user_invitation_email(
    to_email: str,
    organization_name: str,
    role: str,
    token: str,
    inviter_name: str = ""
) -> dict:
    """
    Sends a branded invitation email with a 7-day expiration link via Brevo SMTP relay.
    """
    invite_url = f"{FRONTEND_URL}/accept-invite?token={token}"

    role_display_map = {
        "ORGANISATION_OWNER": "Organisation Owner",
        "SITE_MANAGER": "Site Manager",
        "OPERATOR": "Operator",
        "SITE_ADMIN": "Organisation Owner",
        "OEM_MANAGER": "OEM Asset Manager",
    }
    role_display = role_display_map.get(role, role.replace('_', ' ').title())
    inviter_display = inviter_name.strip() if inviter_name and inviter_name.strip() else "Foodie OEM Administration"

    subject = f"Invitation: Join {organization_name} on Foodie Platform"

    plain_content = f"""Hello,

You have been invited by {inviter_display} to join {organization_name} as an {role_display} on the Foodie Platform.

To activate your account and set up your secure password, please click the link below (or paste it into your browser):
{invite_url}

This invitation link will expire in 7 days.
If you did not expect this invitation, you can safely ignore this email.

(c) 2026 PowerTech Energy Pty Ltd. All rights reserved.
Foodie Platform
"""

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 40px 20px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E3E4E6; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
            
            <tr>
                <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #F3F4F6;">
                    <span style="font-size: 24px; font-weight: 800; color: #171717; letter-spacing: -0.5px;">FOODIE<span style="color: #00C951;">(TM)</span></span>
                    <span style="font-size: 11px; font-weight: 700; color: #E32032; text-transform: uppercase; margin-left: 8px; padding-left: 8px; border-left: 1px solid #D1D5DB;">PowerTech Energy</span>
                </td>
            </tr>

            
            <tr>
                <td style="padding: 32px 32px 24px 32px;">
                    <h1 style="font-size: 20px; font-weight: 700; color: #171717; margin: 0 0 16px 0; letter-spacing: -0.3px;">
                        You're invited to join {organization_name}
                    </h1>

                    <p style="font-size: 14px; line-height: 1.6; color: #4B5563; margin: 0 0 16px 0;">
                        Hello,
                    </p>

                    <p style="font-size: 14px; line-height: 1.6; color: #4B5563; margin: 0 0 20px 0;">
                        <strong>{inviter_display}</strong> has invited you to join the <strong>{organization_name}</strong> workspace as an <strong>{role_display}</strong> on the Foodie Platform.
                    </p>

                    <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin: 0 0 28px 0;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                                <td style="font-size: 12px; color: #6B7280; padding-bottom: 4px;">Organization</td>
                                <td style="font-size: 12px; font-weight: 700; color: #111827; text-align: right; padding-bottom: 4px;">{organization_name}</td>
                            </tr>
                            <tr>
                                <td style="font-size: 12px; color: #6B7280;">Assigned Role</td>
                                <td style="font-size: 12px; font-weight: 700; color: #E32032; text-align: right;">{role_display}</td>
                            </tr>
                        </table>
                    </div>

                    
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px 0;">
                        <tr>
                            <td align="center">
                                <a href="{invite_url}" target="_blank" style="display: inline-block; background-color: #E32032; color: #FFFFFF; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(227, 32, 50, 0.25);">
                                    Set Up Password & Access Dashboard
                                </a>
                            </td>
                        </tr>
                    </table>

                    
                    <div style="background-color: #F8F9FA; border-left: 3px solid #E32032; padding: 12px 16px; margin: 0 0 24px 0; border-radius: 0 6px 6px 0;">
                        <p style="font-size: 12px; line-height: 1.5; color: #666666; margin: 0;">
                            <strong>Security Notice:</strong> This invitation link is unique to you and will expire in <strong>7 days</strong>.
                        </p>
                    </div>

                    <p style="font-size: 12px; line-height: 1.5; color: #888888; margin: 0 0 8px 0;">
                        If the button above does not work, copy and paste this link into your browser:
                    </p>
                    <p style="font-size: 11px; line-height: 1.4; color: #6B7280; word-break: break-all; margin: 0;">
                        <a href="{invite_url}" style="color: #E32032; text-decoration: underline;">{invite_url}</a>
                    </p>
                </td>
            </tr>

            
            <tr>
                <td style="padding: 24px 32px; background-color: #F9FAFB; border-top: 1px solid #F3F4F6;">
                    <p style="font-size: 11px; line-height: 1.5; color: #888888; margin: 0;">
                        (c) 2026 PowerTech Energy Pty Ltd. All rights reserved.<br>
                        Foodie Waste-to-Resource Platform
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    if not is_smtp_configured():
        err_msg = "SMTP is not fully configured (missing host, user, password, or sender email)."
        print(f"[Brevo SMTP INVITATION ERROR] {err_msg}")
        return {"sent": False, "method": "none", "invite_url": invite_url, "error": err_msg}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Reply-To"] = SMTP_FROM_EMAIL

        msg.attach(MIMEText(plain_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        is_ssl = (SMTP_PORT == 465)
        server_class = smtplib.SMTP_SSL if is_ssl else smtplib.SMTP
        with server_class(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if not is_ssl:
                server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [to_email], msg.as_string())

        print(f"[Brevo SMTP] [OK] Successfully sent invitation email to {to_email}")
        return {"sent": True, "method": "smtp", "invite_url": invite_url}
    except Exception as e:
        print(f"[Brevo SMTP INVITATION ERROR] {e}")
        return {"sent": False, "method": "smtp", "invite_url": invite_url, "error": str(e)}
