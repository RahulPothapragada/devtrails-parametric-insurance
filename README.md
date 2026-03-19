# GigShield — AI-Powered Income Protection for Quick-Commerce Delivery Workers

## What is GigShield?

GigShield is a weekly income protection platform for Zepto delivery riders in Mumbai. When external disruptions like heavy rain, poor air quality, traffic gridlock, or bandhs prevent riders from earning, GigShield automatically compensates their lost income — no forms, no calls, no waiting.

But unlike traditional insurance, GigShield does not just pay you after you lose money. It actively helps you avoid losing it in the first place.

The platform has three layers:

1. **Predict** — The AI forecasts disruptions for the coming week and shows riders which days and hours are risky.
2. **Optimize** — The AI recommends when to work and when to avoid, so riders can shift their hours around disruptions and keep earning.
3. **Protect** — When a disruption is unavoidable (city-wide flood, bandh, severe AQI), parametric insurance kicks in automatically and pays the rider within minutes.

Most teams will build layer 3 alone. We build all three. The result: riders earn more on good days and lose less on bad days. The insurance becomes a safety net, not the entire product.

---

## The Problem

India has over 7.7 million gig workers (NITI Aayog, 2022). Platform-based delivery riders for Zepto, Swiggy, Zomato, and Blinkit earn Rs.15,000-25,000 per month. They have no salary, no leave, no employer-provided safety net.

When it rains heavily, when AQI spikes, when a bandh is called — they simply earn nothing that day. Nobody compensates them. They absorb the full loss.

Using real IMD, CPCB, and TomTom data for Mumbai, we calculated that a typical Zepto rider loses approximately **15% of their annual income** to external disruptions they cannot control. That is roughly Rs.35,000 per year lost to weather, pollution, traffic, and social unrest.

There is currently no product in India that protects gig workers against this.

---

## Who Is Our User?

### The Delivery Rider

We chose **Zepto (quick-commerce/grocery delivery)** over food delivery platforms like Swiggy or Zomato for specific reasons:

**How a Zepto rider works:**
- Assigned to a specific dark store (small warehouse), not free-roaming
- Delivers within a 1-3 km radius from the dark store
- Works fixed shifts of 4-6 hours (unlike Swiggy/Zomato's flexible model)
- Completes 15-25 deliveries per shift at Rs.15-25 per order
- Earns Rs.500-1,000 per day, approximately Rs.4,500 per week
- The 10-minute delivery promise means any disruption breaks the model completely

**Why Zepto, not Swiggy:**

| Factor | Zepto | Swiggy |
|--------|-------|--------|
| Disruption impact | Binary — deliveries halt completely when it rains | Gradual — orders reduce but don't fully stop |
| Surge pricing | No surge — disruption means pure income loss | Surge during rain complicates the loss calculation |
| Zone size | 1-3 km from dark store — very precise | 5-8 km radius — harder to verify |
| Shift structure | Fixed shifts — easy to verify who was working | Flexible hours — harder to verify |
| Trigger clarity | Platform pauses dispatch — verifiable data point | Grey area between reduced and stopped |

When Zepto's dark store pauses dispatch due to flooding, every rider assigned to that store is affected equally. This gives us clean, verifiable data to work with. There is no ambiguity about whether the rider "could have worked" — the platform itself stopped sending orders.

**What the rider actually wants:**

We spent time understanding what a street-smart delivery worker cares about. They do not want to learn about "parametric triggers" or "coverage percentages." They want three things:

1. **Stable weekly income** — "I need to make Rs.4,000+ every week no matter what"
2. **No hassle** — "If something goes wrong, just pay me. Don't make me fill forms"
3. **Fair price** — "I'll pay a little if it actually helps, but don't waste my money"

Our entire product is designed around these three needs.

---

## How Does the AI Actually Work?

We are specific about what the AI does because "AI-powered" means nothing if you cannot explain it. Below is exactly what each component does, what data it uses, and how we build it.

### Layer 1: Predict — What will happen this week?

**What it does:** Every Sunday, the system generates a 7-day disruption forecast for each zone in Mumbai. It combines weather forecasts, AQI trends, traffic patterns, and event calendars to estimate how each day will affect rider earnings.

**What data it uses:**
- 7-day weather forecast from OpenWeatherMap API (rainfall, temperature, humidity)
- Current and trending AQI from CPCB/WAQI API
- Traffic congestion data from TomTom Traffic API
- News feed scanning for upcoming bandhs/strikes via NewsAPI

**What the rider sees:**

The rider does not see weather data. They see earnings impact:

- "Monday: Normal day. Work your regular shift."
- "Wednesday 2-8 PM: Heavy rain expected. Your zone will likely be paused."
- "Thursday: Storm continuing. Stay home — your insurance covers today."
- "Friday: Clearing up. High demand expected — good earning day."

**How we build it:** A Python function that pulls forecast data from APIs, maps each trigger to an earnings impact percentage based on historical patterns, and generates a per-day, per-block (morning/afternoon/evening) earnings estimate. This is not a machine learning model — it is a rule-based system using real weather thresholds from IMD data. We are honest about this.

### Layer 2: Optimize — How should I work this week?

**What it does:** Takes the prediction and generates specific shift recommendations that help the rider avoid income loss without needing insurance.

**The logic:**
- If rain is expected Wednesday afternoon → recommend morning shift instead
- If disruption is city-wide and unavoidable → recommend rest, insurance covers it
- If disruption is moderate → recommend extending hours on safe days to compensate

**Example:**

A rider normally works 4 PM to midnight. The AI sees heavy rain forecast for Wednesday 2-8 PM.

Without AI guidance: Rider goes to work at 4 PM, rain hits, dark store pauses, rider earns Rs.200 for the day instead of Rs.820.

With AI guidance: Rider shifts to 7 AM - 1 PM on Wednesday (before rain). Earns Rs.620. Saves Rs.420 compared to their normal schedule — without any insurance claim needed.

**Why this matters for the business:** When riders follow optimization recommendations, 30% of potential insurance claims are prevented. The rider earns more, and the company pays out less. Both sides win.

**How we build it:** A Python function that takes the prediction output, compares it against the rider's usual shift, and generates an alternative schedule that maximizes earnings in safe time blocks. Rule-based optimization, not deep learning.

### Layer 3: Protect — Parametric insurance safety net

**What it does:** When a disruption is unavoidable — city-wide flooding, full-day bandh, severe AQI — the system automatically detects the event, verifies it through multiple sources, and pays the rider's lost income directly to their UPI account. No claim form. No phone call. No approval process.

**What makes it parametric:**

Traditional insurance: Rider files a claim → company investigates → weeks later, maybe gets paid.

Parametric insurance: A measurable threshold is crossed (rainfall > 64.5mm/day, AQI > 200) → system detects it automatically → payout happens within minutes. The trigger is the data, not the rider's word.

**Our 6 triggers and their thresholds (based on real data):**

| Trigger | Threshold | Source | Real Basis |
|---------|-----------|--------|------------|
| Rainfall | >64.5mm/day (IMD "heavy" category) | OpenWeatherMap + IMD | BMC drains handle only 25mm/hr; above this = waterlogging |
| Extreme Heat | >40°C (rare in Mumbai, relevant for Delhi expansion) | OpenWeatherMap | IMD heat wave classification |
| Cold/Fog | Visibility <500m | OpenWeatherMap | IMD fog classification |
| Air Quality | AQI >200 ("Poor" category) | CPCB/WAQI API | CPCB's own "poor" threshold; 17 such days in Dec 2022 alone |
| Traffic | Average speed <10 km/hr for 2+ hours | TomTom Traffic API | Mumbai evening peak already at 16.9 km/hr (TomTom 2025) |
| Social Disruption | Official bandh/curfew declared | NewsAPI + NLP keyword matching | 3-5 bandh calls per year in Mumbai |

**How payout is calculated:**

```
Payout = Zone Impact Score × Hours Lost × Zone Average Hourly Rate × 0.60

Where:
  Zone Impact Score = What percentage of riders in this zone actually stopped working
                      (from our own data — if 85% stopped, score = 0.85)
  Hours Lost        = Duration of the trigger event
  Zone Avg Rate     = Average hourly earnings for this zone tier
  0.60              = Coverage cap (we cover 60% of verified loss)
```

We pay based on **verified zone-wide impact**, not individual claims. This means even if someone games the system, the payout is based on what actually happened in the zone, not what they say happened.

---

## Pricing Model

### Structure: City × Zone Tier × Season

The premium is the same for every rider in the same zone tier in the same week. It changes based on three things: which city, which risk zone, and what time of year.

**Zone Tiers (Mumbai):**

| Tier | Zones | Risk Profile | Why |
|------|-------|-------------|-----|
| Tier 1 (High) | Andheri West, Dadar, Kurla, Sion, Hindmata | Flood-prone, poor drainage | BMC identifies 84 chronic waterlogging hotspots, concentrated in these areas |
| Tier 2 (Medium) | Bandra, Goregaon, Malad, Borivali | Average infrastructure | Some flooding but better drainage than Tier 1 |
| Tier 3 (Low) | Powai, BKC, Thane, Navi Mumbai | Elevated terrain, newer drainage | Rarely floods, good road infrastructure |

**Weekly Premiums:**

| Season | Tier 1 | Tier 2 | Tier 3 |
|--------|--------|--------|--------|
| Jun-Sep (Monsoon) | Rs.86/wk | Rs.70/wk | Rs.52/wk |
| Mar-May (Heat + Pre-monsoon) | Rs.72/wk | Rs.58/wk | Rs.43/wk |
| Oct-Nov (Cyclone + AQI) | Rs.68/wk | Rs.55/wk | Rs.42/wk |
| Dec-Feb (AQI + Fog) | Rs.62/wk | Rs.50/wk | Rs.38/wk |
| **Annual Average** | **Rs.75/wk** | **Rs.60/wk** | **Rs.45/wk** |

**Affordability check:**

| Tier | Annual Premium | As % of Annual Income | Cost per Day |
|------|---------------|----------------------|-------------|
| Tier 1 | Rs.3,900 | 1.67% | Rs.11 (less than a vada pav) |
| Tier 2 | Rs.3,120 | 1.33% | Rs.9 |
| Tier 3 | Rs.2,340 | 1.00% | Rs.6.4 |

**What the rider gets back (average year):**

| Tier | Premium Paid | Claims Received | Return |
|------|-------------|----------------|--------|
| Tier 1 | Rs.3,900 | Rs.2,400 | 62% |
| Tier 2 | Rs.3,120 | Rs.1,900 | 61% |
| Tier 3 | Rs.2,340 | Rs.1,400 | 60% |

In a bad monsoon year (like 2024 with 300mm in 6 hours on July 8), Tier 1 riders receive Rs.4,200+ in claims — more than they paid in premium. The insurance pays for itself.

**How the AI recalculates weekly:**

Every Sunday, the pricing engine runs:
1. Pulls next week's weather forecast
2. Checks current AQI trend
3. Scans news for upcoming events/holidays
4. Looks at last 4 weeks of actual claims per zone
5. Adjusts premium up or down (capped at ±15% from seasonal base)
6. Cap: Premium never exceeds 2% of average zone earnings

This means the price responds to real conditions. If the forecast shows a calm week, the premium dips. If a cyclone warning is issued, it adjusts upward. The rider always sees next week's price before it is charged.

---

## Fraud Detection System

### The core challenge

In a parametric system where payouts are automatic, the biggest risk is fraud — riders claiming income loss when they were not actually working, or coordinated groups gaming the system.

We do not use any hardware-dependent detection (WiFi fingerprinting, cell tower triangulation, accelerometer data). These require a native mobile app and are untestable in a hackathon. Our fraud detection uses only **data we actually have**: platform activity logs, our own claims database, external API data, and registration metadata.

### The 5 Walls

**Wall 1: Platform Activity Verification — "Were you actually working?"**

Before approving any claim, we check the rider's activity on the Zepto platform (via our simulated API):

- When did they log in?
- How many deliveries did they complete before the disruption started?
- Were they continuously active, or did they log in moments before the trigger event?

The rule: A rider must have at least 2 hours of verified deliveries before the disruption event to receive a full payout. Less than 30 minutes of activity or zero deliveries means the claim is denied — the disruption did not cause their income loss because they were not earning income.

This single check eliminates the most common fraud: riders sitting at home, seeing rain on the forecast, logging into the app for 5 minutes, and collecting a payout.

**Wall 2: Multi-Source Trigger Consensus — "Is the event even real?"**

We never trust a single data source. Every trigger event must be confirmed by at least 3 independent sources:

- Source 1: Weather/AQI API (OpenWeatherMap, CPCB)
- Source 2: Platform data (did the dark store actually pause dispatch?)
- Source 3: Zone-wide rider behavior (what percentage of riders stopped working?)
- Source 4: Second weather/AQI source for cross-reference

If only 1 out of 4 sources confirms the event, no payouts are issued. If 3 or more agree, claims are processed. This prevents payouts for minor drizzles or localized conditions that did not actually halt deliveries.

**Wall 3: Peer Comparison — "Did other riders in your zone also stop?"**

When a rider claims they could not work, we compare them against every other rider in the same zone during the same time window.

If 85% of riders at the same dark store stopped working → the event was real, all claims are credible.

If only 1 out of 15 riders stopped and the other 14 continued delivering → that one rider's claim does not match zone reality.

We also use **inverse verification**: instead of asking "did the disruption happen?", we check what riders who continued working actually earned. If they earned 80% of their normal income, the actual zone-wide loss was only 20% — and payouts are adjusted accordingly. This prevents inflated claims.

**Wall 4: Graph Network Analysis — "Are you part of a coordinated fraud ring?"**

Using Python's NetworkX library, we build a relationship graph connecting riders through shared attributes in our database:

- Same phone number or email across multiple accounts
- Same UPI payout ID receiving money from multiple accounts
- Same IP address during registration
- Login timestamps within 60 seconds of each other across 5+ events
- Identical claim patterns (same events claimed, every time)

We run the Louvain community detection algorithm on this graph. It identifies densely connected clusters — groups of accounts that are suspiciously linked. A cluster of 10+ riders who all registered from the same IP, all login at the same time, and all claim on every single event is not a coincidence. It is a fraud ring.

Normal riders appear as isolated nodes with 0-2 connections. Fraud rings appear as dense meshes with dozens of cross-links. The algorithm catches patterns that checking individual riders one by one would miss.

**Wall 5: Temporal Pattern Analysis — "Does your long-term behavior look honest?"**

Over weeks and months, we track each rider's claiming patterns and compare them to their zone's average:

- **Claim frequency**: Zone average is 35% of events. If a rider claims on 95% of events, they are 4+ standard deviations above normal — statistically almost impossible to be genuine.
- **Login-trigger correlation**: If a rider only ever logs in within 15 minutes before a trigger fires and never works at any other time, their login pattern correlates suspiciously with payout opportunities.
- **Day-of-week consistency**: If a rider never works Tuesdays (for 8 weeks straight) but claims income loss on a Tuesday trigger event, the disruption did not cause their absence.
- **Claim amounts**: Honest riders have varying claim amounts (Rs.120, Rs.280, Rs.190). Riders who always claim the maximum possible amount are flagged.

### Protecting honest riders

The system is designed so that honest riders never experience any friction:

- **No single wall triggers denial.** A rider must fail 3+ walls before any action is taken. One anomalous signal is just logged.
- **Bulk-approve first.** When a trigger fires, 80% of riders with clear platform activity and matching zone data are approved instantly (under 30 seconds). Only the 20% with anomalies face deeper checks.
- **Hidden fraud score.** Riders never see their internal trust score (0-100). Clean riders (0-20) get instant payouts. Suspicious riders (60+) experience processing delays. The rider does not know the score exists.
- **Recovery path.** A falsely flagged rider recovers their score within 4 clean weeks. Wrongly denied claims are reversed through support with clear reasons provided.
- **Transparent denial.** If a claim is denied, the rider sees a specific reason ("Our records show you logged in 5 minutes before the event with no deliveries") and a clear path to appeal.

---

## Adversarial Defense & Anti-Spoofing Strategy

### Scenario: 500 riders with fake GPS drain the payout pool

GPS spoofing apps are free and widely available. Any fraud defense that relies on GPS alone is already broken. Our defense does not depend on GPS verification at all.

**How our system handles the 500-rider attack:**

**T+0 sec:** Rain trigger fires in Andheri West. 500 claims received.

**T+2 sec:** Wall 2 checks — is the event real? Weather API confirms heavy rain. Dark store confirms dispatch paused. 87% of zone riders stopped working. Event is confirmed genuine.

**T+3 sec:** Wall 1 checks platform activity for all 500 claimants:
- 180 riders had 3+ hours of completed deliveries before the event → **auto-approved instantly**
- 47 riders had 1-2 hours of activity → **approved with proportional payout**
- 273 riders had zero deliveries or logged in within minutes of the event → **held for deeper checks**

**T+10 sec:** Wall 4 runs graph analysis on the 273 held riders:
- 48 accounts registered from the same IP address
- 92 accounts login within the same 3-minute window across 10+ past events
- 37 accounts share the same UPI payout ID
- Louvain algorithm detects 4 distinct fraud clusters
- **All 261 ring members frozen**

**T+15 sec:** Wall 5 checks remaining 12 edge cases (new riders, ambiguous data):
- Held for 24-hour manual review with benefit of doubt

**Result:**
- 227 genuine riders: Paid (180 instantly, 47 within minutes)
- 261 fraud ring members: Blocked
- 12 edge cases: Reviewed within 24 hours
- Money lost to fraud: Rs.0
- Honest riders denied: 0
- Time to neutralize: Under 30 seconds

**Why GPS spoofing is irrelevant to our system:**

We do not verify WHERE the rider was. We verify WHETHER they were working. A GPS spoofing app can fake your coordinates. It cannot generate 6 hours of completed Zepto deliveries with real order IDs, timestamps, and delivery confirmations. The platform activity log — not GPS — is our source of truth.

The best anti-fraud system does not just catch fraud. It makes fraud harder than honest work. If gaming our system requires actually showing up to the dark store and completing real deliveries for 2+ hours first, at that point it is easier to just be an honest rider.

---

## Business Viability

### Revenue and costs for 1,000 riders in Mumbai

**Revenue:**
| Segment | Riders | Avg Weekly Premium | Annual Revenue |
|---------|--------|-------------------|---------------|
| Tier 1 (High Risk) | 350 | Rs.75 | Rs.13,65,000 |
| Tier 2 (Medium Risk) | 400 | Rs.60 | Rs.12,48,000 |
| Tier 3 (Low Risk) | 250 | Rs.45 | Rs.5,85,000 |
| **Total** | **1,000** | | **Rs.31,98,000** |

**Payouts (after Optimize layer prevention + fraud detection):**
| Segment | Riders | Annual Claims | Total |
|---------|--------|--------------|-------|
| Tier 1 | 350 | Rs.2,400/rider | Rs.8,40,000 |
| Tier 2 | 400 | Rs.1,900/rider | Rs.7,60,000 |
| Tier 3 | 250 | Rs.1,400/rider | Rs.3,50,000 |
| **Total** | | | **Rs.19,50,000** |

**P&L:**
| Metric | Value |
|--------|-------|
| Annual Revenue | Rs.31,98,000 |
| Annual Payouts | Rs.19,50,000 |
| Gross Profit | Rs.12,48,000 |
| Loss Ratio | 61.0% |
| Operating Costs (APIs, hosting, support) | Rs.3,50,000 |
| **Net Profit** | **Rs.8,98,000** |
| **Net Margin** | **28.1%** |

The loss ratio of 61% is within the insurance industry standard of 60-75%, confirming the model is viable. The Optimize layer (preventing 30% of claims through AI guidance) and fraud detection (reducing payouts by 15%) are what make the margins work.

### Data sources for all financial calculations

- Rider earnings: Zepto job postings, Inc42, Economic Times, Fairwork India 2023-24
- Rainfall events: IMD Santacruz Observatory (2,502mm annual, 40 significant rain days)
- Flooding: BMC (84 chronic hotspots, drains handle only 25mm/hr)
- AQI: CPCB data via Newslaundry analysis (17 "poor" days in Dec 2022)
- Traffic: TomTom Traffic Index 2025 (Mumbai 3rd most congested globally, 28m51s per 10km)
- Bandh frequency: SATP database, news reports (3-5 per year)

---

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Backend** | Python FastAPI | AI/ML and backend in same language; auto-generates API docs |
| **Frontend** | React + Tailwind CSS | Component-based, mobile-first, fast to build |
| **Database** | PostgreSQL | Relational, ACID compliant, handles complex queries |
| **Cache** | Redis | Sub-millisecond reads for live trigger data |
| **AI/ML** | scikit-learn, NetworkX, Pandas | Pricing model, fraud graph analysis, statistical analysis |
| **Weather API** | OpenWeatherMap (free tier) | Rainfall, temperature, visibility — 1000 calls/day free |
| **AQI API** | WAQI.info / aqicn.org (free) | Real-time AQI for Indian cities |
| **Traffic API** | TomTom Traffic (free tier) | Congestion and flow speed data |
| **News API** | NewsAPI.org (free tier) | Bandh/strike detection via keyword matching |
| **Platform API** | Mock API (self-built) | Simulates Zepto's rider activity and dark store data |
| **Payments** | Razorpay Test Mode | Simulates UPI payouts — Indian, free, realistic for demos |
| **Deployment** | Vercel (frontend) + Railway (backend) | Free tiers, sufficient for hackathon |
| **Maps** | React Leaflet + OpenStreetMap | Zone visualization, risk heat maps — free |
| **Charts** | Recharts | Dashboard analytics and loss ratio charts |
| **Graph Analysis** | NetworkX (Python) | Fraud ring detection via Louvain community detection |

---

## Development Plan

### Phase 1 (Mar 4-20): Ideation & Foundation — CURRENT
- [x] Problem research and persona analysis
- [x] Pricing model with real sourced data
- [x] Fraud detection architecture (5 walls)
- [x] AI strategy (Predict → Optimize → Protect)
- [x] Tech stack selection
- [x] Adversarial defense strategy (Market Crash response)
- [x] README and idea documentation
- [ ] 2-minute strategy video
- [ ] Minimal prototype

### Phase 2 (Mar 21 - Apr 4): Automation & Protection
- [ ] Rider registration and onboarding flow
- [ ] Policy management (subscribe, view, renew)
- [ ] Dynamic premium calculation engine
- [ ] Trigger monitoring service (polling weather/AQI/traffic APIs)
- [ ] Automatic claim initiation when thresholds crossed
- [ ] Predict engine — weekly forecast generation
- [ ] Optimize engine — shift recommendations
- [ ] Basic rider dashboard

### Phase 3 (Apr 5-17): Scale & Optimise
- [ ] Fraud detection walls 1-5 implementation
- [ ] Graph network analysis with NetworkX
- [ ] Instant payout simulation (Razorpay test mode)
- [ ] Admin dashboard (risk heat map, loss ratios, fraud stats)
- [ ] Rider dashboard (weekly plan, active protections, payout history)
- [ ] Multi-city expansion (Delhi, Bangalore rate cards)
- [ ] 5-minute demo video
- [ ] Final pitch deck

---

## How the Demo Will Work

1. **Introduce Ravi** — a Zepto rider at Dark Store #47, Andheri West. Show his profile, zone tier, and this week's premium (Rs.86).

2. **Show his weekly plan** — AI predicts Wednesday afternoon rain. Recommends morning shift instead. Ravi follows the suggestion and earns Rs.620 instead of Rs.200.

3. **Simulate Thursday's storm** — city-wide flooding. No optimization can help. Trigger fires: rainfall >64.5mm confirmed by OpenWeather + IMD + dark store dispatch paused + 87% of zone riders stopped.

4. **Show the auto-payout** — Rs.380 hits Ravi's UPI in under 2 minutes. No forms, no calls. Dashboard updates: "You're protected."

5. **Show a fraud attempt** — a rider logged in 5 minutes before the rain with zero deliveries. Wall 1 catches it. Then show the graph analysis catching a fraud ring of 48 accounts sharing the same registration IP.

6. **Show the week summary** — Without GigShield: Ravi earns Rs.3,200 (bad week). With GigShield: Rs.5,060 (AI saved Rs.1,480 through optimization, insurance covered Rs.380). Ravi's worst week is 97% of his best week.

7. **Admin dashboard** — Zone risk heat map. Claims processed vs denied. Fraud detection stats. Loss ratio trending at 61%.

---

## Team

[Team details to be added]

---

## Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── api/routes/          # API endpoints
│   │   ├── core/                # Config, auth, database setup
│   │   ├── models/              # SQLAlchemy database models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── triggers/        # Weather, AQI, traffic, social monitoring
│   │   │   ├── fraud/           # 5-wall fraud detection engine
│   │   │   ├── pricing/         # Dynamic premium calculation
│   │   │   ├── prediction/      # Layer 1: Predict engine
│   │   │   └── optimizer/       # Layer 2: Optimize engine
│   │   └── utils/
│   ├── ml/                      # ML models and training scripts
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── rider/           # Rider-facing components
│   │   │   ├── admin/           # Admin dashboard components
│   │   │   └── common/          # Shared components
│   │   ├── pages/               # Route pages
│   │   ├── services/            # API client functions
│   │   └── utils/
│   └── public/
├── docs/                        # Additional documentation
├── ADVERSARIAL_DEFENSE.md       # Market Crash: Anti-spoofing strategy
└── README.md                    # This file
```
