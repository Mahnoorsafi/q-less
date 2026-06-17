"""
setup_admin.py
Run once to create the admin account in Firebase Auth.
Usage:  python setup_admin.py
"""

import urllib.request
import json

API_KEY = "AIzaSyA2CG6HX1bgDVr5cU6fYPlEZyZoBy457rM"
EMAIL   = "admin@olive.com"
PASSWORD = "Admin@Q123"

url  = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"
body = json.dumps({
    "email":             EMAIL,
    "password":          PASSWORD,
    "returnSecureToken": True
}).encode("utf-8")

req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})

try:
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read())
        print("=" * 45)
        print("  Admin account created successfully!")
        print("=" * 45)
        print(f"  Email   : {EMAIL}")
        print(f"  Password: {PASSWORD}")
        print(f"  UID     : {data.get('localId')}")
        print("=" * 45)
        print("  Open http://localhost:4000 and log in.")
except urllib.error.HTTPError as e:
    err = json.loads(e.read())
    msg = err.get("error", {}).get("message", "Unknown error")
    if msg == "EMAIL_EXISTS":
        print("=" * 45)
        print("  Admin account already exists.")
        print("=" * 45)
        print(f"  Email   : {EMAIL}")
        print(f"  Password: {PASSWORD}")
        print("=" * 45)
    else:
        print(f"Error: {msg}")