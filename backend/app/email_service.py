"""Email service for sending communications to candidates."""

import smtplib
import logging
import ssl
from contextlib import contextmanager
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from .config import settings

logger = logging.getLogger(__name__)


class EmailConfigurationError(ValueError):
    """A safe, user-facing email configuration error with no secret values."""


class EmailService:
    """Handle email sending to candidates."""

    @staticmethod
    def _configuration() -> tuple[str, str, str]:
        username = (settings.smtp_user or "").strip()
        password = (settings.smtp_password or "").strip()
        host = (settings.smtp_server or "").strip()
        if not username or not password:
            missing = [name for name, value in (("SMTP_USER", username), ("SMTP_PASSWORD", password)) if not value]
            raise EmailConfigurationError(f"Email is not configured: set {', '.join(missing)} in the backend environment.")
        if not host:
            raise EmailConfigurationError("Email is not configured: set SMTP_HOST (or SMTP_SERVER) in the backend environment.")
        if not 1 <= settings.smtp_port <= 65535:
            raise EmailConfigurationError("Email is not configured: SMTP_PORT must be between 1 and 65535.")
        if host.lower() == "smtp.gmail.com" and settings.smtp_port == 587 and not settings.smtp_use_tls:
            raise EmailConfigurationError("Gmail SMTP on port 587 requires SMTP_USE_TLS=true.")
        sender = (settings.sender_email or "").strip() or username
        return username, password, sender

    @staticmethod
    @contextmanager
    def _smtp_session():
        username, password, sender = EmailService._configuration()
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_server, settings.smtp_port, timeout=10, context=ssl.create_default_context()) as server:
                server.login(username, password)
                yield server, sender
        else:
            with smtplib.SMTP(settings.smtp_server, settings.smtp_port, timeout=10) as server:
                server.ehlo()
                if settings.smtp_use_tls:
                    server.starttls(context=ssl.create_default_context())
                    server.ehlo()
                server.login(username, password)
                yield server, sender

    @staticmethod
    def test_connection() -> dict:
        """Connect and authenticate without sending any email."""
        try:
            with EmailService._smtp_session():
                pass
            return {"success": True, "message": "SMTP connection and authentication succeeded. No email was sent."}
        except EmailConfigurationError as exc:
            return {"success": False, "message": str(exc)}
        except smtplib.SMTPAuthenticationError:
            return {"success": False, "message": "SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD (Gmail requires an app password)."}
        except (smtplib.SMTPException, OSError, TimeoutError):
            logger.warning("SMTP connection or authentication check failed for %s:%s", settings.smtp_server, settings.smtp_port)
            return {"success": False, "message": f"Could not connect to or authenticate with SMTP server {settings.smtp_server}:{settings.smtp_port}. Check network access and SMTP settings."}

    @staticmethod
    def send_test_email_to_account() -> dict:
        """Send a diagnostic message only to the configured authenticated account."""
        try:
            username, _password, sender = EmailService._configuration()
            message = EmailService._build_message(
                recipient_email=username,
                recipient_name="HireSense SMTP test",
                subject="HireSense AI SMTP configuration test",
                body="This message confirms that HireSense AI authenticated with SMTP and the server accepted a test message.",
            )
            with EmailService._smtp_session() as (server, configured_sender):
                server.sendmail(configured_sender or sender, [username], message.as_string())
            return {"success": True, "message": "SMTP accepted the test email for the configured account."}
        except EmailConfigurationError as exc:
            return {"success": False, "message": str(exc)}
        except smtplib.SMTPAuthenticationError:
            return {"success": False, "message": "SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD (Gmail requires an app password)."}
        except (smtplib.SMTPException, OSError, TimeoutError):
            logger.warning("SMTP test message failed for %s:%s", settings.smtp_server, settings.smtp_port)
            return {"success": False, "message": "SMTP did not accept the test email. Check backend SMTP settings and connectivity."}

    @staticmethod
    def _build_message(
        recipient_email: str,
        recipient_name: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
    ) -> MIMEMultipart:
        """Create a MIME message for an email."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        sender = (settings.sender_email or "").strip() or (settings.smtp_user or "").strip()
        msg["From"] = f"{settings.sender_name} <{sender}>"
        msg["To"] = recipient_email
        msg.attach(MIMEText(body, "plain"))

        if html_body:
            msg.attach(MIMEText(html_body, "html"))

        return msg

    @staticmethod
    def send_email(
        recipient_email: str,
        recipient_name: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
    ) -> dict:
        """
        Send email to candidate.
        
        Args:
            recipient_email: Candidate's email address
            recipient_name: Candidate's name
            subject: Email subject line
            body: Plain text email body
            html_body: Optional HTML email body
            
        Returns:
            dict with success status and message
        """
        try:
            username, password, sender = EmailService._configuration()

            msg = EmailService._build_message(
                recipient_email=recipient_email,
                recipient_name=recipient_name,
                subject=subject,
                body=body,
                html_body=html_body,
            )

            logger.info("Attempting to send email via %s:%s", settings.smtp_server, settings.smtp_port)
            with EmailService._smtp_session() as (server, sender):
                server.sendmail(sender, [recipient_email], msg.as_string())

            logger.info(f"Email sent successfully to {recipient_email}")
            return {
                "success": True,
                "message": f"Email sent successfully to {recipient_email}"
            }

        except smtplib.SMTPAuthenticationError as e:
            logger.warning("SMTP authentication failed")
            return {
                "success": False,
                "message": "SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD."
            }
        except EmailConfigurationError as e:
            return {"success": False, "message": str(e)}
        except smtplib.SMTPException:
            logger.warning("SMTP error occurred")
            return {
                "success": False,
                "message": "SMTP delivery failed. Check server connectivity and SMTP configuration."
            }
        except Exception:
            logger.exception("Unexpected error sending email")
            return {
                "success": False,
                "message": "Unexpected error sending email. Check backend logs for details."
            }

    @staticmethod
    def send_emails(emails: list[dict]) -> dict:
        """Send multiple emails over a single SMTP connection for better throughput."""
        try:
            _username, _password, sender = EmailService._configuration()

            unique_emails = {}
            for item in emails:
                recipient_email = (item.get("recipient_email") or "").strip()
                if not recipient_email:
                    continue
                normalized_email = recipient_email.lower()
                if normalized_email not in unique_emails:
                    unique_emails[normalized_email] = item

            sent_count = 0
            failed_count = 0
            errors = []

            with EmailService._smtp_session() as (server, sender):
                for item in unique_emails.values():
                    recipient_email = item["recipient_email"].strip()
                    if not recipient_email:
                        failed_count += 1
                        errors.append({
                            "candidate_email": recipient_email,
                            "error": "No email address on file"
                        })
                        continue

                    msg = EmailService._build_message(
                        recipient_email=recipient_email,
                        recipient_name=item.get("recipient_name", "Candidate"),
                        subject=item["subject"],
                        body=item["body"],
                        html_body=item.get("html_body"),
                    )
                    try:
                        server.sendmail(sender, [recipient_email], msg.as_string())
                        sent_count += 1
                    except smtplib.SMTPException:
                        failed_count += 1
                        errors.append({
                            "candidate_email": recipient_email,
                            "error": "SMTP delivery rejected this recipient."
                        })

            return {
                "success": sent_count > 0,
                "message": f"Sent {sent_count} emails successfully" + (f"; {failed_count} failed" if failed_count > 0 else ""),
                "sent_count": sent_count,
                "failed_count": failed_count,
                "errors": errors,
            }

        except smtplib.SMTPAuthenticationError:
            logger.warning("SMTP authentication failed")
            return {
                "success": False,
                "message": "SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD.",
                "sent_count": 0,
                "failed_count": len(emails),
                "errors": [{"candidate_email": item.get("recipient_email"), "error": "SMTP authentication failed"} for item in emails],
            }
        except EmailConfigurationError as e:
            return {
                "success": False,
                "message": str(e),
                "sent_count": 0,
                "failed_count": len(emails),
                "errors": [{"candidate_email": item.get("recipient_email"), "error": str(e)} for item in emails],
            }
        except smtplib.SMTPException:
            logger.warning("SMTP error occurred")
            return {
                "success": False,
                "message": "SMTP delivery failed. Check server connectivity and SMTP configuration.",
                "sent_count": 0,
                "failed_count": len(emails),
                "errors": [{"candidate_email": item.get("recipient_email"), "error": "SMTP delivery failed"} for item in emails],
            }
        except Exception:
            logger.exception("Unexpected error sending email batch")
            return {
                "success": False,
                "message": "Unexpected error sending email batch. Check backend logs for details.",
                "sent_count": 0,
                "failed_count": len(emails),
                "errors": [{"candidate_email": item.get("recipient_email"), "error": str(e)} for item in emails],
            }
    
    @staticmethod
    def get_procedure_email_template(candidate_name: str, job_title: Optional[str] = None) -> dict:
        """Get template for procedure/call scheduled email."""
        job_text = f" for the {job_title} position" if job_title else ""
        
        subject = f"Next Steps in Your Application{' - ' + job_title if job_title else ''}"
        
        body = f"""Dear {candidate_name},

Thank you for your interest and your excellent resume{job_text}!

We are impressed with your profile and would like to move forward with the next steps in our hiring process. We will be scheduling a call with you soon to discuss the opportunity further.

A member of our team will reach out to you shortly with available time slots for a brief discussion.

We look forward to speaking with you!

Best regards,
Recruitment Team"""
        
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <p>Dear <strong>{candidate_name}</strong>,</p>
                
                <p>Thank you for your interest and your excellent resume{job_text}!</p>
                
                <p>We are impressed with your profile and would like to move forward with the next steps in our hiring process. We will be scheduling a call with you soon to discuss the opportunity further.</p>
                
                <p>A member of our team will reach out to you shortly with available time slots for a brief discussion.</p>
                
                <p>We look forward to speaking with you!</p>
                
                <p>Best regards,<br/>
                <strong>Recruitment Team</strong></p>
            </body>
        </html>
        """
        
        return {
            "subject": subject,
            "body": body,
            "html_body": html_body
        }
    
    @staticmethod
    def get_rejection_email_template(candidate_name: str, job_title: Optional[str] = None) -> dict:
        """Get template for rejection email."""
        job_text = f" for the {job_title} position" if job_title else ""
        
        subject = f"Application Status{' - ' + job_title if job_title else ''}"
        
        body = f"""Dear {candidate_name},

Thank you for applying{job_text} and for taking the time to submit your application.

After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current needs. We appreciate your interest in our organization and encourage you to apply for future positions that may be a better fit for your background.

We wish you the best of luck in your career!

Best regards,
Recruitment Team"""
        
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <p>Dear <strong>{candidate_name}</strong>,</p>
                
                <p>Thank you for applying{job_text} and for taking the time to submit your application.</p>
                
                <p>After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current needs. We appreciate your interest in our organization and encourage you to apply for future positions that may be a better fit for your background.</p>
                
                <p>We wish you the best of luck in your career!</p>
                
                <p>Best regards,<br/>
                <strong>Recruitment Team</strong></p>
            </body>
        </html>
        """
        
        return {
            "subject": subject,
            "body": body,
            "html_body": html_body
        }
    
    @staticmethod
    def get_custom_email_template() -> dict:
        """Get template for custom email composition."""
        return {
            "subject": "",
            "body": "",
            "html_body": ""
        }
