"""
Pytest configuration — sets DATABASE_URL to the XAMPP test database
before any app code is imported so config.py picks up the right value.

Override by setting the DATABASE_URL environment variable before running:
    $env:DATABASE_URL = "mysql+pymysql://root:yourpassword@localhost:3306/fleetopt_test"
    python -m pytest backend/tests/ -v
"""
import os

# Only set the default if the caller hasn't already provided one.
if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = "mysql+pymysql://root:@localhost:3306/fleetopt_test"
