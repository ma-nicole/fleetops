import httpx
import sys

BASE = "http://127.0.0.1:8000"

client = httpx.Client()

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

# 2) Register a valid test user
print('\nPOST /api/auth/register (valid)')
user = {
    'email': 'smoke_test_user@example.com',
    'password': 'strongpassword123',
    'full_name': 'Smoke Test User',
}
resp = client.post(BASE + '/api/auth/register', json=user)
print(resp.status_code)
print(resp.text)
if resp.status_code != 200 and 'Email already exists' in resp.text:
    print('User exists, proceeding to login')

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
valid_booking = {
    'pickup_location': 'Warehouse 1',
    'dropoff_location': 'Warehouse 2',
    'service_type': 'fixed',
    'scheduled_date': '2026-05-02',
    'cargo_weight_tons': 2.5,
}
resp = client.post(BASE + '/api/bookings', json=valid_booking, headers=headers)
print(resp.status_code)
print(resp.text)

print('\nSmoke test complete')
