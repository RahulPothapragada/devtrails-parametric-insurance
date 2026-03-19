"""
Seed data for development and demos.
Includes cities, zones, dark stores, and sample riders for Mumbai.
"""

CITIES = [
    {"name": "Mumbai", "state": "Maharashtra", "lat": 19.076, "lng": 72.8777, "base_rate": 20},
    {"name": "Delhi", "state": "Delhi", "lat": 28.6139, "lng": 77.209, "base_rate": 22},
    {"name": "Bangalore", "state": "Karnataka", "lat": 12.9716, "lng": 77.5946, "base_rate": 18},
    {"name": "Chennai", "state": "Tamil Nadu", "lat": 13.0827, "lng": 80.2707, "base_rate": 18},
    {"name": "Kolkata", "state": "West Bengal", "lat": 22.5726, "lng": 88.3639, "base_rate": 20},
]

# Mumbai zones with real coordinates and risk tiers
MUMBAI_ZONES = [
    # Tier 1 — High Risk (flood-prone, poor drainage, low-lying)
    {"name": "Andheri West", "tier": "high", "lat": 19.1364, "lng": 72.8296,
     "flood_risk": 0.85, "heat_risk": 0.5, "aqi_risk": 0.6, "traffic_risk": 0.8},
    {"name": "Dadar", "tier": "high", "lat": 19.0178, "lng": 72.8478,
     "flood_risk": 0.80, "heat_risk": 0.5, "aqi_risk": 0.65, "traffic_risk": 0.85},
    {"name": "Kurla", "tier": "high", "lat": 19.0726, "lng": 72.8794,
     "flood_risk": 0.90, "heat_risk": 0.5, "aqi_risk": 0.7, "traffic_risk": 0.75},
    {"name": "Sion", "tier": "high", "lat": 19.0402, "lng": 72.8615,
     "flood_risk": 0.88, "heat_risk": 0.5, "aqi_risk": 0.65, "traffic_risk": 0.7},
    {"name": "Chembur", "tier": "high", "lat": 19.0522, "lng": 72.8938,
     "flood_risk": 0.82, "heat_risk": 0.5, "aqi_risk": 0.7, "traffic_risk": 0.65},

    # Tier 2 — Medium Risk
    {"name": "Bandra", "tier": "medium", "lat": 19.0596, "lng": 72.8295,
     "flood_risk": 0.55, "heat_risk": 0.5, "aqi_risk": 0.5, "traffic_risk": 0.75},
    {"name": "Goregaon", "tier": "medium", "lat": 19.1663, "lng": 72.8526,
     "flood_risk": 0.50, "heat_risk": 0.5, "aqi_risk": 0.55, "traffic_risk": 0.65},
    {"name": "Malad", "tier": "medium", "lat": 19.1874, "lng": 72.8484,
     "flood_risk": 0.55, "heat_risk": 0.5, "aqi_risk": 0.55, "traffic_risk": 0.6},
    {"name": "Borivali", "tier": "medium", "lat": 19.2307, "lng": 72.8567,
     "flood_risk": 0.45, "heat_risk": 0.5, "aqi_risk": 0.5, "traffic_risk": 0.55},
    {"name": "Vile Parle", "tier": "medium", "lat": 19.0968, "lng": 72.8478,
     "flood_risk": 0.50, "heat_risk": 0.5, "aqi_risk": 0.55, "traffic_risk": 0.7},

    # Tier 3 — Low Risk (elevated, good drainage)
    {"name": "Powai", "tier": "low", "lat": 19.1176, "lng": 72.9060,
     "flood_risk": 0.20, "heat_risk": 0.45, "aqi_risk": 0.4, "traffic_risk": 0.45},
    {"name": "BKC", "tier": "low", "lat": 19.0658, "lng": 72.8687,
     "flood_risk": 0.25, "heat_risk": 0.45, "aqi_risk": 0.45, "traffic_risk": 0.50},
    {"name": "Thane", "tier": "low", "lat": 19.2183, "lng": 72.9781,
     "flood_risk": 0.30, "heat_risk": 0.5, "aqi_risk": 0.45, "traffic_risk": 0.40},
    {"name": "Navi Mumbai", "tier": "low", "lat": 19.0330, "lng": 73.0297,
     "flood_risk": 0.25, "heat_risk": 0.45, "aqi_risk": 0.4, "traffic_risk": 0.35},
]

# Dark stores (2 per zone for demo)
MUMBAI_DARK_STORES = [
    {"zone": "Andheri West", "name": "Zepto Dark Store #47", "lat": 19.1364, "lng": 72.8296},
    {"zone": "Andheri West", "name": "Zepto Dark Store #48", "lat": 19.1320, "lng": 72.8350},
    {"zone": "Dadar", "name": "Zepto Dark Store #12", "lat": 19.0178, "lng": 72.8478},
    {"zone": "Kurla", "name": "Zepto Dark Store #31", "lat": 19.0726, "lng": 72.8794},
    {"zone": "Bandra", "name": "Zepto Dark Store #22", "lat": 19.0596, "lng": 72.8295},
    {"zone": "Powai", "name": "Zepto Dark Store #55", "lat": 19.1176, "lng": 72.9060},
    {"zone": "BKC", "name": "Zepto Dark Store #60", "lat": 19.0658, "lng": 72.8687},
    {"zone": "Thane", "name": "Zepto Dark Store #71", "lat": 19.2183, "lng": 72.9781},
]

# Sample riders for demo
SAMPLE_RIDERS = [
    {
        "name": "Ravi Kumar",
        "phone": "9876543210",
        "email": "ravi@demo.com",
        "zone": "Andheri West",
        "dark_store": "Zepto Dark Store #47",
        "shift_type": "evening",
        "avg_weekly_earnings": 6200,
        "avg_hourly_rate": 102,
        "shield_level": 3,
        "description": "High-risk rider — evening shift in flood-prone Andheri"
    },
    {
        "name": "Priya Sharma",
        "phone": "9876543211",
        "email": "priya@demo.com",
        "zone": "Powai",
        "dark_store": "Zepto Dark Store #55",
        "shift_type": "morning",
        "avg_weekly_earnings": 5400,
        "avg_hourly_rate": 90,
        "shield_level": 4,
        "description": "Low-risk rider — morning shift in elevated Powai"
    },
    {
        "name": "Amit Patel",
        "phone": "9876543212",
        "email": "amit@demo.com",
        "zone": "Dadar",
        "dark_store": "Zepto Dark Store #12",
        "shift_type": "flexible",
        "avg_weekly_earnings": 5800,
        "avg_hourly_rate": 95,
        "shield_level": 2,
        "description": "Medium-risk rider — flexible hours in Dadar"
    },
]
