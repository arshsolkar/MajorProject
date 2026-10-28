import unittest
from unittest.mock import ANY, MagicMock, patch

from app.email_service import EmailService
from app.config import Settings, settings


class EmailServiceTests(unittest.TestCase):
    def test_smtp_environment_names_include_current_host_alias(self):
        config = Settings(
            _env_file=None,
            SMTP_HOST='smtp.gmail.com',
            SMTP_PORT='587',
            SMTP_USE_TLS='true',
            SMTP_USER='account@example.com',
            SMTP_PASSWORD='test-only-password',
        )
        self.assertEqual(config.smtp_server, 'smtp.gmail.com')
        self.assertEqual(config.smtp_port, 587)
        self.assertTrue(config.smtp_use_tls)
        self.assertEqual(config.smtp_user, 'account@example.com')
        self.assertEqual(config.smtp_password, 'test-only-password')

    @patch('app.email_service.smtplib.SMTP')
    def test_connection_authenticates_with_starttls_without_sending(self, smtp_cls):
        smtp_client = MagicMock()
        smtp_cls.return_value.__enter__.return_value = smtp_client
        with patch.object(settings, 'smtp_user', 'mailer@example.com'), \
             patch.object(settings, 'smtp_password', 'secret'), \
             patch.object(settings, 'smtp_server', 'smtp.gmail.com'), \
             patch.object(settings, 'smtp_port', 587), \
             patch.object(settings, 'smtp_use_tls', True):
            result = EmailService.test_connection()

        self.assertTrue(result['success'])
        self.assertIn('No email was sent', result['message'])
        smtp_cls.assert_called_once_with('smtp.gmail.com', 587, timeout=10)
        smtp_client.starttls.assert_called_once()
        smtp_client.login.assert_called_once_with('mailer@example.com', 'secret')
        smtp_client.sendmail.assert_not_called()

    @patch('app.email_service.smtplib.SMTP')
    def test_missing_smtp_credentials_return_clear_error_without_connecting(self, smtp_cls):
        with patch.object(settings, 'smtp_user', ''), patch.object(settings, 'smtp_password', ''):
            result = EmailService.test_connection()

        self.assertFalse(result['success'])
        self.assertIn('SMTP_USER, SMTP_PASSWORD', result['message'])
        smtp_cls.assert_not_called()

    @patch('app.email_service.smtplib.SMTP')
    def test_gmail_port_587_rejects_disabled_tls(self, smtp_cls):
        with patch.object(settings, 'smtp_user', 'mailer@example.com'), \
             patch.object(settings, 'smtp_password', 'secret'), \
             patch.object(settings, 'smtp_server', 'smtp.gmail.com'), \
             patch.object(settings, 'smtp_port', 587), \
             patch.object(settings, 'smtp_use_tls', False):
            result = EmailService.test_connection()

        self.assertFalse(result['success'])
        self.assertIn('SMTP_USE_TLS=true', result['message'])
        smtp_cls.assert_not_called()

    @patch('app.email_service.smtplib.SMTP')
    def test_diagnostic_email_is_sent_only_to_configured_account(self, smtp_cls):
        smtp_client = MagicMock()
        smtp_cls.return_value.__enter__.return_value = smtp_client
        with patch.object(settings, 'smtp_user', 'account@example.com'), \
             patch.object(settings, 'smtp_password', 'secret'), \
             patch.object(settings, 'sender_email', ''), \
             patch.object(settings, 'smtp_server', 'smtp.gmail.com'), \
             patch.object(settings, 'smtp_port', 587), \
             patch.object(settings, 'smtp_use_tls', True):
            result = EmailService.send_test_email_to_account()

        self.assertTrue(result['success'])
        smtp_client.sendmail.assert_called_once()
        args = smtp_client.sendmail.call_args.args
        self.assertEqual(args[0], 'account@example.com')
        self.assertEqual(args[1], ['account@example.com'])

    @patch('app.email_service.smtplib.SMTP')
    def test_send_emails_reuses_single_smtp_session(self, smtp_cls):
        smtp_client = MagicMock()
        smtp_cls.return_value.__enter__.return_value = smtp_client

        with patch.object(settings, 'smtp_user', 'mailer@example.com', create=True), \
             patch.object(settings, 'smtp_password', 'secret', create=True), \
             patch.object(settings, 'sender_email', 'noreply@example.com', create=True), \
             patch.object(settings, 'smtp_server', 'smtp.example.com', create=True), \
             patch.object(settings, 'smtp_port', 587, create=True), \
             patch.object(settings, 'sender_name', 'RecruitAI', create=True):

            result = EmailService.send_emails([
                {
                    'recipient_email': 'candidate1@example.com',
                    'recipient_name': 'Candidate One',
                    'subject': 'Interview update',
                    'body': 'Hello Candidate One',
                    'html_body': '<p>Hello</p>',
                },
                {
                    'recipient_email': 'candidate2@example.com',
                    'recipient_name': 'Candidate Two',
                    'subject': 'Interview update',
                    'body': 'Hello Candidate Two',
                    'html_body': '<p>Hello</p>',
                },
            ])

        self.assertTrue(result['success'])
        smtp_cls.assert_called_once_with('smtp.example.com', 587, timeout=10)
        smtp_client.ehlo.assert_called()
        smtp_client.login.assert_called_once_with('mailer@example.com', 'secret')
        self.assertEqual(smtp_client.sendmail.call_count, 2)
        smtp_client.sendmail.assert_any_call('noreply@example.com', ['candidate1@example.com'], ANY)
        smtp_client.sendmail.assert_any_call('noreply@example.com', ['candidate2@example.com'], ANY)

    @patch('app.email_service.smtplib.SMTP')
    def test_send_emails_deduplicates_duplicate_recipient_addresses(self, smtp_cls):
        smtp_client = MagicMock()
        smtp_cls.return_value.__enter__.return_value = smtp_client

        with patch.object(settings, 'smtp_user', 'mailer@example.com', create=True), \
             patch.object(settings, 'smtp_password', 'secret', create=True), \
             patch.object(settings, 'sender_email', 'noreply@example.com', create=True), \
             patch.object(settings, 'smtp_server', 'smtp.example.com', create=True), \
             patch.object(settings, 'smtp_port', 587, create=True), \
             patch.object(settings, 'sender_name', 'RecruitAI', create=True):

            result = EmailService.send_emails([
                {
                    'recipient_email': 'same@example.com',
                    'recipient_name': 'Candidate One',
                    'subject': 'Interview update',
                    'body': 'Hello Candidate One',
                    'html_body': '<p>Hello</p>',
                },
                {
                    'recipient_email': 'SAME@example.com',
                    'recipient_name': 'Candidate Two',
                    'subject': 'Interview update',
                    'body': 'Hello Candidate Two',
                    'html_body': '<p>Hello</p>',
                },
            ])

        self.assertTrue(result['success'])
        self.assertEqual(smtp_client.sendmail.call_count, 1)
        smtp_client.sendmail.assert_called_once_with('noreply@example.com', ['same@example.com'], ANY)


if __name__ == '__main__':
    unittest.main()
