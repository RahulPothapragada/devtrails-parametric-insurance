"""
Mock Platform API — simulates rider activity data from a delivery platform (Zepto).
Generates realistic work patterns for honest riders and suspicious patterns for fraud.
"""

import random
import hashlib
from datetime import datetime, timedelta, timezone
from typing import List, Optional

EMULATOR_SIGNATURES = [
    "emu_generic_x86",
    "emu_bluestacks_v5",
    "emu_nox_player",
    "emu_ldplayer",
]

FRAUD_SHARED_DEVICES = [
    "fraud_device_alpha",
    "fraud_device_beta",
    "fraud_device_gamma",
]

SUSPICIOUS_DOMAINS = ["tempmail.com", "disposable.email", "fakeinbox.com", "guerrillamail.com"]

INDIAN_NAMES = [
    "Ravi Kumar", "Amit Sharma", "Suresh Yadav", "Pradeep Singh", "Vijay Patel",
    "Rajesh Verma", "Sanjay Gupta", "Manoj Tiwari", "Deepak Joshi", "Anil Mishra",
    "Rahul Chauhan", "Sachin More", "Ganesh Pawar", "Rohit Deshmukh", "Kiran Bhosale",
    "Nitin Jadhav", "Santosh Patil", "Ajay Shetty", "Vikas Naik", "Rakesh Shirke",
    "Mohan Kulkarni", "Sunil Mane", "Ashok Gaikwad", "Prakash Sawant", "Nilesh Kamble",
    "Yogesh Salvi", "Tushar Chavan", "Sagar Shinde", "Akash Dhole", "Varun Kale",
    "Vikram Raut", "Jitendra Borse", "Mahesh Ghate", "Ramesh Landge", "Dinesh Wagh",
    "Sameer Jain", "Aamir Khan", "Irfan Shaikh", "Farhan Qureshi", "Imran Pathan",
    "Arjun Nair", "Balaji Iyer", "Chetan Rao", "Dev Menon", "Eknath Shinde",
    "Firoz Ahmad", "Govind Das", "Harish Hegde", "Ismail Beg", "Jayesh Toranmal",
]


def generate_device_fingerprint(rider_id: int, is_suspicious: bool = False) -> str:
    if is_suspicious:
        if random.random() < 0.5:
            return random.choice(FRAUD_SHARED_DEVICES)
        if random.random() < 0.2:
            return random.choice(EMULATOR_SIGNATURES)
    raw = f"device_{rider_id}_{random.randint(1000, 9999)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def generate_email(rider_id: int, name: str, is_suspicious: bool = False) -> str:
    clean_name = name.lower().replace(" ", ".")
    if is_suspicious and random.random() < 0.4:
        domain = random.choice(SUSPICIOUS_DOMAINS)
    else:
        domain = random.choice(["gmail.com", "yahoo.co.in", "outlook.com"])
    return f"{clean_name}{rider_id}@{domain}"


def generate_upi_id(rider_id: int, name: str, is_suspicious: bool = False) -> str:
    clean_name = name.lower().replace(" ", "")
    if is_suspicious and random.random() < 0.3:
        return f"fraud.pool{random.randint(1, 3)}@upi"
    return f"{clean_name}{rider_id}@upi"


def generate_rider_activity(
    rider_id: int,
    date: datetime,
    zone_lat: float,
    zone_lng: float,
    is_suspicious: bool = False,
    trigger_time: Optional[datetime] = None,
) -> dict:
    if is_suspicious:
        return _generate_suspicious_activity(rider_id, date, zone_lat, zone_lng, trigger_time)
    return _generate_honest_activity(rider_id, date, zone_lat, zone_lng, trigger_time)


def _generate_honest_activity(rider_id, date, zone_lat, zone_lng, trigger_time=None):
    login_hour = random.randint(6, 10)
    login_time = date.replace(hour=login_hour, minute=random.randint(0, 59))
    hours_active = round(random.uniform(3.0, 6.0), 1)
    logout_time = login_time + timedelta(hours=hours_active)
    deliveries = random.randint(10, 25)
    earnings = deliveries * random.uniform(15, 25)
    gps_points = _generate_moving_gps(zone_lat, zone_lng, int(hours_active * 4))

    return {
        "rider_id": rider_id,
        "date": date,
        "hours_active": hours_active,
        "deliveries_completed": deliveries,
        "gps_points": gps_points,
        "login_time": login_time,
        "logout_time": logout_time,
        "earnings": round(earnings, 2),
        "is_working": True,
    }


def _generate_suspicious_activity(rider_id, date, zone_lat, zone_lng, trigger_time=None):
    pattern = random.choice(["late_login", "zero_deliveries", "static_gps", "wrong_zone", "minimal_activity"])

    if pattern == "late_login":
        if trigger_time:
            login_time = trigger_time - timedelta(minutes=random.randint(5, 25))
        else:
            login_time = date.replace(hour=random.randint(13, 16))
        hours_active = round(random.uniform(0.1, 0.5), 1)
        deliveries = random.randint(0, 1)
        gps_points = _generate_moving_gps(zone_lat, zone_lng, 2)
    elif pattern == "zero_deliveries":
        login_time = date.replace(hour=random.randint(8, 12))
        hours_active = round(random.uniform(1.0, 3.0), 1)
        deliveries = 0
        gps_points = _generate_static_gps(zone_lat, zone_lng, 5)
    elif pattern == "static_gps":
        login_time = date.replace(hour=random.randint(7, 10))
        hours_active = round(random.uniform(2.0, 5.0), 1)
        deliveries = random.randint(0, 3)
        gps_points = _generate_static_gps(zone_lat, zone_lng, 8)
    elif pattern == "wrong_zone":
        fake_lat = zone_lat + random.uniform(0.05, 0.15)
        fake_lng = zone_lng + random.uniform(0.05, 0.15)
        login_time = date.replace(hour=random.randint(8, 11))
        hours_active = round(random.uniform(2.0, 4.0), 1)
        deliveries = random.randint(0, 5)
        gps_points = _generate_moving_gps(fake_lat, fake_lng, 6)
    else:
        login_time = date.replace(hour=random.randint(9, 14))
        hours_active = round(random.uniform(0.5, 1.5), 1)
        deliveries = random.randint(1, 3)
        gps_points = _generate_moving_gps(zone_lat, zone_lng, 3)

    logout_time = login_time + timedelta(hours=hours_active)
    earnings = deliveries * random.uniform(15, 25)

    return {
        "rider_id": rider_id,
        "date": date,
        "hours_active": hours_active,
        "deliveries_completed": deliveries,
        "gps_points": gps_points,
        "login_time": login_time,
        "logout_time": logout_time,
        "earnings": round(earnings, 2),
        "is_working": deliveries > 0,
    }


def _generate_moving_gps(center_lat, center_lng, num_points) -> List[dict]:
    points = []
    lat, lng = center_lat, center_lng
    for i in range(num_points):
        lat += random.uniform(-0.005, 0.005)
        lng += random.uniform(-0.005, 0.005)
        points.append({
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=(num_points - i) * 15)).isoformat(),
        })
    return points


def _generate_static_gps(center_lat, center_lng, num_points) -> List[dict]:
    points = []
    for i in range(num_points):
        points.append({
            "lat": round(center_lat + random.uniform(-0.0001, 0.0001), 6),
            "lng": round(center_lng + random.uniform(-0.0001, 0.0001), 6),
            "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=(num_points - i) * 15)).isoformat(),
        })
    return points
