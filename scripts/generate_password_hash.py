from getpass import getpass
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.auth import hash_password  # noqa: E402


def main() -> None:
    password = getpass("Admin password (12+ characters): ")
    confirmation = getpass("Repeat password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match")
    print(hash_password(password))


if __name__ == "__main__":
    main()
