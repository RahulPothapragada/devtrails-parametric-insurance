# FlowSecure — Backend

Parametric microinsurance for gig workers. FastAPI + SQLite + SQLAlchemy async.

---

## Quick Start

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Run the server

```bash
uvicorn app.main:app --reload --port 8000
```

API docs available at: `http://localhost:8000/docs`

### Seed the database (13,000 riders, PAN India)

```bash
python -m app.mock_data.seed_db
```

This seeds:
- 13 cities (5 Tier 1 metros, 4 Tier 2, 4 Tier 3)
- 80+ zones with real lat/lng, area types (urban / semi-urban / rural)
- 1,000 riders per city (800 honest, 200 suspicious) = **13,000 riders total**
- 8 weeks of weekly ledger history per city for actuarial review
- Rate cards, dark stores, trigger readings

---

## Architecture

```
app/
├── api/routes/
│   ├── auth.py           # JWT register / login
│   ├── riders.py         # Rider profile & dashboard
│   ├── policies.py       # Weekly policy purchase & history
│   ├── claims.py         # Claim listing & detail
│   ├── triggers.py       # Live readings, simulate, stress scenarios
│   ├── pricing.py        # Premium quotes & rate cards
│   ├── fraud.py          # 7-wall fraud detection
│   ├── payouts.py        # UPI/IMPS payout lifecycle
│   ├── underwriting.py   # 4-step onboarding flow
│   └── admin.py          # Platform stats & actuarial endpoints
│
├── services/
│   ├── pricing/          # Dynamic premium engine (13 cities × 12 months)
│   ├── claims/           # Auto claim generation on trigger fire
│   ├── fraud/            # 7-wall fraud engine (proof-of-work, device, GPS,
│   │                     #   crowd oracle, graph network, temporal, multi-source)
│   ├── payout/           # Mock UPI/IMPS/Razorpay payout orchestration
│   ├── optimizer/        # Shift recommendation engine (avoid income loss)
│   ├── prediction/       # 7-day earnings impact forecast per zone
│   └── triggers/         # Weather / AQI / traffic / social / historical engines
│
├── models/models.py      # SQLAlchemy ORM (City, Zone, Rider, Policy, Claim,
│                         #   TriggerReading, WeeklyLedger, FraudCheck, ...)
├── schemas/schemas.py    # Pydantic request/response schemas
├── core/
│   ├── auth.py           # JWT utilities
│   └── database.py       # Async SQLite session
└── mock_data/
    ├── seed_data.py      # Static reference data (cities, zones, dark stores)
    └── seed_db.py        # Database seeder (13,000 riders + history)
```

---

## Key Endpoints

### Triggers & Stress Testing

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/triggers/simulate` | Fire a disruption in a zone, auto-generate claims |
| `GET`  | `/api/triggers/stress/{scenario}` | Actuarial stress scenario projection |
| `GET`  | `/api/triggers/status/{city_name}` | Zone-level trigger status |
| `GET`  | `/api/triggers/predict/{zone_id}` | 7-day risk forecast |
| `GET`  | `/api/triggers/optimize/{rider_id}` | Shift recommendation to avoid income loss |

**Stress scenarios:** `monsoon_14day` | `delhi_aqi_crisis` | `heat_wave_rajasthan` | `chennai_cyclone`

```
GET /api/triggers/stress/monsoon_14day
GET /api/triggers/stress/delhi_aqi_crisis
```

### Actuarial

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/admin/actuarial` | All-city BCR comparison with tier breakdown |
| `GET`  | `/api/admin/actuarial/{city_name}` | City-level BCR, loss ratio, sustainability |
| `GET`  | `/api/admin/weekly-ledger/{city_name}` | 8-week raw ledger with area breakdown |

**BCR target:** 0.55–0.70 · **Suspension threshold:** >0.85

### Payouts

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/payouts/{claim_id}/initiate` | Start UPI/IMPS payout |
| `POST` | `/api/payouts/{claim_id}/confirm` | Simulate payment confirmation (97% UPI success) |
| `POST` | `/api/payouts/{claim_id}/rollback` | Manual rollback with reason |
| `GET`  | `/api/payouts/{claim_id}/status` | Full payout lifecycle state |
| `POST` | `/api/payouts/bulk-initiate` | Admin: initiate all approved unpaid claims |

### Underwriting (4-step onboarding)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/underwriting/verify-identity` | Step 1: phone + Aadhaar mock KYC |
| `POST` | `/api/underwriting/check-activity` | Step 2: 7-day minimum activity gate |
| `POST` | `/api/underwriting/assign-zone` | Step 3: map rider to city pool |
| `POST` | `/api/underwriting/issue-policy` | Step 4: issue first weekly policy |

---

## City Coverage — PAN India

| Tier | Cities | Payout Multiplier |
|------|--------|-------------------|
| Tier 1 (Metro) | Mumbai, Delhi, Bangalore, Chennai, Kolkata | 1.0× |
| Tier 2 (Major) | Pune, Hyderabad, Ahmedabad, Jaipur | 0.80× |
| Tier 3 (Smaller) | Lucknow, Indore, Patna, Bhopal | 0.60× |

Area types within each city: **Urban** (1.0×) · **Semi-Urban** (0.75×) · **Rural** (0.55×)

Premium range: ₹20–50/week (Tier 1 urban) · ₹10–35/week (Tier 3 rural)

---

## Pricing Model

```
weekly_premium = base_rate
                 × city_risk_factor     (from 12-month historical IMD/CPCB data)
                 × city_tier_multiplier (1.0 / 0.80 / 0.60)
                 × area_type_multiplier (1.0 / 0.75 / 0.55)
                 × activity_tier_factor (high/medium/low activity)
```

**Trigger types:** `rainfall` · `heat` · `cold_fog` · `aqi` · `traffic` · `social`

---

## Fraud Detection — 7-Wall System

Each claim passes through 7 independent walls:

1. **Proof of Work** — validates trigger legitimacy via time-distance analysis
2. **Device Fingerprint** — device consistency across sessions
3. **Location Intelligence** — GPS geofencing and anomaly detection
4. **Crowd Oracle** — cross-validates against other riders in the same zone
5. **Graph Network** — detects coordinated fraud rings
6. **Temporal Patterns** — flags suspicious timing patterns
7. **Multi-Source** — cross-references external data feeds

Composite fraud score 0–100. Claims with score >70 are flagged for manual review.

---

## Environment

No external API keys required — all data feeds are mocked internally.

Database: SQLite (`flowsecure.db`) created automatically on first run.

Python: 3.11+ recommended.
