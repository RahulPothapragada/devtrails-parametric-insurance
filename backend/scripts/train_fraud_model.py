"""
FlowSecure — XGBoost Fraud Detection Pipeline
==============================================
Extracts behavioral features from rider activity, claims, and network data,
trains an XGBoost classifier, evaluates it, then writes real fraud_score
(0–100) and is_suspicious back to every rider in the DB.

Run:
    cd backend
    python scripts/train_fraud_model.py
"""

import os, sys, json, pickle, warnings
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

warnings.filterwarnings("ignore")

# ── DB connection (sync psycopg2 URL from asyncpg URL) ──────────────────────
ASYNC_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:3Ry6kUWgJ4f%2AT6f@db.pcapoafijrtlxlachxft.supabase.co:5432/postgres"
)
SYNC_URL = ASYNC_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")

print("Connecting to database…")
engine = create_engine(SYNC_URL, pool_pre_ping=True)

# ── 1. Load raw data ─────────────────────────────────────────────────────────
print("Loading riders…")
riders_df = pd.read_sql("""
    SELECT
        r.id,
        r.is_suspicious,
        r.device_fingerprint,
        r.upi_id,
        r.active_days_last_30,
        r.avg_weekly_earnings,
        r.avg_hourly_rate,
        r.shield_level
    FROM riders r
""", engine)

print(f"  {len(riders_df):,} riders loaded")
print(f"  Suspicious: {riders_df['is_suspicious'].sum():,} | Clean: {(~riders_df['is_suspicious']).sum():,}")

print("Loading activity sessions…")
activity_df = pd.read_sql("""
    SELECT
        rider_id,
        hours_active,
        deliveries_completed,
        earnings,
        gps_points
    FROM rider_activities
""", engine)
print(f"  {len(activity_df):,} activity sessions loaded")

print("Loading claims…")
claims_df = pd.read_sql("""
    SELECT
        rider_id,
        status,
        payout_amount
    FROM claims
""", engine)
print(f"  {len(claims_df):,} claims loaded")

# ── 2. GPS Feature Engineering ───────────────────────────────────────────────
print("\nEngineering GPS features…")

def gps_features(gps_json):
    """Compute variance features from a single session's GPS points."""
    if not gps_json:
        return 0.0, 0.0, 0.0, 0
    try:
        pts = gps_json if isinstance(gps_json, list) else json.loads(gps_json)
        if len(pts) < 2:
            return 0.0, 0.0, 0.0, len(pts)
        lats = [p["lat"] for p in pts]
        lngs = [p["lng"] for p in pts]
        lat_std = float(np.std(lats))
        lng_std = float(np.std(lngs))
        # Max displacement from centroid (degrees → approx metres: 1° ≈ 111km)
        clat, clng = np.mean(lats), np.mean(lngs)
        max_disp = max(
            ((p["lat"] - clat)**2 + (p["lng"] - clng)**2)**0.5 for p in pts
        ) * 111000
        return lat_std, lng_std, max_disp, len(pts)
    except Exception:
        return 0.0, 0.0, 0.0, 0

gps_feats = activity_df["gps_points"].apply(
    lambda g: pd.Series(gps_features(g), index=["lat_std", "lng_std", "max_disp_m", "n_pts"])
)
activity_df = pd.concat([activity_df.drop(columns=["gps_points"]), gps_feats], axis=1)

# ── 3. Aggregate activity per rider ─────────────────────────────────────────
print("Aggregating activity per rider…")
act_agg = activity_df.groupby("rider_id").agg(
    total_sessions       = ("hours_active",          "count"),
    avg_hours_per_day    = ("hours_active",           "mean"),
    avg_deliveries       = ("deliveries_completed",   "mean"),
    avg_earnings_session = ("earnings",               "mean"),
    # GPS — key fraud signals
    gps_lat_std_mean     = ("lat_std",                "mean"),   # near-zero = spoofing
    gps_lng_std_mean     = ("lng_std",                "mean"),
    gps_max_disp_mean    = ("max_disp_m",             "mean"),   # near-zero = never moved
    gps_lat_std_min      = ("lat_std",                "min"),    # worst session
    gps_max_disp_min     = ("max_disp_m",             "min"),
).reset_index()

# deliveries per hour (efficiency — anomalous if too high or zero)
act_agg["deliveries_per_hour"] = (
    act_agg["avg_deliveries"] / act_agg["avg_hours_per_day"].clip(lower=0.1)
)

# ── 4. Aggregate claims per rider ────────────────────────────────────────────
print("Aggregating claims per rider…")
claims_agg = claims_df.groupby("rider_id").agg(
    total_claims   = ("status", "count"),
    total_payout   = ("payout_amount", "sum"),
    denial_count   = ("status", lambda x: (x == "denied").sum()),
    approval_count = ("status", lambda x: x.isin(["auto_approved", "approved", "paid"]).sum()),
).reset_index()
claims_agg["claim_denial_rate"]    = claims_agg["denial_count"] / claims_agg["total_claims"].clip(1)
claims_agg["claims_per_active_day"] = claims_agg["total_claims"] / riders_df.set_index("id")["active_days_last_30"].reindex(claims_agg["rider_id"].values).values.clip(1)

# ── 5. Network features (shared device / UPI = ring fraud) ──────────────────
print("Computing network (ring) features…")
device_counts = riders_df.groupby("device_fingerprint")["id"].count().rename("device_sharing_count")
upi_counts    = riders_df.groupby("upi_id")["id"].count().rename("upi_sharing_count")

riders_df = riders_df.join(device_counts, on="device_fingerprint")
riders_df = riders_df.join(upi_counts,    on="upi_id")
riders_df["device_sharing_count"] = riders_df["device_sharing_count"].fillna(1)
riders_df["upi_sharing_count"]    = riders_df["upi_sharing_count"].fillna(1)

# ── 6. Merge all features ────────────────────────────────────────────────────
print("Merging feature sets…")
df = riders_df.merge(act_agg,    left_on="id", right_on="rider_id", how="left").drop(columns=["rider_id"], errors="ignore")
df = df.merge(claims_agg, left_on="id", right_on="rider_id", how="left").drop(columns=["rider_id"], errors="ignore")
df = df.fillna(0)

FEATURES = [
    # GPS (most important for spoofing detection)
    "gps_lat_std_mean", "gps_lng_std_mean",
    "gps_max_disp_mean", "gps_lat_std_min", "gps_max_disp_min",
    # Activity patterns
    "total_sessions", "avg_hours_per_day", "avg_deliveries",
    "deliveries_per_hour", "avg_earnings_session",
    # Claims
    "total_claims", "claim_denial_rate", "claims_per_active_day", "total_payout",
    # Network / ring fraud
    "device_sharing_count", "upi_sharing_count",
    # Rider profile
    "active_days_last_30", "avg_weekly_earnings", "shield_level",
]

X = df[FEATURES].values
y = df["is_suspicious"].astype(int).values

print(f"\nFeature matrix: {X.shape[0]:,} riders × {X.shape[1]} features")
print(f"Label balance  : {y.sum():,} fraud ({y.mean()*100:.1f}%) | {(~y.astype(bool)).sum():,} clean")

# ── 7. Train XGBoost ─────────────────────────────────────────────────────────
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, roc_auc_score, confusion_matrix
)

print("\nTraining XGBoost classifier…")
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)

scale_pos_weight = (y == 0).sum() / max((y == 1).sum(), 1)

model = XGBClassifier(
    n_estimators       = 300,
    max_depth          = 6,
    learning_rate      = 0.05,
    subsample          = 0.8,
    colsample_bytree   = 0.8,
    scale_pos_weight   = scale_pos_weight,
    use_label_encoder  = False,
    eval_metric        = "logloss",
    random_state       = 42,
    n_jobs             = -1,
)

model.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=False,
)

# ── 8. Evaluate ──────────────────────────────────────────────────────────────
y_pred  = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

print("\n── Model Performance ──────────────────────────────────")
print(classification_report(y_test, y_pred, target_names=["Clean", "Fraud"]))
print(f"ROC-AUC : {roc_auc_score(y_test, y_proba):.4f}")

cm = confusion_matrix(y_test, y_pred)
print(f"Confusion matrix:\n  TN={cm[0,0]}  FP={cm[0,1]}\n  FN={cm[1,0]}  TP={cm[1,1]}")

# ── Feature importance ───────────────────────────────────────────────────────
print("\n── Top Features by Importance ─────────────────────────")
importances = pd.Series(model.feature_importances_, index=FEATURES).sort_values(ascending=False)
for feat, imp in importances.head(10).items():
    bar = "█" * int(imp * 200)
    print(f"  {feat:<30} {bar} {imp:.4f}")

# ── 9. Score ALL riders & write to DB ───────────────────────────────────────
print("\nScoring all riders…")
all_proba = model.predict_proba(X)[:, 1]

# Scale to 0–100, round to 1 dp
fraud_scores = np.round(all_proba * 100, 1)
is_suspicious = (all_proba >= 0.50).astype(bool)

df["fraud_score"]   = fraud_scores
df["is_suspicious"] = is_suspicious

print(f"  Score distribution: min={fraud_scores.min():.1f}  mean={fraud_scores.mean():.1f}  max={fraud_scores.max():.1f}")
print(f"  Flagged as suspicious: {is_suspicious.sum():,} riders")

print("Writing scores to database…")
with engine.begin() as conn:
    for _, row in df[["id", "fraud_score", "is_suspicious"]].iterrows():
        conn.execute(
            text("UPDATE riders SET fraud_score = :fs, is_suspicious = :sus WHERE id = :rid"),
            {"fs": float(row["fraud_score"]), "sus": bool(row["is_suspicious"]), "rid": int(row["id"])}
        )

print("  ✓ fraud_score and is_suspicious updated for all riders")

# ── 10. Save model ───────────────────────────────────────────────────────────
model_path = os.path.join(os.path.dirname(__file__), "..", "fraud_model.pkl")
with open(model_path, "wb") as f:
    pickle.dump({"model": model, "features": FEATURES}, f)

print(f"\n✓ Model saved to {os.path.abspath(model_path)}")
print("─" * 55)
print("Done. Restart the backend server to serve updated scores.")
