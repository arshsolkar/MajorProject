"""Safely check SMTP configuration without displaying credential values."""

import argparse
import sys

from app.email_service import EmailService


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--send-test-email",
        action="store_true",
        help="also send one diagnostic message to the configured SMTP_USER account",
    )
    args = parser.parse_args()

    result = EmailService.test_connection()
    print(result["message"])
    if not result["success"]:
        return 1

    if args.send_test_email:
        delivery = EmailService.send_test_email_to_account()
        print(delivery["message"])
        if not delivery["success"]:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
