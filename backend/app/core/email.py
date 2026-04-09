"""Email service for claim tokens and notifications."""

import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from .config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html_body: str) -> bool:
    if not settings.smtp_host:
        logger.warning("SMTP not configured — logging email instead")
        logger.info("=" * 60)
        logger.info(f"TO: {to}")
        logger.info(f"SUBJECT: {subject}")
        logger.info(f"BODY:\n{html_body}")
        logger.info("=" * 60)
        return True

    try:
        import aiosmtplib

        msg = MIMEMultipart("alternative")
        msg["From"] = settings.smtp_from_email
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))

        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_password or None,
            use_tls=settings.smtp_use_tls,
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


async def send_claim_email(to: str, claim_token: str) -> bool:
    claim_url = f"{settings.frontend_url}/auth/claim?token={claim_token}"
    logger.info(f"Claim URL for {to}: {claim_url}")

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 300; color: #f5f5f5; margin: 0;">Issue Finder</h1>
            <p style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">PR Writer HFI</p>
        </div>
        <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 32px;">
            <h2 style="color: #f5f5f5; font-size: 18px; margin: 0 0 16px;">Claim Your Account</h2>
            <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                You've been invited to Issue Finder. Click the button below to set up your password and activate your account.
            </p>
            <a href="{claim_url}" style="display: inline-block; background: #c9a44a; color: #000; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                Claim Account
            </a>
            <p style="color: #666; font-size: 12px; margin-top: 24px;">
                This link expires in {settings.claim_token_expire_hours} hours. If the button doesn't work, copy this URL:<br>
                <span style="color: #888; word-break: break-all;">{claim_url}</span>
            </p>
        </div>
    </div>
    """
    return await send_email(to, "Claim Your Issue Finder Account", html)


async def send_access_approved_email(to: str, claim_token: str) -> bool:
    claim_url = f"{settings.frontend_url}/auth/claim?token={claim_token}"
    logger.info(f"Access approved claim URL for {to}: {claim_url}")

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 300; color: #f5f5f5; margin: 0;">Issue Finder</h1>
        </div>
        <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 32px;">
            <h2 style="color: #f5f5f5; font-size: 18px; margin: 0 0 16px;">Access Request Approved</h2>
            <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Your request to access Issue Finder has been approved. Click below to set up your account.
            </p>
            <a href="{claim_url}" style="display: inline-block; background: #c9a44a; color: #000; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                Set Up Account
            </a>
            <p style="color: #666; font-size: 12px; margin-top: 24px;">
                This link expires in {settings.claim_token_expire_hours} hours.
            </p>
        </div>
    </div>
    """
    return await send_email(to, "Your Issue Finder Access Has Been Approved", html)


async def send_access_denied_email(to: str) -> bool:
    html = """
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 300; color: #f5f5f5; margin: 0;">Issue Finder</h1>
        </div>
        <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 32px;">
            <h2 style="color: #f5f5f5; font-size: 18px; margin: 0 0 16px;">Access Request Update</h2>
            <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin: 0;">
                Unfortunately, your request to access Issue Finder was not approved at this time.
                If you believe this is an error, please contact the administrator.
            </p>
        </div>
    </div>
    """
    return await send_email(to, "Issue Finder Access Request Update", html)
