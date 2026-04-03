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
    "fraud_device_delta",
    "fraud_device_epsilon",
]

SUSPICIOUS_DOMAINS = ["tempmail.com", "disposable.email", "fakeinbox.com", "guerrillamail.com"]

# ── Name pools for generating 1000+ unique Indian names ──
_FIRST_NAMES = [
    "Ravi", "Amit", "Suresh", "Pradeep", "Vijay", "Rajesh", "Sanjay", "Manoj",
    "Deepak", "Anil", "Rahul", "Sachin", "Ganesh", "Rohit", "Kiran", "Nitin",
    "Santosh", "Ajay", "Vikas", "Rakesh", "Mohan", "Sunil", "Ashok", "Prakash",
    "Nilesh", "Yogesh", "Tushar", "Sagar", "Akash", "Varun", "Vikram", "Jitendra",
    "Mahesh", "Ramesh", "Dinesh", "Sameer", "Aamir", "Irfan", "Farhan", "Imran",
    "Naveen", "Pankaj", "Raman", "Sudhir", "Tarun", "Umesh", "Vivek", "Wasim",
    "Yashpal", "Arjun", "Balaji", "Chetan", "Dev", "Girish", "Hari", "Jagdish",
    "Karthik", "Lokesh", "Manjunath", "Prashanth", "Raghavendra", "Tejas", "Uday",
    "Vinod", "Ranjith", "Shashank", "Kannan", "Murugan", "Nagaraj", "Palani",
    "Rajendran", "Senthil", "Vignesh", "Bala", "Dhanush", "Abhijit", "Bikash",
    "Chiranjit", "Debashis", "Gopal", "Hemanta", "Indranil", "Joydip", "Kaushik",
    "Niloy", "Partha", "Rajat", "Sourav", "Tapan", "Omkar", "Pranav", "Rohan",
    "Siddharth", "Tanmay", "Devendra", "Hrushikesh", "Kunal", "Aravind", "Bharath",
    "Krishna", "Mahendra", "Naresh", "Prasad", "Ramana", "Srinivas", "Chirag",
    "Darshan", "Hitesh", "Jaymin", "Ketan", "Mitesh", "Parth", "Bharat", "Dharmendra",
    "Giriraj", "Hemant", "Kishan", "Lakhan", "Alok", "Brijesh", "Chandan", "Diwakar",
    "Himanshu", "Aditya", "Bhupendra", "Dheeraj", "Anand", "Bipin", "Dilip", "Arvind",
    "Bhanu", "Farhan", "Gaurav", "Manish", "Rajiv", "Sunil", "Dhruv", "Harsh",
    "Ishan", "Jayant", "Kapil", "Laxman", "Mukesh", "Narayan", "Omkar", "Pawan",
    "Qutubuddin", "Rishabh", "Sumit", "Trilok", "Umang", "Vinay", "Yadav", "Zubair",
    "Akhilesh", "Bhushan", "Chandrakant", "Dattatray", "Eknath", "Fulchand", "Ghanshyam",
    "Harshad", "Ishwar", "Jagannath", "Kedar", "Lalitkumar", "Madhusudan", "Namdeo",
]

_LAST_NAMES = [
    "Kumar", "Sharma", "Yadav", "Singh", "Patel", "Verma", "Gupta", "Tiwari",
    "Joshi", "Mishra", "Chauhan", "More", "Pawar", "Deshmukh", "Bhosale", "Jadhav",
    "Patil", "Shetty", "Naik", "Shirke", "Kulkarni", "Mane", "Gaikwad", "Sawant",
    "Kamble", "Salvi", "Chavan", "Shinde", "Dhole", "Kale", "Raut", "Borse",
    "Ghate", "Landge", "Wagh", "Jain", "Khan", "Shaikh", "Qureshi", "Pathan",
    "Bhatia", "Tandon", "Kapoor", "Arora", "Malhotra", "Saini", "Grover", "Mehta",
    "Nair", "Iyer", "Rao", "Menon", "Hegde", "Reddy", "Gowda", "Prasad",
    "Kamath", "Shankar", "Nayak", "Muthu", "Selvam", "Pillai", "Vel", "Rajan",
    "Banerjee", "Chatterjee", "Das", "Ghosh", "Mondal", "Sarkar", "Bose",
    "Mukherjee", "Roy", "Saha", "Sen", "Dey", "Ganguly", "Paul", "Bhattacharya",
    "Desai", "Jagtap", "Bhosle", "Deshpande", "Kadam", "Wagh", "Naidu", "Varma",
    "Goud", "Modi", "Shah", "Thakkar", "Bhatt", "Solanki", "Meena", "Gurjar",
    "Prajapat", "Pandey", "Awasthi", "Dubey", "Patidar", "Rathore", "Malviya",
    "Thakur", "Rajput", "Ansari", "Tiwari", "Lal", "Misra", "Bajpai", "Saxena",
    "Dixit", "Agarwal", "Srivastava", "Shukla", "Tripathi", "Upadhyay", "Dwivedi",
]


# Deduplicate pools to maximise unique combinations
_FIRST_NAMES_UNIQUE = list(dict.fromkeys(_FIRST_NAMES))
_LAST_NAMES_UNIQUE = list(dict.fromkeys(_LAST_NAMES))
_POOL_SIZE = len(_FIRST_NAMES_UNIQUE) * len(_LAST_NAMES_UNIQUE)


def generate_name(index: int) -> str:
    """
    Generate a guaranteed-unique Indian name.
    First pass: first x last combos (e.g. 130 x 100 = 13,000).
    If index exceeds pool, append numeric suffix to stay unique.
    """
    n = index % _POOL_SIZE
    first = _FIRST_NAMES_UNIQUE[n % len(_FIRST_NAMES_UNIQUE)]
    last = _LAST_NAMES_UNIQUE[n // len(_FIRST_NAMES_UNIQUE)]
    cycle = index // _POOL_SIZE
    suffix = f" {cycle + 2}" if cycle > 0 else ""
    return f"{first} {last}{suffix}"


# Keep INDIAN_NAMES for backward compatibility (legacy usage)
INDIAN_NAMES = [generate_name(i) for i in range(200)]


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
    
    platforms = ["Zomato", "Swiggy", "Zepto"]

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
