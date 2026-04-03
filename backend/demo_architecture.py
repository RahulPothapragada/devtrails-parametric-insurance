"""
Standalone demonstration of the core Hackathon Rules Implementation.
Run via: python backend/demo_architecture.py
"""

import asyncio
from app.services.triggers.historical_engine import historical_engine
from app.services.pricing.pricing_engine import PricingEngine

# Sample mock router for the Underwriting Rule Demonstration
def demo_underwriting_onboarding(rider_active_days: int):
    print("--- 1. UNDERWRITING & ONBOARDING RULE ---")
    print(f"[Input] Rider has {rider_active_days} active days in the last 30 days.")
    print("[Rule] Eligibility: >= 7 days.")
    print("[Rule] Activity Tier: < 5 active days = lower tier.")
    
    if rider_active_days < 7:
        print("❌ [Result] Underwriting Rejected: Did not meet 7-day minimum requirement.")
        tier = "low"
    else:
        print("✅ [Result] Underwriting Passed: 7+ days met.")
        tier = "low" if rider_active_days < 5 else "medium" if rider_active_days < 20 else "high"
    
    print(f"[Action] Assigned Worker Activity Tier: '{tier.upper()}'\n")
    return tier if rider_active_days >= 7 else None

def demo_historical_trigger():
    print("--- 2. TRIGGER DESIGN (10-YEAR HISTORICAL DATA) ---")
    print("[Rule] Use 10 years historical data & forecast simulation to establish trigger probability.")
    
    cities = [
        "mumbai", "delhi", "bangalore", "chennai", "kolkata",  # Tier 1
        "pune", "hyderabad", "ahmedabad", "jaipur",          # Tier 2
        "lucknow", "indore", "patna", "bhopal"               # Tier 3
    ]
    
    # Just show a subset so the terminal doesn't spam too much, but explicitly loop through
    for city in cities:
        # Selecting peril type to mix it up for the demo
        peril = "aqi" if city in ["delhi", "lucknow", "patna"] else "rainfall" if city in ["mumbai", "chennai", "kolkata"] else "heat"
        
        res = historical_engine.calculate_trigger_probability(city, peril)
        print(f"[{city.upper()} - {peril.upper()}] 10-Yr Historical Breaches = {res['historical_breaches_10y']} / 3650 days.")
        print(f"[{city.upper()}] Calculated Dynamic Probability = {res['trigger_probability'] * 100}%")
        print(f"[{city.upper()}] Methodology = {res['methodology']}\n")

def demo_pricing(activity_tier: str):
    print("--- 3. WEEKLY PRICING MODEL ---")
    print("[Rule] Target Range: ₹20–₹50 per worker per week.")
    print("[Rule] Base: (prob) × (avg income lost) × (days exposed).")
    
    pricing = PricingEngine()
    result = pricing.calculate_premium(
        city="delhi", 
        zone_tier="high", 
        month=1, 
        city_tier="tier_1", 
        area_type="urban", 
        activity_tier=activity_tier
    )
    
    print(f"[Calc] Formula: {result['formula']}")
    print(f"[Calc] Output Premium: ₹{result['weekly_premium']}")
    if 20 <= result['weekly_premium'] <= 50:
        print("✅ [Result] Premium falls strictly within the ₹20-₹50 target bounds.\n")
    else:
        print("❌ [Result] Premium bounds violation.\n")

def demo_actuarial_bcr():
    print("--- 4. ACTUARIAL SUSTAINABILITY (BCR & LOSS RATIO) ---")
    print("[Rule] Target BCR: 0.55 - 0.70")
    print("[Rule] Loss Ratio > 0.85 triggers auto-suspension.")
    
    # Mocking the math built into admin.py
    scenarios = [
        {"city": "Bangalore", "premium_collected": 100000, "claims_paid": 60000}, # Optimal
        {"city": "Mumbai", "premium_collected": 100000, "claims_paid": 92000},    # Critical
    ]
    
    for s in scenarios:
        loss_ratio = s["claims_paid"] / s["premium_collected"]
        bcr = loss_ratio # In pure parametric models without heavy opex, BCR maps tightly to LR
        status = "healthy" if loss_ratio <= 0.55 else "optimal" if loss_ratio <= 0.70 else "watch" if loss_ratio <= 0.85 else "critical"
        
        print(f"[{s['city'].upper()}] Premiums: ₹{s['premium_collected']} | Claims Paid: ₹{s['claims_paid']}")
        print(f"[{s['city'].upper()}] BCR / Loss Ratio = {bcr:.2f}")
        
        if status == "critical":
            print(f"🚨 [Result] STATUS: {status.upper()} -> Enrolment suspended in {s['city']} to protect risk pool.\n")
        else:
            print(f"✅ [Result] STATUS: {status.upper()} -> Continuing onboarding.\n")

if __name__ == "__main__":
    # Test a newly onboarded rider who works frequently
    assigned_tier = demo_underwriting_onboarding(rider_active_days=25)
    
    demo_historical_trigger()
    
    if assigned_tier:
        demo_pricing(assigned_tier)
        
    demo_actuarial_bcr()
