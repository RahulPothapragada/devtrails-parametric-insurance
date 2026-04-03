"""
Seed data for development and demos.
PAN India — 13 cities across 3 tiers, 80+ zones (urban + semi-urban + rural),
dark stores across all metros. Risk scores based on real geographic/climate data.
"""

# ── Cities by Tier ──
# Tier 1: Metros (highest cost of living, highest payouts)
# Tier 2: Major cities (mid-range payouts)
# Tier 3: Smaller cities + rural hinterland (lowest payouts, highest need)

CITIES = [
    # Tier 1 — Metros
    {"name": "Mumbai", "state": "Maharashtra", "lat": 19.076, "lng": 72.8777, "base_rate": 22, "city_tier": "tier_1"},
    {"name": "Delhi", "state": "Delhi", "lat": 28.6139, "lng": 77.209, "base_rate": 24, "city_tier": "tier_1"},
    {"name": "Bangalore", "state": "Karnataka", "lat": 12.9716, "lng": 77.5946, "base_rate": 20, "city_tier": "tier_1"},
    {"name": "Chennai", "state": "Tamil Nadu", "lat": 13.0827, "lng": 80.2707, "base_rate": 20, "city_tier": "tier_1"},
    {"name": "Kolkata", "state": "West Bengal", "lat": 22.5726, "lng": 88.3639, "base_rate": 20, "city_tier": "tier_1"},
    # Tier 2 — Major Cities
    {"name": "Pune", "state": "Maharashtra", "lat": 18.5204, "lng": 73.8567, "base_rate": 16, "city_tier": "tier_2"},
    {"name": "Hyderabad", "state": "Telangana", "lat": 17.3850, "lng": 78.4867, "base_rate": 16, "city_tier": "tier_2"},
    {"name": "Ahmedabad", "state": "Gujarat", "lat": 23.0225, "lng": 72.5714, "base_rate": 15, "city_tier": "tier_2"},
    {"name": "Jaipur", "state": "Rajasthan", "lat": 26.9124, "lng": 75.7873, "base_rate": 15, "city_tier": "tier_2"},
    # Tier 3 — Smaller Cities (with rural hinterland)
    {"name": "Lucknow", "state": "Uttar Pradesh", "lat": 26.8467, "lng": 80.9462, "base_rate": 12, "city_tier": "tier_3"},
    {"name": "Indore", "state": "Madhya Pradesh", "lat": 22.7196, "lng": 75.8577, "base_rate": 12, "city_tier": "tier_3"},
    {"name": "Patna", "state": "Bihar", "lat": 25.6093, "lng": 85.1376, "base_rate": 10, "city_tier": "tier_3"},
    {"name": "Bhopal", "state": "Madhya Pradesh", "lat": 23.2599, "lng": 77.4126, "base_rate": 12, "city_tier": "tier_3"},
]

# ── Mumbai Zones (14) ──
MUMBAI_ZONES = [
    # High Risk — flood-prone, poor drainage, low-lying
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
    # Medium Risk
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
    # Low Risk — elevated, good drainage
    {"name": "Powai", "tier": "low", "lat": 19.1176, "lng": 72.9060,
     "flood_risk": 0.20, "heat_risk": 0.45, "aqi_risk": 0.4, "traffic_risk": 0.45},
    {"name": "BKC", "tier": "low", "lat": 19.0658, "lng": 72.8687,
     "flood_risk": 0.25, "heat_risk": 0.45, "aqi_risk": 0.45, "traffic_risk": 0.50},
    {"name": "Thane", "tier": "low", "lat": 19.2183, "lng": 72.9781,
     "flood_risk": 0.30, "heat_risk": 0.5, "aqi_risk": 0.45, "traffic_risk": 0.40},
    {"name": "Navi Mumbai", "tier": "low", "lat": 19.0330, "lng": 73.0297,
     "flood_risk": 0.25, "heat_risk": 0.45, "aqi_risk": 0.4, "traffic_risk": 0.35},
]

# ── Delhi Zones (12) — extreme AQI, heat, fog ──
DELHI_ZONES = [
    # High Risk — industrial, congested, poor air
    {"name": "Anand Vihar", "tier": "high", "lat": 28.6469, "lng": 77.3164,
     "flood_risk": 0.40, "heat_risk": 0.85, "aqi_risk": 0.95, "traffic_risk": 0.85},
    {"name": "Chandni Chowk", "tier": "high", "lat": 28.6506, "lng": 77.2303,
     "flood_risk": 0.55, "heat_risk": 0.80, "aqi_risk": 0.85, "traffic_risk": 0.90},
    {"name": "Jahangirpuri", "tier": "high", "lat": 28.7258, "lng": 77.1698,
     "flood_risk": 0.50, "heat_risk": 0.80, "aqi_risk": 0.90, "traffic_risk": 0.75},
    {"name": "Mundka", "tier": "high", "lat": 28.6832, "lng": 77.0311,
     "flood_risk": 0.45, "heat_risk": 0.85, "aqi_risk": 0.92, "traffic_risk": 0.70},
    # Medium Risk
    {"name": "Connaught Place", "tier": "medium", "lat": 28.6315, "lng": 77.2167,
     "flood_risk": 0.30, "heat_risk": 0.70, "aqi_risk": 0.70, "traffic_risk": 0.80},
    {"name": "Lajpat Nagar", "tier": "medium", "lat": 28.5677, "lng": 77.2433,
     "flood_risk": 0.35, "heat_risk": 0.72, "aqi_risk": 0.72, "traffic_risk": 0.75},
    {"name": "Rohini", "tier": "medium", "lat": 28.7495, "lng": 77.0565,
     "flood_risk": 0.40, "heat_risk": 0.75, "aqi_risk": 0.78, "traffic_risk": 0.65},
    {"name": "Dwarka", "tier": "medium", "lat": 28.5921, "lng": 77.0460,
     "flood_risk": 0.30, "heat_risk": 0.70, "aqi_risk": 0.68, "traffic_risk": 0.60},
    # Low Risk — planned areas, green cover
    {"name": "Vasant Kunj", "tier": "low", "lat": 28.5195, "lng": 77.1599,
     "flood_risk": 0.15, "heat_risk": 0.55, "aqi_risk": 0.55, "traffic_risk": 0.45},
    {"name": "Saket", "tier": "low", "lat": 28.5244, "lng": 77.2066,
     "flood_risk": 0.18, "heat_risk": 0.58, "aqi_risk": 0.52, "traffic_risk": 0.50},
    {"name": "Greater Kailash", "tier": "low", "lat": 28.5413, "lng": 77.2434,
     "flood_risk": 0.15, "heat_risk": 0.55, "aqi_risk": 0.50, "traffic_risk": 0.48},
    {"name": "Noida Sec 18", "tier": "low", "lat": 28.5706, "lng": 77.3219,
     "flood_risk": 0.20, "heat_risk": 0.60, "aqi_risk": 0.60, "traffic_risk": 0.55},
]

# ── Bangalore Zones (10) — traffic capital, moderate weather ──
BANGALORE_ZONES = [
    # High Risk — traffic nightmares, flooding in monsoon
    {"name": "Silk Board", "tier": "high", "lat": 12.9177, "lng": 77.6238,
     "flood_risk": 0.55, "heat_risk": 0.35, "aqi_risk": 0.50, "traffic_risk": 0.95},
    {"name": "Majestic", "tier": "high", "lat": 12.9767, "lng": 77.5713,
     "flood_risk": 0.50, "heat_risk": 0.40, "aqi_risk": 0.55, "traffic_risk": 0.90},
    {"name": "KR Puram", "tier": "high", "lat": 13.0098, "lng": 77.6960,
     "flood_risk": 0.60, "heat_risk": 0.38, "aqi_risk": 0.48, "traffic_risk": 0.88},
    # Medium Risk
    {"name": "Koramangala", "tier": "medium", "lat": 12.9352, "lng": 77.6245,
     "flood_risk": 0.40, "heat_risk": 0.35, "aqi_risk": 0.42, "traffic_risk": 0.75},
    {"name": "HSR Layout", "tier": "medium", "lat": 12.9116, "lng": 77.6389,
     "flood_risk": 0.45, "heat_risk": 0.35, "aqi_risk": 0.40, "traffic_risk": 0.70},
    {"name": "Indiranagar", "tier": "medium", "lat": 12.9784, "lng": 77.6408,
     "flood_risk": 0.35, "heat_risk": 0.35, "aqi_risk": 0.42, "traffic_risk": 0.72},
    {"name": "Jayanagar", "tier": "medium", "lat": 12.9308, "lng": 77.5838,
     "flood_risk": 0.30, "heat_risk": 0.38, "aqi_risk": 0.38, "traffic_risk": 0.65},
    # Low Risk
    {"name": "Whitefield", "tier": "low", "lat": 12.9698, "lng": 77.7500,
     "flood_risk": 0.20, "heat_risk": 0.30, "aqi_risk": 0.35, "traffic_risk": 0.55},
    {"name": "Electronic City", "tier": "low", "lat": 12.8399, "lng": 77.6770,
     "flood_risk": 0.18, "heat_risk": 0.32, "aqi_risk": 0.32, "traffic_risk": 0.50},
    {"name": "Yelahanka", "tier": "low", "lat": 13.1007, "lng": 77.5963,
     "flood_risk": 0.15, "heat_risk": 0.30, "aqi_risk": 0.30, "traffic_risk": 0.40},
]

# ── Chennai Zones (10) — cyclones, extreme heat, coastal flooding ──
CHENNAI_ZONES = [
    # High Risk — low-lying, coastal, flood-prone
    {"name": "T. Nagar", "tier": "high", "lat": 13.0418, "lng": 80.2341,
     "flood_risk": 0.80, "heat_risk": 0.82, "aqi_risk": 0.45, "traffic_risk": 0.80},
    {"name": "Velachery", "tier": "high", "lat": 12.9815, "lng": 80.2180,
     "flood_risk": 0.92, "heat_risk": 0.80, "aqi_risk": 0.42, "traffic_risk": 0.75},
    {"name": "Tambaram", "tier": "high", "lat": 12.9249, "lng": 80.1000,
     "flood_risk": 0.85, "heat_risk": 0.78, "aqi_risk": 0.40, "traffic_risk": 0.70},
    # Medium Risk
    {"name": "Anna Nagar", "tier": "medium", "lat": 13.0850, "lng": 80.2101,
     "flood_risk": 0.50, "heat_risk": 0.75, "aqi_risk": 0.40, "traffic_risk": 0.68},
    {"name": "Adyar", "tier": "medium", "lat": 13.0012, "lng": 80.2565,
     "flood_risk": 0.55, "heat_risk": 0.72, "aqi_risk": 0.38, "traffic_risk": 0.65},
    {"name": "Porur", "tier": "medium", "lat": 13.0382, "lng": 80.1564,
     "flood_risk": 0.48, "heat_risk": 0.70, "aqi_risk": 0.42, "traffic_risk": 0.62},
    {"name": "Chromepet", "tier": "medium", "lat": 12.9516, "lng": 80.1462,
     "flood_risk": 0.52, "heat_risk": 0.72, "aqi_risk": 0.40, "traffic_risk": 0.60},
    # Low Risk
    {"name": "ECR (OMR)", "tier": "low", "lat": 12.9010, "lng": 80.2279,
     "flood_risk": 0.25, "heat_risk": 0.60, "aqi_risk": 0.30, "traffic_risk": 0.45},
    {"name": "Sholinganallur", "tier": "low", "lat": 12.9010, "lng": 80.2279,
     "flood_risk": 0.22, "heat_risk": 0.62, "aqi_risk": 0.32, "traffic_risk": 0.48},
    {"name": "Thiruvanmiyur", "tier": "low", "lat": 12.9830, "lng": 80.2594,
     "flood_risk": 0.28, "heat_risk": 0.58, "aqi_risk": 0.30, "traffic_risk": 0.42},
]

# ── Kolkata Zones (10) — cyclones, waterlogging, humidity ──
KOLKATA_ZONES = [
    # High Risk — low-lying, canal-adjacent, poor drainage
    {"name": "Salt Lake", "tier": "high", "lat": 22.5800, "lng": 88.4179,
     "flood_risk": 0.82, "heat_risk": 0.70, "aqi_risk": 0.55, "traffic_risk": 0.70},
    {"name": "Howrah", "tier": "high", "lat": 22.5958, "lng": 88.2636,
     "flood_risk": 0.85, "heat_risk": 0.72, "aqi_risk": 0.60, "traffic_risk": 0.80},
    {"name": "Behala", "tier": "high", "lat": 22.4981, "lng": 88.3200,
     "flood_risk": 0.78, "heat_risk": 0.68, "aqi_risk": 0.52, "traffic_risk": 0.72},
    # Medium Risk
    {"name": "Park Street", "tier": "medium", "lat": 22.5521, "lng": 88.3527,
     "flood_risk": 0.45, "heat_risk": 0.65, "aqi_risk": 0.48, "traffic_risk": 0.75},
    {"name": "New Town", "tier": "medium", "lat": 22.5922, "lng": 88.4847,
     "flood_risk": 0.40, "heat_risk": 0.62, "aqi_risk": 0.42, "traffic_risk": 0.55},
    {"name": "Jadavpur", "tier": "medium", "lat": 22.4988, "lng": 88.3714,
     "flood_risk": 0.50, "heat_risk": 0.65, "aqi_risk": 0.45, "traffic_risk": 0.65},
    {"name": "Dum Dum", "tier": "medium", "lat": 22.6232, "lng": 88.4335,
     "flood_risk": 0.48, "heat_risk": 0.65, "aqi_risk": 0.50, "traffic_risk": 0.60},
    # Low Risk
    {"name": "Alipore", "tier": "low", "lat": 22.5326, "lng": 88.3330,
     "flood_risk": 0.22, "heat_risk": 0.55, "aqi_risk": 0.38, "traffic_risk": 0.45},
    {"name": "Rajarhat", "tier": "low", "lat": 22.6100, "lng": 88.5000,
     "flood_risk": 0.20, "heat_risk": 0.52, "aqi_risk": 0.35, "traffic_risk": 0.38},
    {"name": "Ballygunge", "tier": "low", "lat": 22.5270, "lng": 88.3654,
     "flood_risk": 0.25, "heat_risk": 0.55, "aqi_risk": 0.40, "traffic_risk": 0.48},
]

# ── Tier 2: Pune Zones (8) — moderate flooding, growing traffic ──
PUNE_ZONES = [
    # Urban — High Risk
    {"name": "Swargate", "tier": "high", "lat": 18.5018, "lng": 73.8636, "area_type": "urban",
     "flood_risk": 0.65, "heat_risk": 0.50, "aqi_risk": 0.45, "traffic_risk": 0.75},
    {"name": "Hadapsar", "tier": "high", "lat": 18.5089, "lng": 73.9260, "area_type": "urban",
     "flood_risk": 0.70, "heat_risk": 0.48, "aqi_risk": 0.42, "traffic_risk": 0.70},
    # Urban — Medium Risk
    {"name": "Kothrud", "tier": "medium", "lat": 18.5074, "lng": 73.8077, "area_type": "urban",
     "flood_risk": 0.40, "heat_risk": 0.45, "aqi_risk": 0.38, "traffic_risk": 0.62},
    {"name": "Hinjewadi", "tier": "medium", "lat": 18.5912, "lng": 73.7390, "area_type": "urban",
     "flood_risk": 0.35, "heat_risk": 0.42, "aqi_risk": 0.35, "traffic_risk": 0.80},
    # Semi-Urban
    {"name": "Wagholi", "tier": "medium", "lat": 18.5800, "lng": 73.9800, "area_type": "semi_urban",
     "flood_risk": 0.45, "heat_risk": 0.50, "aqi_risk": 0.40, "traffic_risk": 0.50},
    {"name": "Undri", "tier": "low", "lat": 18.4600, "lng": 73.9200, "area_type": "semi_urban",
     "flood_risk": 0.25, "heat_risk": 0.45, "aqi_risk": 0.30, "traffic_risk": 0.35},
    # Rural
    {"name": "Mulshi (Rural)", "tier": "high", "lat": 18.5100, "lng": 73.5200, "area_type": "rural",
     "flood_risk": 0.75, "heat_risk": 0.55, "aqi_risk": 0.20, "traffic_risk": 0.20},
    {"name": "Maval (Rural)", "tier": "medium", "lat": 18.7500, "lng": 73.5000, "area_type": "rural",
     "flood_risk": 0.60, "heat_risk": 0.52, "aqi_risk": 0.18, "traffic_risk": 0.15},
]

# ── Tier 2: Hyderabad Zones (8) ──
HYDERABAD_ZONES = [
    {"name": "Ameerpet", "tier": "high", "lat": 17.4375, "lng": 78.4483, "area_type": "urban",
     "flood_risk": 0.60, "heat_risk": 0.72, "aqi_risk": 0.48, "traffic_risk": 0.78},
    {"name": "LB Nagar", "tier": "high", "lat": 17.3457, "lng": 78.5522, "area_type": "urban",
     "flood_risk": 0.65, "heat_risk": 0.70, "aqi_risk": 0.45, "traffic_risk": 0.72},
    {"name": "Gachibowli", "tier": "medium", "lat": 17.4401, "lng": 78.3489, "area_type": "urban",
     "flood_risk": 0.35, "heat_risk": 0.65, "aqi_risk": 0.38, "traffic_risk": 0.68},
    {"name": "Kukatpally", "tier": "medium", "lat": 17.4948, "lng": 78.3996, "area_type": "urban",
     "flood_risk": 0.40, "heat_risk": 0.62, "aqi_risk": 0.42, "traffic_risk": 0.65},
    {"name": "Shamshabad", "tier": "medium", "lat": 17.2403, "lng": 78.4294, "area_type": "semi_urban",
     "flood_risk": 0.30, "heat_risk": 0.68, "aqi_risk": 0.35, "traffic_risk": 0.45},
    {"name": "Medchal", "tier": "low", "lat": 17.6298, "lng": 78.4813, "area_type": "semi_urban",
     "flood_risk": 0.20, "heat_risk": 0.60, "aqi_risk": 0.30, "traffic_risk": 0.35},
    {"name": "Vikarabad (Rural)", "tier": "high", "lat": 17.3384, "lng": 77.9044, "area_type": "rural",
     "flood_risk": 0.55, "heat_risk": 0.75, "aqi_risk": 0.18, "traffic_risk": 0.15},
    {"name": "Chevella (Rural)", "tier": "medium", "lat": 17.3126, "lng": 78.1387, "area_type": "rural",
     "flood_risk": 0.40, "heat_risk": 0.70, "aqi_risk": 0.15, "traffic_risk": 0.12},
]

# ── Tier 2: Ahmedabad Zones (7) — extreme heat, industrial AQI ──
AHMEDABAD_ZONES = [
    {"name": "Maninagar", "tier": "high", "lat": 23.0008, "lng": 72.6076, "area_type": "urban",
     "flood_risk": 0.50, "heat_risk": 0.88, "aqi_risk": 0.55, "traffic_risk": 0.70},
    {"name": "Kalupur", "tier": "high", "lat": 23.0258, "lng": 72.6000, "area_type": "urban",
     "flood_risk": 0.55, "heat_risk": 0.85, "aqi_risk": 0.60, "traffic_risk": 0.75},
    {"name": "SG Highway", "tier": "medium", "lat": 23.0300, "lng": 72.5100, "area_type": "urban",
     "flood_risk": 0.30, "heat_risk": 0.78, "aqi_risk": 0.42, "traffic_risk": 0.65},
    {"name": "Bopal", "tier": "low", "lat": 23.0300, "lng": 72.4700, "area_type": "semi_urban",
     "flood_risk": 0.20, "heat_risk": 0.72, "aqi_risk": 0.35, "traffic_risk": 0.40},
    {"name": "Sanand", "tier": "medium", "lat": 22.9900, "lng": 72.3800, "area_type": "semi_urban",
     "flood_risk": 0.35, "heat_risk": 0.80, "aqi_risk": 0.48, "traffic_risk": 0.30},
    {"name": "Dholka (Rural)", "tier": "high", "lat": 22.7200, "lng": 72.4400, "area_type": "rural",
     "flood_risk": 0.68, "heat_risk": 0.90, "aqi_risk": 0.20, "traffic_risk": 0.10},
    {"name": "Bavla (Rural)", "tier": "medium", "lat": 22.8300, "lng": 72.3600, "area_type": "rural",
     "flood_risk": 0.45, "heat_risk": 0.85, "aqi_risk": 0.18, "traffic_risk": 0.08},
]

# ── Tier 2: Jaipur Zones (7) — extreme heat, dust storms ──
JAIPUR_ZONES = [
    {"name": "Johari Bazaar", "tier": "high", "lat": 26.9196, "lng": 75.8235, "area_type": "urban",
     "flood_risk": 0.40, "heat_risk": 0.90, "aqi_risk": 0.55, "traffic_risk": 0.72},
    {"name": "Mansarovar", "tier": "medium", "lat": 26.8680, "lng": 75.7600, "area_type": "urban",
     "flood_risk": 0.30, "heat_risk": 0.82, "aqi_risk": 0.45, "traffic_risk": 0.60},
    {"name": "Vaishali Nagar", "tier": "medium", "lat": 26.9100, "lng": 75.7300, "area_type": "urban",
     "flood_risk": 0.25, "heat_risk": 0.80, "aqi_risk": 0.42, "traffic_risk": 0.55},
    {"name": "Sitapura", "tier": "low", "lat": 26.7800, "lng": 75.8400, "area_type": "semi_urban",
     "flood_risk": 0.18, "heat_risk": 0.78, "aqi_risk": 0.38, "traffic_risk": 0.35},
    {"name": "Bagru (Rural)", "tier": "high", "lat": 26.8100, "lng": 75.5500, "area_type": "rural",
     "flood_risk": 0.35, "heat_risk": 0.92, "aqi_risk": 0.22, "traffic_risk": 0.10},
    {"name": "Chomu (Rural)", "tier": "medium", "lat": 27.1700, "lng": 75.7200, "area_type": "rural",
     "flood_risk": 0.30, "heat_risk": 0.88, "aqi_risk": 0.18, "traffic_risk": 0.08},
    {"name": "Phagi (Rural)", "tier": "medium", "lat": 26.5800, "lng": 75.9500, "area_type": "rural",
     "flood_risk": 0.38, "heat_risk": 0.90, "aqi_risk": 0.15, "traffic_risk": 0.06},
]

# ── Tier 3: Lucknow Zones (6) — floods, heat, fog ──
LUCKNOW_ZONES = [
    {"name": "Charbagh", "tier": "high", "lat": 26.8580, "lng": 80.9210, "area_type": "urban",
     "flood_risk": 0.55, "heat_risk": 0.82, "aqi_risk": 0.50, "traffic_risk": 0.68},
    {"name": "Hazratganj", "tier": "medium", "lat": 26.8509, "lng": 80.9462, "area_type": "urban",
     "flood_risk": 0.40, "heat_risk": 0.78, "aqi_risk": 0.45, "traffic_risk": 0.62},
    {"name": "Gomti Nagar", "tier": "low", "lat": 26.8560, "lng": 81.0050, "area_type": "urban",
     "flood_risk": 0.25, "heat_risk": 0.72, "aqi_risk": 0.38, "traffic_risk": 0.50},
    {"name": "Chinhat", "tier": "medium", "lat": 26.8700, "lng": 81.0500, "area_type": "semi_urban",
     "flood_risk": 0.45, "heat_risk": 0.80, "aqi_risk": 0.40, "traffic_risk": 0.35},
    {"name": "Mohanlalganj (Rural)", "tier": "high", "lat": 26.6700, "lng": 80.8900, "area_type": "rural",
     "flood_risk": 0.70, "heat_risk": 0.85, "aqi_risk": 0.22, "traffic_risk": 0.10},
    {"name": "Malihabad (Rural)", "tier": "medium", "lat": 26.9200, "lng": 80.7200, "area_type": "rural",
     "flood_risk": 0.55, "heat_risk": 0.82, "aqi_risk": 0.18, "traffic_risk": 0.08},
]

# ── Tier 3: Indore Zones (6) ──
INDORE_ZONES = [
    {"name": "Rajwada", "tier": "high", "lat": 22.7196, "lng": 75.8577, "area_type": "urban",
     "flood_risk": 0.50, "heat_risk": 0.80, "aqi_risk": 0.42, "traffic_risk": 0.65},
    {"name": "Vijay Nagar", "tier": "medium", "lat": 22.7533, "lng": 75.8937, "area_type": "urban",
     "flood_risk": 0.35, "heat_risk": 0.75, "aqi_risk": 0.38, "traffic_risk": 0.55},
    {"name": "Rau", "tier": "medium", "lat": 22.6700, "lng": 75.8700, "area_type": "semi_urban",
     "flood_risk": 0.30, "heat_risk": 0.78, "aqi_risk": 0.32, "traffic_risk": 0.35},
    {"name": "Mhow (Rural)", "tier": "high", "lat": 22.5500, "lng": 75.7600, "area_type": "rural",
     "flood_risk": 0.55, "heat_risk": 0.82, "aqi_risk": 0.18, "traffic_risk": 0.08},
    {"name": "Depalpur (Rural)", "tier": "medium", "lat": 22.8500, "lng": 75.5500, "area_type": "rural",
     "flood_risk": 0.48, "heat_risk": 0.80, "aqi_risk": 0.15, "traffic_risk": 0.06},
    {"name": "Sanwer (Rural)", "tier": "low", "lat": 22.9200, "lng": 75.8200, "area_type": "rural",
     "flood_risk": 0.25, "heat_risk": 0.75, "aqi_risk": 0.12, "traffic_risk": 0.05},
]

# ── Tier 3: Patna Zones (6) — severe flooding, heat ──
PATNA_ZONES = [
    {"name": "Gandhi Maidan", "tier": "high", "lat": 25.6117, "lng": 85.1410, "area_type": "urban",
     "flood_risk": 0.80, "heat_risk": 0.82, "aqi_risk": 0.48, "traffic_risk": 0.65},
    {"name": "Boring Road", "tier": "medium", "lat": 25.6100, "lng": 85.1200, "area_type": "urban",
     "flood_risk": 0.50, "heat_risk": 0.78, "aqi_risk": 0.42, "traffic_risk": 0.58},
    {"name": "Kankarbagh", "tier": "medium", "lat": 25.5900, "lng": 85.1700, "area_type": "urban",
     "flood_risk": 0.55, "heat_risk": 0.80, "aqi_risk": 0.45, "traffic_risk": 0.55},
    {"name": "Danapur", "tier": "medium", "lat": 25.6300, "lng": 85.0500, "area_type": "semi_urban",
     "flood_risk": 0.60, "heat_risk": 0.80, "aqi_risk": 0.38, "traffic_risk": 0.35},
    {"name": "Maner (Rural)", "tier": "high", "lat": 25.6500, "lng": 84.8800, "area_type": "rural",
     "flood_risk": 0.88, "heat_risk": 0.85, "aqi_risk": 0.20, "traffic_risk": 0.08},
    {"name": "Phulwari Sharif (Rural)", "tier": "high", "lat": 25.5600, "lng": 85.0800, "area_type": "rural",
     "flood_risk": 0.82, "heat_risk": 0.82, "aqi_risk": 0.18, "traffic_risk": 0.06},
]

# ── Tier 3: Bhopal Zones (6) ──
BHOPAL_ZONES = [
    {"name": "MP Nagar", "tier": "high", "lat": 23.2332, "lng": 77.4350, "area_type": "urban",
     "flood_risk": 0.45, "heat_risk": 0.78, "aqi_risk": 0.42, "traffic_risk": 0.62},
    {"name": "Habibganj", "tier": "medium", "lat": 23.2300, "lng": 77.4100, "area_type": "urban",
     "flood_risk": 0.35, "heat_risk": 0.75, "aqi_risk": 0.38, "traffic_risk": 0.55},
    {"name": "Kolar Road", "tier": "medium", "lat": 23.1700, "lng": 77.4500, "area_type": "semi_urban",
     "flood_risk": 0.40, "heat_risk": 0.78, "aqi_risk": 0.35, "traffic_risk": 0.38},
    {"name": "Mandideep", "tier": "medium", "lat": 23.0800, "lng": 77.5100, "area_type": "semi_urban",
     "flood_risk": 0.42, "heat_risk": 0.80, "aqi_risk": 0.48, "traffic_risk": 0.30},
    {"name": "Berasia (Rural)", "tier": "high", "lat": 23.6300, "lng": 77.4300, "area_type": "rural",
     "flood_risk": 0.60, "heat_risk": 0.82, "aqi_risk": 0.18, "traffic_risk": 0.08},
    {"name": "Sehore (Rural)", "tier": "medium", "lat": 23.2000, "lng": 77.0900, "area_type": "rural",
     "flood_risk": 0.48, "heat_risk": 0.80, "aqi_risk": 0.15, "traffic_risk": 0.06},
]

# ── All city zone mappings ──
CITY_ZONES = {
    # Tier 1
    "Mumbai": MUMBAI_ZONES,
    "Delhi": DELHI_ZONES,
    "Bangalore": BANGALORE_ZONES,
    "Chennai": CHENNAI_ZONES,
    "Kolkata": KOLKATA_ZONES,
    # Tier 2
    "Pune": PUNE_ZONES,
    "Hyderabad": HYDERABAD_ZONES,
    "Ahmedabad": AHMEDABAD_ZONES,
    "Jaipur": JAIPUR_ZONES,
    # Tier 3
    "Lucknow": LUCKNOW_ZONES,
    "Indore": INDORE_ZONES,
    "Patna": PATNA_ZONES,
    "Bhopal": BHOPAL_ZONES,
}

# ── Dark Stores (per city) ──
MUMBAI_DARK_STORES = [
    {"zone": "Andheri West", "name": "Zepto Andheri Hub", "lat": 19.1364, "lng": 72.8296},
    {"zone": "Andheri West", "name": "Blinkit Andheri West", "lat": 19.1320, "lng": 72.8350},
    {"zone": "Dadar", "name": "Zepto Dadar Central", "lat": 19.0178, "lng": 72.8478},
    {"zone": "Kurla", "name": "Blinkit Kurla Hub", "lat": 19.0726, "lng": 72.8794},
    {"zone": "Bandra", "name": "Zepto Bandra West", "lat": 19.0596, "lng": 72.8295},
    {"zone": "Powai", "name": "Swiggy Instamart Powai", "lat": 19.1176, "lng": 72.9060},
    {"zone": "BKC", "name": "Zepto BKC Hub", "lat": 19.0658, "lng": 72.8687},
    {"zone": "Thane", "name": "Blinkit Thane Station", "lat": 19.2183, "lng": 72.9781},
]

DELHI_DARK_STORES = [
    {"zone": "Anand Vihar", "name": "Blinkit Anand Vihar", "lat": 28.6469, "lng": 77.3164},
    {"zone": "Chandni Chowk", "name": "Zepto Old Delhi Hub", "lat": 28.6506, "lng": 77.2303},
    {"zone": "Connaught Place", "name": "Blinkit CP Central", "lat": 28.6315, "lng": 77.2167},
    {"zone": "Rohini", "name": "Zepto Rohini Sec 7", "lat": 28.7495, "lng": 77.0565},
    {"zone": "Dwarka", "name": "Swiggy Instamart Dwarka", "lat": 28.5921, "lng": 77.0460},
    {"zone": "Saket", "name": "Blinkit Saket Mall", "lat": 28.5244, "lng": 77.2066},
    {"zone": "Noida Sec 18", "name": "Zepto Noida Hub", "lat": 28.5706, "lng": 77.3219},
]

BANGALORE_DARK_STORES = [
    {"zone": "Silk Board", "name": "Zepto Silk Board Hub", "lat": 12.9177, "lng": 77.6238},
    {"zone": "Koramangala", "name": "Blinkit Koramangala 4th Block", "lat": 12.9352, "lng": 77.6245},
    {"zone": "HSR Layout", "name": "Swiggy Instamart HSR", "lat": 12.9116, "lng": 77.6389},
    {"zone": "Indiranagar", "name": "Zepto Indiranagar 100ft Rd", "lat": 12.9784, "lng": 77.6408},
    {"zone": "Whitefield", "name": "Blinkit Whitefield Main", "lat": 12.9698, "lng": 77.7500},
    {"zone": "Electronic City", "name": "Zepto E-City Phase 1", "lat": 12.8399, "lng": 77.6770},
]

CHENNAI_DARK_STORES = [
    {"zone": "T. Nagar", "name": "Blinkit T. Nagar Hub", "lat": 13.0418, "lng": 80.2341},
    {"zone": "Velachery", "name": "Zepto Velachery Main", "lat": 12.9815, "lng": 80.2180},
    {"zone": "Anna Nagar", "name": "Swiggy Instamart Anna Nagar", "lat": 13.0850, "lng": 80.2101},
    {"zone": "Adyar", "name": "Blinkit Adyar Hub", "lat": 13.0012, "lng": 80.2565},
    {"zone": "Sholinganallur", "name": "Zepto OMR Sholinganallur", "lat": 12.9010, "lng": 80.2279},
]

KOLKATA_DARK_STORES = [
    {"zone": "Salt Lake", "name": "Blinkit Salt Lake Sec V", "lat": 22.5800, "lng": 88.4179},
    {"zone": "Howrah", "name": "Zepto Howrah Station Hub", "lat": 22.5958, "lng": 88.2636},
    {"zone": "Park Street", "name": "Swiggy Instamart Park St", "lat": 22.5521, "lng": 88.3527},
    {"zone": "New Town", "name": "Blinkit New Town Hub", "lat": 22.5922, "lng": 88.4847},
    {"zone": "Jadavpur", "name": "Zepto Jadavpur Hub", "lat": 22.4988, "lng": 88.3714},
]

# ── Tier 2 Dark Stores ──
PUNE_DARK_STORES = [
    {"zone": "Swargate", "name": "Zepto Swargate Hub", "lat": 18.5018, "lng": 73.8636},
    {"zone": "Kothrud", "name": "Blinkit Kothrud Main", "lat": 18.5074, "lng": 73.8077},
    {"zone": "Hinjewadi", "name": "Swiggy Instamart Hinjewadi", "lat": 18.5912, "lng": 73.7390},
    {"zone": "Wagholi", "name": "Blinkit Wagholi Hub", "lat": 18.5800, "lng": 73.9800},
]

HYDERABAD_DARK_STORES = [
    {"zone": "Ameerpet", "name": "Zepto Ameerpet Hub", "lat": 17.4375, "lng": 78.4483},
    {"zone": "Gachibowli", "name": "Blinkit Gachibowli IT Park", "lat": 17.4401, "lng": 78.3489},
    {"zone": "Kukatpally", "name": "Swiggy Instamart Kukatpally", "lat": 17.4948, "lng": 78.3996},
    {"zone": "Shamshabad", "name": "Blinkit Shamshabad Hub", "lat": 17.2403, "lng": 78.4294},
]

AHMEDABAD_DARK_STORES = [
    {"zone": "Maninagar", "name": "Zepto Maninagar Hub", "lat": 23.0008, "lng": 72.6076},
    {"zone": "SG Highway", "name": "Blinkit SG Highway", "lat": 23.0300, "lng": 72.5100},
    {"zone": "Bopal", "name": "Swiggy Instamart Bopal", "lat": 23.0300, "lng": 72.4700},
]

JAIPUR_DARK_STORES = [
    {"zone": "Johari Bazaar", "name": "Zepto Johari Hub", "lat": 26.9196, "lng": 75.8235},
    {"zone": "Mansarovar", "name": "Blinkit Mansarovar", "lat": 26.8680, "lng": 75.7600},
    {"zone": "Vaishali Nagar", "name": "Swiggy Instamart Vaishali", "lat": 26.9100, "lng": 75.7300},
]

# ── Tier 3 Dark Stores ──
LUCKNOW_DARK_STORES = [
    {"zone": "Charbagh", "name": "Zepto Charbagh Hub", "lat": 26.8580, "lng": 80.9210},
    {"zone": "Hazratganj", "name": "Blinkit Hazratganj", "lat": 26.8509, "lng": 80.9462},
    {"zone": "Gomti Nagar", "name": "Swiggy Instamart Gomti Nagar", "lat": 26.8560, "lng": 81.0050},
]

INDORE_DARK_STORES = [
    {"zone": "Rajwada", "name": "Zepto Rajwada Hub", "lat": 22.7196, "lng": 75.8577},
    {"zone": "Vijay Nagar", "name": "Blinkit Vijay Nagar", "lat": 22.7533, "lng": 75.8937},
]

PATNA_DARK_STORES = [
    {"zone": "Gandhi Maidan", "name": "Zepto Gandhi Maidan Hub", "lat": 25.6117, "lng": 85.1410},
    {"zone": "Boring Road", "name": "Blinkit Boring Road", "lat": 25.6100, "lng": 85.1200},
]

BHOPAL_DARK_STORES = [
    {"zone": "MP Nagar", "name": "Zepto MP Nagar Hub", "lat": 23.2332, "lng": 77.4350},
    {"zone": "Habibganj", "name": "Blinkit Habibganj", "lat": 23.2300, "lng": 77.4100},
]

CITY_DARK_STORES = {
    # Tier 1
    "Mumbai": MUMBAI_DARK_STORES,
    "Delhi": DELHI_DARK_STORES,
    "Bangalore": BANGALORE_DARK_STORES,
    "Chennai": CHENNAI_DARK_STORES,
    "Kolkata": KOLKATA_DARK_STORES,
    # Tier 2
    "Pune": PUNE_DARK_STORES,
    "Hyderabad": HYDERABAD_DARK_STORES,
    "Ahmedabad": AHMEDABAD_DARK_STORES,
    "Jaipur": JAIPUR_DARK_STORES,
    # Tier 3
    "Lucknow": LUCKNOW_DARK_STORES,
    "Indore": INDORE_DARK_STORES,
    "Patna": PATNA_DARK_STORES,
    "Bhopal": BHOPAL_DARK_STORES,
}

# Sample riders for demo (kept for backward compat)
SAMPLE_RIDERS = [
    {
        "name": "Ravi Kumar",
        "phone": "9876543210",
        "email": "ravi@demo.com",
        "zone": "Andheri West",
        "dark_store": "Zepto Andheri Hub",
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
        "dark_store": "Swiggy Instamart Powai",
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
        "dark_store": "Zepto Dadar Central",
        "shift_type": "flexible",
        "avg_weekly_earnings": 5800,
        "avg_hourly_rate": 95,
        "shield_level": 2,
        "description": "Medium-risk rider — flexible hours in Dadar"
    },
]
