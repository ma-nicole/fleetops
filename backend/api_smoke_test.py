import httpx
import sys
from datetime import date, timedelta

BASE = "http://127.0.0.1:8000"

client = httpx.Client(timeout=60.0)

print('GET /docs')
resp = client.get(BASE + '/docs')
print(resp.status_code)

# 1) Attempt invalid registration (short password)
print('\nPOST /api/auth/register (invalid password)')
invalid_user = {
    'email': 'smoke_invalid@example.com',
    'password': 'short',
    'full_name': 'Sm',
}
resp = client.post(BASE + '/api/auth/register', json=invalid_user)
print(resp.status_code)
print(resp.text)

# 2) Register a valid test user (must satisfy password_policy: upper+lower+digit+special)
print('\nPOST /api/auth/register (valid)')
user = {
    'email': 'smoke_test_user@example.com',
    'password': 'StrongPass123!',
    'full_name': 'Smoke Test User',
}
resp = client.post(BASE + '/api/auth/register', json=user)
print(resp.status_code)
print(resp.text)
if resp.status_code != 200 and ('already' in resp.text.lower() or resp.status_code in (400, 409, 422)):
    print('User exists or register skipped; proceeding to login')

# 3) Login
print('\nPOST /api/auth/login (form)')
login_data = {'username': user['email'], 'password': user['password']}
resp = client.post(BASE + '/api/auth/login', data=login_data)
print(resp.status_code)
print(resp.text)
if resp.status_code != 200:
    print('Login failed; aborting')
    sys.exit(1)

token = resp.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}

# 4) Attempt invalid booking (negative weight)
print('\nPOST /api/bookings (invalid payload)')
invalid_booking = {
    'pickup_location': 'A',
    'dropoff_location': 'B',
    'service_type': 'fixed',
    'scheduled_date': '2026-05-02',
    'cargo_weight_tons': -5,
}
resp = client.post(BASE + '/api/bookings', json=invalid_booking, headers=headers)
print(resp.status_code)
print(resp.text)

# 5) Create valid booking
print('\nPOST /api/bookings (valid payload)')
sched = (date.today() + timedelta(days=14)).isoformat()
valid_booking = {
    'pickup_location': 'Warehouse 1, Quezon City, Philippines',
    'dropoff_location': 'Warehouse 2, Makati City, Philippines',
    'service_type': 'fixed',
    'scheduled_date': sched,
    'scheduled_time_slot': '08:00',
    'cargo_weight_tons': 2.5,
}
resp = client.post(BASE + '/api/bookings', json=valid_booking, headers=headers)
print(resp.status_code)
print(resp.text)
if resp.status_code not in (200, 201):
    print('Valid booking failed; aborting')
    sys.exit(1)

print('\nSmoke test complete')
