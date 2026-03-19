# Adversarial Defense & Anti-Spoofing Strategy

## The Scenario

> 500 delivery partners. Fake GPS. Real payouts. A coordinated fraud ring drains a platform's liquidity pool.

GPS verification is dead. A free app from the Play Store defeats it. This document describes our defense architecture using **only data we actually have access to** — platform activity logs, weather APIs, zone-level statistics, and claim metadata.

---

## The Attack: How a Fraud Ring Actually Works

```
Step 1: Ring leader creates WhatsApp group of 200+ riders
Step 2: Monitors weather: "Heavy rain in Andheri West at 3 PM"
Step 3: Messages group: "GO — log into Zepto NOW"
Step 4: 200 riders open app, appear "online" in affected zone
Step 5: Parametric trigger fires → 200 auto-claims → Rs.56,000 drained
Step 6: Repeat every event → Rs.22 lakh drained over one monsoon
```

---

## Our Defense: 5 Walls (All Implementable, All Testable)

Every wall uses only data that exists in our database, our mock platform API, or public APIs we already integrate with. No fancy hardware. No native app features. Pure logic.

---

### WALL 1: Platform Activity Verification

**Data source:** Mock Zepto API (simulated rider activity logs)

**The principle:** You cannot claim LOST income if you had NO income to lose. We verify the rider was actively delivering BEFORE the disruption started.

```
WHAT WE CHECK:
  → When did the rider log in?
  → How many deliveries did they complete before the event?
  → How many hours were they actively working?
  → Was there continuous activity, or just a login with no orders?

GENUINE RIDER:
  Login: 9:00 AM
  Deliveries before event: 14 orders (9 AM to 2:50 PM)
  Last delivery: 2:58 PM
  Event starts: 3:05 PM
  Active hours before event: 6 hours
  → PAYOUT: Based on remaining shift hours lost ✅

FRAUD RIDER:
  Login: 2:55 PM (10 minutes before rain)
  Deliveries before event: 0
  Active hours before event: 0
  → PAYOUT: Rs.0 — "No verified work activity before disruption" ❌

THE RULE:
  Minimum 2 hours of verified platform activity before the
  trigger event is required for a full payout.

  < 2 hours activity: Payout proportionally reduced
  < 30 minutes activity: Claim denied
  0 deliveries: Claim denied regardless of login time
```

**Why this works:** A GPS spoofing app can fake your location. It CANNOT generate 6 hours of completed Zepto deliveries with real order IDs, timestamps, and delivery confirmations. The platform activity log is the single strongest anti-fraud signal we have.

**How we implement it:** Our mock Zepto API returns rider activity data. Before approving any claim, we query this API and calculate active hours + delivery count. This is a simple API call + math. Fully testable.

---

### WALL 2: Multi-Source Trigger Consensus

**Data source:** Weather API + AQI API + Mock Platform API + Zone rider statistics

**The principle:** We never trust a single data source. The disruption must be confirmed by 3+ independent sources before ANY payout is authorized.

```
WHAT WE CHECK (for every trigger event):

  Source 1: Weather/AQI/Traffic API
    → Does the external data confirm the disruption?
    → Rainfall > threshold? AQI > threshold? etc.

  Source 2: Mock Platform Data
    → Did the dark store actually pause dispatch?
    → Did order volume drop significantly?

  Source 3: Zone-Wide Rider Behavior
    → What % of riders in this zone stopped working?
    → If 85% stopped → event is real
    → If 10% stopped → event is questionable

  Source 4: Second Weather/AQI Source (cross-reference)
    → Does a second API agree with the first?

SCORING:
  4/4 sources agree: Event CONFIRMED → process all claims
  3/4 sources agree: Event LIKELY → process with standard checks
  2/4 sources agree: Event UNCERTAIN → hold claims for review
  1/4 sources agree: Event NOT CONFIRMED → deny all claims
```

**Example that catches fake claims:**

```
Claim: "Heavy rain stopped my deliveries in Powai"

  Source 1: OpenWeather API → Powai: 8mm rain (light drizzle) ⚠️
  Source 2: Platform data → Dark Store #22 order volume: normal ❌
  Source 3: Zone riders → 1 out of 15 stopped (just this rider) ❌
  Source 4: IMD data → No warning for Powai ❌

  Consensus: 0/4 → EVENT NOT CONFIRMED → Claim denied ❌
```

**How we implement it:** We already call Weather API and AQI API. Add a check against our mock platform API (dark store status) and a simple SQL query counting active vs inactive riders in the zone. Compare. Fully testable.

---

### WALL 3: Peer Comparison — The Crowd Oracle

**Data source:** Our own database (rider activity + claims history)

**The principle:** If a disruption is real, it affects MOST riders in a zone. If only a FEW riders claim while everyone else works normally, those few are suspicious.

```
HOW IT WORKS:

  Trigger event fires in Zone A.
  We immediately check:

  Total active riders in Zone A at event time: 15
  Riders who stopped working after event: 13 (87%)

  → ZONE IMPACT SCORE: 0.87 (high impact, event is real)
  → Auto-approve claims from this zone ✅

  ────────────────────────────────────

  Different scenario:

  Total active riders in Zone A: 15
  Riders who stopped working: 2 (13%)

  → ZONE IMPACT SCORE: 0.13 (low impact)
  → "Weather says rain but 87% of riders are working fine?"
  → Those 2 claims get extra scrutiny ⚠️
```

**The Inverse Verification (our strongest technique):**

Instead of asking "did the disruption happen?", we ask "how much did riders who KEPT working actually earn?"

```
  Trigger: Heavy rain in Andheri, 3-7 PM

  Riders who continued working earned:
    → Average Rs.320 in those 4 hours (normal is Rs.400)
    → ACTUAL income loss in this zone: 20%

  Claimant says: "I lost 100% of my income for 4 hours"
  Reality: Zone-wide actual loss was only 20%

  PAYOUT ADJUSTMENT:
    → We pay based on VERIFIED zone-wide loss percentage
    → Not based on what the individual claims
    → Payout: 20% of normal earnings, not 100%

  This means even if a faker gets through Walls 1 and 2,
  they get a payout based on REAL zone impact — not their
  inflated claim.
```

**How we implement it:** Pure SQL queries on our claims and rider activity tables. Count active riders, count who stopped, calculate zone impact score. Compare claimant against peers. Fully testable with mock data.

---

### WALL 4: Graph Network Analysis — Finding Fraud Rings

**Data source:** Our own database (registration data + claim patterns + login timestamps)

**The principle:** Individual fakers might slip through. But coordinated fraud rings leave mathematical fingerprints in the DATA we already collect — no hardware needed.

```
CONNECTIONS WE CAN ACTUALLY DETECT (from our database):

  → Same phone number registered on multiple accounts
  → Same email address across accounts
  → Same UPI ID receiving payouts across accounts
  → Same IP address during registration
  → Login timestamps within 60 seconds of each other
    (across multiple events — once is coincidence, 10 times is coordination)
  → Identical claim patterns: same events, same amounts, every time
  → Accounts created within minutes of each other
    (bulk registration pattern)
```

**How we detect rings:**

```
STEP 1: Build a relationship graph

  For every rider pair, check:
    shared_phone?        → Edge weight: 1.0 (definite link)
    shared_email?        → Edge weight: 1.0
    shared_UPI?          → Edge weight: 0.9
    shared_IP?           → Edge weight: 0.5
    synced_logins > 5x?  → Edge weight: 0.7
    identical_claims?    → Edge weight: 0.8

STEP 2: Run community detection (Louvain algorithm — NetworkX library)

  Input: Graph of riders connected by shared attributes
  Output: Clusters of suspiciously connected riders

STEP 3: Score each cluster

  Cluster density > 0.6 AND members > 10 = FRAUD RING

  Example output:
    Cluster A: 48 riders, density 0.82
      → 12 share same IP at registration
      → 8 share same UPI payout ID
      → All 48 login within 3-minute windows before events
      → All 48 claim on 95% of events
      → FRAUD RING CONFIRMED ❌ → Freeze all 48 accounts

    Cluster B: 3 riders, density 0.4
      → Roommates who share WiFi (same IP)
      → Different UPI IDs, different claim patterns
      → NOT a fraud ring. Just neighbors. ✅
```

**How we implement it:** Python NetworkX library. Build graph from our PostgreSQL data. Run `community_louvain` algorithm. Calculate cluster density. Flag clusters above threshold. This is maybe 50 lines of Python. Fully testable, and the graph visualization is visually impressive for demos.

---

### WALL 5: Temporal Pattern Analysis — Catching Clever Individuals Over Time

**Data source:** Our own database (claim history over weeks/months)

**The principle:** A careful faker might beat Walls 1-4 once. But over time, their PATTERNS betray them. Honest riders have natural variation. Fakers are suspiciously consistent.

```
CHECK 1: Claim Frequency vs Zone Average

  Zone average: Riders claim on 35% of trigger events
  Normal range: 15% to 55% (2 standard deviations)

  Rider A: Claims on 30% of events → NORMAL ✅
  Rider B: Claims on 50% of events → HIGH but within range ✅
  Rider C: Claims on 95% of events → 4+ standard deviations above mean
           → Probability of being genuine: < 0.1% → FLAG ⚠️


CHECK 2: Login-Trigger Time Correlation

  For each rider, calculate:
    How often does their login time fall within 15 minutes
    BEFORE a trigger event?

  Honest rider:
    → Logs in at 9 AM daily (consistent schedule)
    → Sometimes trigger happens during shift (coincidence)
    → Correlation score: 0.12 (low, natural)

  Gaming rider:
    → Monday: logged in 2:45 PM (rain at 3:00 PM)
    → Wednesday: logged in 11:50 AM (AQI hit 400 at noon)
    → Friday: logged in 4:40 PM (bandh at 5 PM)
    → Correlation score: 0.87 (high, suspicious)
    → This rider ONLY appears when there's money to collect → FLAG ⚠️


CHECK 3: Day-of-Week Consistency

  Rider X's normal pattern:
    → Never works Tuesdays (consistent for 8 weeks)

  Tuesday trigger event occurs:
    → Rider X claims income loss for Tuesday
    → "But you haven't worked a Tuesday in 2 months.
        The disruption didn't cause your absence."
    → CLAIM DENIED ❌


CHECK 4: Claim Amount Patterns

  Honest riders: Claim amounts vary naturally
    → Rs.120, Rs.280, Rs.190, Rs.310, Rs.85

  Fraud riders: Claim amounts are suspiciously uniform
    → Rs.280, Rs.280, Rs.275, Rs.280, Rs.280
    → Always claiming maximum possible amount
    → FLAG ⚠️
```

**How we implement it:** Pure SQL + Python statistics on our claims table. Calculate mean, standard deviation per zone. Flag outliers. Calculate correlation between login times and trigger times using Pandas. No special infrastructure needed. Fully testable.

---

## How All 5 Walls Work Together

```
               TRIGGER EVENT FIRES
                      │
                      ▼
           ┌─────────────────────┐
           │  WALL 2: IS EVENT   │
           │  REAL? (3+ sources) │
           └──────────┬──────────┘
              YES     │     NO → Deny all claims
                      ▼
           ┌─────────────────────┐
           │  WALL 1: WAS RIDER  │
           │  ACTUALLY WORKING?  │
           │  (Platform logs)    │
           └──────────┬──────────┘
              YES     │     NO → Deny (no work = no loss)
           (2+ hrs)   │
                      ▼
           ┌─────────────────────┐
           │  WALL 3: DOES ZONE  │
           │  DATA SUPPORT IT?   │
           │  (Peer comparison)  │
           └──────────┬──────────┘
             Zone     │     Zone impact low
             impact   │     → Reduce payout to
             high     │       actual zone loss %
                      ▼
           ┌─────────────────────┐
           │  WALL 4: PART OF    │
           │  A FRAUD RING?      │
           │  (Graph analysis)   │
           └──────────┬──────────┘
              NO      │     YES → Freeze all ring accounts
                      ▼
           ┌─────────────────────┐
           │  WALL 5: LONG-TERM  │
           │  PATTERN OK?        │
           │  (Claim frequency,  │
           │   login correlation)│
           └──────────┬──────────┘
              OK      │     SUSPICIOUS → Hold for review
                      ▼
                 ✅ APPROVE
                 INSTANT PAYOUT
```

---

## Protecting Honest Riders (No False Punishments)

### Rule 1: No single wall triggers denial

```
  1 wall flags something: LOG ONLY. Payout proceeds. ✅
  2 walls flag something: MINOR FLAG. Payout proceeds. ✅
  3+ walls flag something: HOLD for verification. ⚠️
```

### Rule 2: Bulk-approve first, investigate anomalies second

```
  When a trigger fires:
    → 80% of riders have clear platform activity + zone peers confirm
    → INSTANT PAYOUT for these riders. Zero friction. ✅
    → Only the 20% with anomalies face deeper checks
```

### Rule 3: Hidden fraud score (rider never sees it)

```
  0-20 (Trusted):   Instant payout (< 30 seconds)
  21-40 (Normal):   Standard payout (< 5 minutes)
  41-60 (Watch):    Extra checks (< 30 minutes)
  61-80 (Review):   Held for review (< 24 hours)
  81-100 (Blocked): Frozen, investigation triggered

  Clean riders always experience instant payouts.
  They never know this score exists.
```

### Rule 4: Recovery path for falsely flagged riders

```
  Flagged rider → 4 clean weeks → Score drops back to normal
  Wrongly denied → Support review → Override + payout + score reset
  System ALWAYS errs toward paying the rider.
```

### Rule 5: Transparent denial with appeal path

```
  Denied claim shows:
    "Your claim could not be verified because our records show
     your shift started 5 minutes before the event with no
     deliveries completed. If you believe this is incorrect,
     contact support with your Zepto delivery history."

  Rider knows WHY. Rider knows HOW to appeal.
```

---

## The 500-Rider Attack: How Our System Responds

```
T+0 sec:  Rain trigger fires in Andheri West
          500 claims received

T+2 sec:  WALL 2 — Event confirmed (weather + platform + peers agree)

T+3 sec:  WALL 1 — Platform activity check:
          → 180 riders had 3+ hours of real deliveries
          → AUTO-APPROVED INSTANTLY ✅

T+5 sec:  WALL 1 continued:
          → 47 riders had 1-2 hours of activity
          → APPROVED with proportional payout ✅

          → 273 riders had < 30 min activity or zero deliveries
          → HELD for deeper checks ⚠️

T+8 sec:  WALL 3 — Peer comparison on held riders:
          → Zone impact score: 0.85 (real event)
          → But 273 riders with zero activity? Not matching.

T+10 sec: WALL 4 — Graph analysis on 273 held riders:
          → 48 registered from same IP address
          → 92 login within same 3-minute window across 10+ events
          → 37 share same UPI payout ID
          → 4 fraud clusters detected
          → ALL 261 ring members FROZEN ❌

T+15 sec: WALL 5 — Remaining 12 edge cases:
          → New riders, ambiguous patterns
          → Held for 24-hour review (benefit of doubt)

RESULT:
  227 genuine riders: PAID (180 instantly + 47 fast) ✅
  261 fraud ring members: BLOCKED ❌
  12 edge cases: REVIEWED within 24 hours ⚠️
  Money lost to fraud: Rs.0
  Honest riders impacted: 0 denied, 12 delayed
```

---

## What Makes This Implementable (Not Fantasy)

| Wall | Data Required | Source | Implementation |
|------|--------------|--------|----------------|
| Wall 1: Activity | Rider login time, delivery count, timestamps | Mock Zepto API | API call + time comparison |
| Wall 2: Consensus | Weather, AQI, platform status, rider stats | External APIs + our DB | 3-4 API calls + comparison |
| Wall 3: Peer Compare | Active riders in zone, who stopped, who didn't | Our PostgreSQL DB | SQL GROUP BY + percentage |
| Wall 4: Graph | Registration IP, UPI ID, login timestamps | Our PostgreSQL DB | NetworkX graph + Louvain (Python) |
| Wall 5: Temporal | Claim history, login history per rider | Our PostgreSQL DB | Pandas statistics + correlation |

**Every wall is a database query or API call. No hardware. No native app. No fantasy tech. Fully buildable in Python + PostgreSQL + NetworkX.**
