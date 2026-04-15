"""
Dynamic Pricing Engine — City + Issue + Season + Zone Tier based.

Calculates weekly premiums using:
  Premium = Sum(Issue_Risk x Expected_Payout) x Margin x Zone_Factor

Rate cards are pre-computed and stored in DB.
Updated weekly every Sunday based on forecast data.
"""

from typing import Optional
import logging

from app.services.ml_models import ml

logger = logging.getLogger(__name__)


# ── Historical Risk Data (IMD, CPCB, TomTom — 10-year baseline 2014–2024) ──
# _CITY_BASE_PROBS: city-level weekly probability of threshold breach in that month.
# Zone-tier adjustments applied via _ZONE_MULT (trigger-specific, physically grounded).
# Rainfall/heat/social are city-wide events → uniform across zone tiers.
# AQI and traffic vary meaningfully by zone density → stronger gradient.
# Cold fog varies marginally (low-lying vs. elevated areas).

_CITY_BASE_PROBS = {
    # ── MUMBAI — Monsoon flooding Jun-Sep, year-round traffic, mild winter AQI ──
    "mumbai": {
        1: {
            "rainfall":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.05, "medium": 0.03, "low": 0.01},
            "aqi":       {"high": 0.35, "medium": 0.25, "low": 0.15},
            "traffic":   {"high": 0.25, "medium": 0.20, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        2: {
            "rainfall":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "aqi":       {"high": 0.20, "medium": 0.15, "low": 0.08},
            "traffic":   {"high": 0.18, "medium": 0.15, "low": 0.10},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        3: {
            "rainfall":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "heat":      {"high": 0.15, "medium": 0.10, "low": 0.05},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.12, "medium": 0.08, "low": 0.05},
            "traffic":   {"high": 0.18, "medium": 0.15, "low": 0.10},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        4: {
            "rainfall":  {"high": 0.03, "medium": 0.02, "low": 0.01},
            "heat":      {"high": 0.30, "medium": 0.22, "low": 0.12},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.08, "medium": 0.05, "low": 0.03},
            "traffic":   {"high": 0.22, "medium": 0.18, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        5: {
            "rainfall":  {"high": 0.08, "medium": 0.05, "low": 0.02},
            "heat":      {"high": 0.35, "medium": 0.25, "low": 0.15},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.05, "medium": 0.03, "low": 0.02},
            "traffic":   {"high": 0.22, "medium": 0.18, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        6: {
            "rainfall":  {"high": 0.60, "medium": 0.45, "low": 0.25},
            "heat":      {"high": 0.02, "medium": 0.01, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.03, "medium": 0.02, "low": 0.01},
            "traffic":   {"high": 0.40, "medium": 0.30, "low": 0.18},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        7: {
            "rainfall":  {"high": 0.75, "medium": 0.55, "low": 0.30},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.02, "medium": 0.01, "low": 0.01},
            "traffic":   {"high": 0.45, "medium": 0.35, "low": 0.20},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        8: {
            "rainfall":  {"high": 0.65, "medium": 0.48, "low": 0.28},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.02, "medium": 0.01, "low": 0.01},
            "traffic":   {"high": 0.38, "medium": 0.30, "low": 0.18},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        9: {
            "rainfall":  {"high": 0.50, "medium": 0.35, "low": 0.18},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.03, "medium": 0.02, "low": 0.01},
            "traffic":   {"high": 0.30, "medium": 0.25, "low": 0.15},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        10: {
            "rainfall":  {"high": 0.12, "medium": 0.08, "low": 0.04},
            "heat":      {"high": 0.05, "medium": 0.03, "low": 0.01},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.15, "medium": 0.10, "low": 0.05},
            "traffic":   {"high": 0.22, "medium": 0.18, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        11: {
            "rainfall":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.08, "medium": 0.05, "low": 0.02},
            "aqi":       {"high": 0.45, "medium": 0.35, "low": 0.20},
            "traffic":   {"high": 0.22, "medium": 0.18, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        12: {
            "rainfall":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.10, "medium": 0.06, "low": 0.03},
            "aqi":       {"high": 0.50, "medium": 0.38, "low": 0.22},
            "traffic":   {"high": 0.25, "medium": 0.20, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
    },

    # ── DELHI — Extreme AQI (Oct-Jan), brutal heat (Apr-Jun), dense fog (Dec-Jan) ──
    "delhi": {
        1: {
            "rainfall":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.70, "medium": 0.55, "low": 0.35},
            "aqi":       {"high": 0.80, "medium": 0.65, "low": 0.45},
            "traffic":   {"high": 0.30, "medium": 0.22, "low": 0.15},
            "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
        },
        2: {
            "rainfall":  {"high": 0.03, "medium": 0.02, "low": 0.01},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.45, "medium": 0.32, "low": 0.18},
            "aqi":       {"high": 0.55, "medium": 0.40, "low": 0.25},
            "traffic":   {"high": 0.25, "medium": 0.20, "low": 0.12},
            "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
        },
        3: {
            "rainfall":  {"high": 0.05, "medium": 0.03, "low": 0.01},
            "heat":      {"high": 0.20, "medium": 0.12, "low": 0.05},
            "cold_fog":  {"high": 0.10, "medium": 0.05, "low": 0.02},
            "aqi":       {"high": 0.30, "medium": 0.20, "low": 0.12},
            "traffic":   {"high": 0.22, "medium": 0.18, "low": 0.10},
            "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
        },
        4: {
            "rainfall":  {"high": 0.03, "medium": 0.02, "low": 0.01},
            "heat":      {"high": 0.55, "medium": 0.40, "low": 0.25},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.18, "medium": 0.12, "low": 0.06},
            "traffic":   {"high": 0.25, "medium": 0.20, "low": 0.12},
            "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
        },
        5: {
            "rainfall":  {"high": 0.05, "medium": 0.03, "low": 0.01},
            "heat":      {"high": 0.72, "medium": 0.55, "low": 0.35},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.15, "medium": 0.10, "low": 0.05},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
        },
        6: {
            "rainfall":  {"high": 0.25, "medium": 0.18, "low": 0.08},
            "heat":      {"high": 0.60, "medium": 0.45, "low": 0.28},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.08, "medium": 0.05, "low": 0.03},
            "traffic":   {"high": 0.30, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
        },
        7: {
            "rainfall":  {"high": 0.55, "medium": 0.40, "low": 0.22},
            "heat":      {"high": 0.15, "medium": 0.08, "low": 0.03},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.05, "medium": 0.03, "low": 0.02},
            "traffic":   {"high": 0.35, "medium": 0.28, "low": 0.18},
            "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
        },
        8: {
            "rainfall":  {"high": 0.50, "medium": 0.38, "low": 0.20},
            "heat":      {"high": 0.10, "medium": 0.05, "low": 0.02},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.05, "medium": 0.03, "low": 0.02},
            "traffic":   {"high": 0.32, "medium": 0.25, "low": 0.15},
            "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
        },
        9: {
            "rainfall":  {"high": 0.30, "medium": 0.20, "low": 0.10},
            "heat":      {"high": 0.08, "medium": 0.04, "low": 0.02},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.12, "medium": 0.08, "low": 0.04},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
        },
        10: {
            "rainfall":  {"high": 0.05, "medium": 0.03, "low": 0.01},
            "heat":      {"high": 0.02, "medium": 0.01, "low": 0.00},
            "cold_fog":  {"high": 0.08, "medium": 0.05, "low": 0.02},
            "aqi":       {"high": 0.75, "medium": 0.58, "low": 0.38},
            "traffic":   {"high": 0.25, "medium": 0.20, "low": 0.12},
            "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
        },
        11: {
            "rainfall":  {"high": 0.01, "medium": 0.00, "low": 0.00},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.50, "medium": 0.35, "low": 0.20},
            "aqi":       {"high": 0.88, "medium": 0.72, "low": 0.50},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
        },
        12: {
            "rainfall":  {"high": 0.01, "medium": 0.00, "low": 0.00},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.65, "medium": 0.48, "low": 0.30},
            "aqi":       {"high": 0.82, "medium": 0.65, "low": 0.42},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
        },
    },

    # ── BANGALORE — Traffic dominated, moderate rain (Sep-Nov), mild heat ──
    "bangalore": {
        1: {
            "rainfall":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "heat":      {"high": 0.02, "medium": 0.01, "low": 0.00},
            "cold_fog":  {"high": 0.03, "medium": 0.02, "low": 0.01},
            "aqi":       {"high": 0.18, "medium": 0.12, "low": 0.06},
            "traffic":   {"high": 0.40, "medium": 0.32, "low": 0.20},
            "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
        },
        2: {
            "rainfall":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "heat":      {"high": 0.05, "medium": 0.03, "low": 0.01},
            "cold_fog":  {"high": 0.01, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.15, "medium": 0.10, "low": 0.05},
            "traffic":   {"high": 0.38, "medium": 0.30, "low": 0.18},
            "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
        },
        3: {
            "rainfall":  {"high": 0.05, "medium": 0.03, "low": 0.01},
            "heat":      {"high": 0.15, "medium": 0.10, "low": 0.05},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.12, "medium": 0.08, "low": 0.04},
            "traffic":   {"high": 0.42, "medium": 0.34, "low": 0.22},
            "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
        },
        4: {
            "rainfall":  {"high": 0.15, "medium": 0.10, "low": 0.05},
            "heat":      {"high": 0.28, "medium": 0.18, "low": 0.08},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.08, "medium": 0.05, "low": 0.03},
            "traffic":   {"high": 0.45, "medium": 0.36, "low": 0.24},
            "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
        },
        5: {
            "rainfall":  {"high": 0.30, "medium": 0.22, "low": 0.10},
            "heat":      {"high": 0.20, "medium": 0.12, "low": 0.05},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.05, "medium": 0.03, "low": 0.02},
            "traffic":   {"high": 0.48, "medium": 0.38, "low": 0.25},
            "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
        },
        6: {
            "rainfall":  {"high": 0.35, "medium": 0.25, "low": 0.12},
            "heat":      {"high": 0.05, "medium": 0.03, "low": 0.01},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.04, "medium": 0.02, "low": 0.01},
            "traffic":   {"high": 0.50, "medium": 0.40, "low": 0.28},
            "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
        },
        7: {
            "rainfall":  {"high": 0.32, "medium": 0.22, "low": 0.10},
            "heat":      {"high": 0.02, "medium": 0.01, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.03, "medium": 0.02, "low": 0.01},
            "traffic":   {"high": 0.48, "medium": 0.38, "low": 0.25},
            "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
        },
        8: {
            "rainfall":  {"high": 0.35, "medium": 0.25, "low": 0.12},
            "heat":      {"high": 0.02, "medium": 0.01, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.03, "medium": 0.02, "low": 0.01},
            "traffic":   {"high": 0.45, "medium": 0.36, "low": 0.24},
            "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
        },
        9: {
            "rainfall":  {"high": 0.42, "medium": 0.30, "low": 0.15},
            "heat":      {"high": 0.02, "medium": 0.01, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.05, "medium": 0.03, "low": 0.02},
            "traffic":   {"high": 0.50, "medium": 0.40, "low": 0.28},
            "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
        },
        10: {
            "rainfall":  {"high": 0.45, "medium": 0.32, "low": 0.18},
            "heat":      {"high": 0.02, "medium": 0.01, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.10, "medium": 0.06, "low": 0.03},
            "traffic":   {"high": 0.45, "medium": 0.36, "low": 0.24},
            "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
        },
        11: {
            "rainfall":  {"high": 0.30, "medium": 0.20, "low": 0.10},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "aqi":       {"high": 0.15, "medium": 0.10, "low": 0.05},
            "traffic":   {"high": 0.42, "medium": 0.34, "low": 0.22},
            "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
        },
        12: {
            "rainfall":  {"high": 0.08, "medium": 0.05, "low": 0.02},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.05, "medium": 0.03, "low": 0.01},
            "aqi":       {"high": 0.18, "medium": 0.12, "low": 0.06},
            "traffic":   {"high": 0.40, "medium": 0.32, "low": 0.20},
            "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
        },
    },

    # ── CHENNAI — Cyclone flooding (Oct-Dec), extreme heat (Apr-Jun), coastal ──
    "chennai": {
        1: {
            "rainfall":  {"high": 0.08, "medium": 0.05, "low": 0.02},
            "heat":      {"high": 0.05, "medium": 0.03, "low": 0.01},
            "cold_fog":  {"high": 0.01, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.15, "medium": 0.10, "low": 0.05},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        2: {
            "rainfall":  {"high": 0.03, "medium": 0.02, "low": 0.01},
            "heat":      {"high": 0.10, "medium": 0.06, "low": 0.03},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.12, "medium": 0.08, "low": 0.04},
            "traffic":   {"high": 0.25, "medium": 0.20, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        3: {
            "rainfall":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "heat":      {"high": 0.25, "medium": 0.18, "low": 0.08},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.10, "medium": 0.06, "low": 0.03},
            "traffic":   {"high": 0.25, "medium": 0.20, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        4: {
            "rainfall":  {"high": 0.05, "medium": 0.03, "low": 0.01},
            "heat":      {"high": 0.55, "medium": 0.40, "low": 0.22},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.08, "medium": 0.05, "low": 0.03},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        5: {
            "rainfall":  {"high": 0.08, "medium": 0.05, "low": 0.02},
            "heat":      {"high": 0.65, "medium": 0.48, "low": 0.30},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.05, "medium": 0.03, "low": 0.02},
            "traffic":   {"high": 0.30, "medium": 0.24, "low": 0.15},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        6: {
            "rainfall":  {"high": 0.12, "medium": 0.08, "low": 0.04},
            "heat":      {"high": 0.50, "medium": 0.38, "low": 0.22},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.04, "medium": 0.02, "low": 0.01},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        7: {
            "rainfall":  {"high": 0.15, "medium": 0.10, "low": 0.05},
            "heat":      {"high": 0.35, "medium": 0.25, "low": 0.12},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.04, "medium": 0.02, "low": 0.01},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        8: {
            "rainfall":  {"high": 0.18, "medium": 0.12, "low": 0.06},
            "heat":      {"high": 0.25, "medium": 0.18, "low": 0.08},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.05, "medium": 0.03, "low": 0.02},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        9: {
            "rainfall":  {"high": 0.25, "medium": 0.18, "low": 0.08},
            "heat":      {"high": 0.15, "medium": 0.10, "low": 0.05},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.06, "medium": 0.04, "low": 0.02},
            "traffic":   {"high": 0.30, "medium": 0.24, "low": 0.15},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        10: {
            "rainfall":  {"high": 0.60, "medium": 0.45, "low": 0.25},
            "heat":      {"high": 0.05, "medium": 0.03, "low": 0.01},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.10, "medium": 0.06, "low": 0.03},
            "traffic":   {"high": 0.35, "medium": 0.28, "low": 0.18},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        11: {
            "rainfall":  {"high": 0.72, "medium": 0.55, "low": 0.32},
            "heat":      {"high": 0.02, "medium": 0.01, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.12, "medium": 0.08, "low": 0.04},
            "traffic":   {"high": 0.38, "medium": 0.30, "low": 0.20},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        12: {
            "rainfall":  {"high": 0.55, "medium": 0.40, "low": 0.22},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "aqi":       {"high": 0.12, "medium": 0.08, "low": 0.04},
            "traffic":   {"high": 0.32, "medium": 0.25, "low": 0.16},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
    },

    # ── KOLKATA — Cyclone flooding (May, Oct-Nov), humidity, Nor'westers (Apr-May) ──
    "kolkata": {
        1: {
            "rainfall":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.25, "medium": 0.15, "low": 0.08},
            "aqi":       {"high": 0.35, "medium": 0.25, "low": 0.15},
            "traffic":   {"high": 0.30, "medium": 0.24, "low": 0.15},
            "social":    {"high": 0.06, "medium": 0.06, "low": 0.06},
        },
        2: {
            "rainfall":  {"high": 0.03, "medium": 0.02, "low": 0.01},
            "heat":      {"high": 0.02, "medium": 0.01, "low": 0.00},
            "cold_fog":  {"high": 0.12, "medium": 0.08, "low": 0.04},
            "aqi":       {"high": 0.25, "medium": 0.18, "low": 0.10},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.06, "medium": 0.06, "low": 0.06},
        },
        3: {
            "rainfall":  {"high": 0.08, "medium": 0.05, "low": 0.02},
            "heat":      {"high": 0.18, "medium": 0.12, "low": 0.05},
            "cold_fog":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "aqi":       {"high": 0.15, "medium": 0.10, "low": 0.05},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.06, "medium": 0.06, "low": 0.06},
        },
        4: {
            "rainfall":  {"high": 0.18, "medium": 0.12, "low": 0.05},
            "heat":      {"high": 0.40, "medium": 0.30, "low": 0.15},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.10, "medium": 0.06, "low": 0.03},
            "traffic":   {"high": 0.30, "medium": 0.24, "low": 0.15},
            "social":    {"high": 0.06, "medium": 0.06, "low": 0.06},
        },
        5: {
            "rainfall":  {"high": 0.30, "medium": 0.22, "low": 0.10},
            "heat":      {"high": 0.50, "medium": 0.38, "low": 0.22},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.06, "medium": 0.04, "low": 0.02},
            "traffic":   {"high": 0.32, "medium": 0.25, "low": 0.16},
            "social":    {"high": 0.06, "medium": 0.06, "low": 0.06},
        },
        6: {
            "rainfall":  {"high": 0.55, "medium": 0.40, "low": 0.22},
            "heat":      {"high": 0.20, "medium": 0.12, "low": 0.05},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.04, "medium": 0.02, "low": 0.01},
            "traffic":   {"high": 0.35, "medium": 0.28, "low": 0.18},
            "social":    {"high": 0.06, "medium": 0.06, "low": 0.06},
        },
        7: {
            "rainfall":  {"high": 0.62, "medium": 0.45, "low": 0.25},
            "heat":      {"high": 0.10, "medium": 0.05, "low": 0.02},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.03, "medium": 0.02, "low": 0.01},
            "traffic":   {"high": 0.38, "medium": 0.30, "low": 0.20},
            "social":    {"high": 0.06, "medium": 0.06, "low": 0.06},
        },
        8: {
            "rainfall":  {"high": 0.58, "medium": 0.42, "low": 0.22},
            "heat":      {"high": 0.10, "medium": 0.05, "low": 0.02},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.03, "medium": 0.02, "low": 0.01},
            "traffic":   {"high": 0.35, "medium": 0.28, "low": 0.18},
            "social":    {"high": 0.06, "medium": 0.06, "low": 0.06},
        },
        9: {
            "rainfall":  {"high": 0.45, "medium": 0.32, "low": 0.18},
            "heat":      {"high": 0.08, "medium": 0.04, "low": 0.02},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.08, "medium": 0.05, "low": 0.03},
            "traffic":   {"high": 0.32, "medium": 0.25, "low": 0.16},
            "social":    {"high": 0.06, "medium": 0.06, "low": 0.06},
        },
        10: {
            "rainfall":  {"high": 0.40, "medium": 0.28, "low": 0.15},
            "heat":      {"high": 0.05, "medium": 0.03, "low": 0.01},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.20, "medium": 0.14, "low": 0.08},
            "traffic":   {"high": 0.30, "medium": 0.24, "low": 0.15},
            "social":    {"high": 0.06, "medium": 0.06, "low": 0.06},
        },
        11: {
            "rainfall":  {"high": 0.15, "medium": 0.10, "low": 0.05},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.10, "medium": 0.06, "low": 0.03},
            "aqi":       {"high": 0.30, "medium": 0.22, "low": 0.12},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.06, "medium": 0.06, "low": 0.06},
        },
        12: {
            "rainfall":  {"high": 0.05, "medium": 0.03, "low": 0.01},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.20, "medium": 0.12, "low": 0.06},
            "aqi":       {"high": 0.38, "medium": 0.28, "low": 0.16},
            "traffic":   {"high": 0.28, "medium": 0.22, "low": 0.14},
            "social":    {"high": 0.06, "medium": 0.06, "low": 0.06},
        },
    },

    # ── PUNE — Maharashtra monsoon (weaker than Mumbai), mild heat, low AQI ──
    "pune": {
        1:  {"rainfall": {"high": 0.00, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.02, "medium": 0.01, "low": 0.00}, "aqi": {"high": 0.10, "medium": 0.07, "low": 0.04}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        2:  {"rainfall": {"high": 0.00, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.01, "medium": 0.01, "low": 0.00}, "aqi": {"high": 0.07, "medium": 0.05, "low": 0.03}, "traffic": {"high": 0.10, "medium": 0.08, "low": 0.05}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        3:  {"rainfall": {"high": 0.01, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.05, "medium": 0.03, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.05, "medium": 0.03, "low": 0.02}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        4:  {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.10, "medium": 0.06, "low": 0.02}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.03, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        5:  {"rainfall": {"high": 0.04, "medium": 0.02, "low": 0.01}, "heat": {"high": 0.15, "medium": 0.10, "low": 0.05}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.02, "medium": 0.01, "low": 0.01}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        6:  {"rainfall": {"high": 0.30, "medium": 0.22, "low": 0.12}, "heat": {"high": 0.01, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.01, "medium": 0.01, "low": 0.00}, "traffic": {"high": 0.22, "medium": 0.16, "low": 0.10}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        7:  {"rainfall": {"high": 0.42, "medium": 0.30, "low": 0.16}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.01, "medium": 0.01, "low": 0.00}, "traffic": {"high": 0.25, "medium": 0.18, "low": 0.11}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        8:  {"rainfall": {"high": 0.38, "medium": 0.27, "low": 0.14}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.01, "medium": 0.01, "low": 0.00}, "traffic": {"high": 0.22, "medium": 0.16, "low": 0.10}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        9:  {"rainfall": {"high": 0.22, "medium": 0.15, "low": 0.08}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.02, "medium": 0.01, "low": 0.01}, "traffic": {"high": 0.18, "medium": 0.13, "low": 0.08}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        10: {"rainfall": {"high": 0.05, "medium": 0.03, "low": 0.01}, "heat": {"high": 0.03, "medium": 0.02, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.06, "medium": 0.04, "low": 0.02}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        11: {"rainfall": {"high": 0.01, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.03, "medium": 0.02, "low": 0.01}, "aqi": {"high": 0.15, "medium": 0.10, "low": 0.06}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        12: {"rainfall": {"high": 0.00, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.04, "medium": 0.02, "low": 0.01}, "aqi": {"high": 0.18, "medium": 0.12, "low": 0.07}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
    },

    # ── HYDERABAD — Deccan plateau, dual-monsoon, hot summers, growing traffic ──
    "hyderabad": {
        1:  {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.01, "medium": 0.01, "low": 0.00}, "aqi": {"high": 0.15, "medium": 0.10, "low": 0.06}, "traffic": {"high": 0.18, "medium": 0.13, "low": 0.08}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        2:  {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.10, "medium": 0.07, "low": 0.04}, "traffic": {"high": 0.16, "medium": 0.12, "low": 0.07}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        3:  {"rainfall": {"high": 0.04, "medium": 0.02, "low": 0.01}, "heat": {"high": 0.05, "medium": 0.03, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.07, "medium": 0.05, "low": 0.03}, "traffic": {"high": 0.16, "medium": 0.12, "low": 0.07}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        4:  {"rainfall": {"high": 0.06, "medium": 0.04, "low": 0.02}, "heat": {"high": 0.18, "medium": 0.12, "low": 0.06}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.05, "medium": 0.03, "low": 0.02}, "traffic": {"high": 0.18, "medium": 0.13, "low": 0.08}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        5:  {"rainfall": {"high": 0.10, "medium": 0.07, "low": 0.03}, "heat": {"high": 0.25, "medium": 0.18, "low": 0.10}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.04, "medium": 0.03, "low": 0.02}, "traffic": {"high": 0.20, "medium": 0.15, "low": 0.09}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        6:  {"rainfall": {"high": 0.30, "medium": 0.22, "low": 0.12}, "heat": {"high": 0.08, "medium": 0.05, "low": 0.02}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.03, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.22, "medium": 0.16, "low": 0.10}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        7:  {"rainfall": {"high": 0.40, "medium": 0.28, "low": 0.15}, "heat": {"high": 0.02, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.02, "medium": 0.01, "low": 0.01}, "traffic": {"high": 0.25, "medium": 0.18, "low": 0.11}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        8:  {"rainfall": {"high": 0.35, "medium": 0.25, "low": 0.13}, "heat": {"high": 0.02, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.02, "medium": 0.01, "low": 0.01}, "traffic": {"high": 0.22, "medium": 0.16, "low": 0.10}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        9:  {"rainfall": {"high": 0.28, "medium": 0.20, "low": 0.10}, "heat": {"high": 0.05, "medium": 0.03, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.04, "medium": 0.03, "low": 0.02}, "traffic": {"high": 0.20, "medium": 0.15, "low": 0.09}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        10: {"rainfall": {"high": 0.30, "medium": 0.22, "low": 0.12}, "heat": {"high": 0.02, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.10, "medium": 0.07, "low": 0.04}, "traffic": {"high": 0.18, "medium": 0.13, "low": 0.08}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        11: {"rainfall": {"high": 0.20, "medium": 0.14, "low": 0.07}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.02, "medium": 0.01, "low": 0.00}, "aqi": {"high": 0.15, "medium": 0.10, "low": 0.06}, "traffic": {"high": 0.18, "medium": 0.13, "low": 0.08}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        12: {"rainfall": {"high": 0.08, "medium": 0.05, "low": 0.02}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.02, "medium": 0.01, "low": 0.00}, "aqi": {"high": 0.18, "medium": 0.12, "low": 0.07}, "traffic": {"high": 0.16, "medium": 0.12, "low": 0.07}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
    },

    # ── AHMEDABAD — Gujarat semi-arid, extreme heat May-Jun, flash floods Jul-Aug ──
    "ahmedabad": {
        1:  {"rainfall": {"high": 0.01, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.15, "medium": 0.10, "low": 0.05}, "aqi": {"high": 0.25, "medium": 0.18, "low": 0.10}, "traffic": {"high": 0.16, "medium": 0.12, "low": 0.07}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        2:  {"rainfall": {"high": 0.01, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.08, "medium": 0.05, "low": 0.02}, "aqi": {"high": 0.18, "medium": 0.12, "low": 0.07}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        3:  {"rainfall": {"high": 0.01, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.20, "medium": 0.12, "low": 0.05}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.12, "medium": 0.08, "low": 0.05}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        4:  {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.45, "medium": 0.32, "low": 0.18}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.08, "medium": 0.05, "low": 0.03}, "traffic": {"high": 0.16, "medium": 0.12, "low": 0.07}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        5:  {"rainfall": {"high": 0.04, "medium": 0.02, "low": 0.01}, "heat": {"high": 0.60, "medium": 0.45, "low": 0.28}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.06, "medium": 0.04, "low": 0.02}, "traffic": {"high": 0.18, "medium": 0.13, "low": 0.08}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        6:  {"rainfall": {"high": 0.20, "medium": 0.14, "low": 0.07}, "heat": {"high": 0.45, "medium": 0.32, "low": 0.18}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.05, "medium": 0.03, "low": 0.02}, "traffic": {"high": 0.18, "medium": 0.13, "low": 0.08}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        7:  {"rainfall": {"high": 0.40, "medium": 0.28, "low": 0.15}, "heat": {"high": 0.05, "medium": 0.03, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.04, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.20, "medium": 0.15, "low": 0.09}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        8:  {"rainfall": {"high": 0.35, "medium": 0.25, "low": 0.13}, "heat": {"high": 0.03, "medium": 0.02, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.04, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.18, "medium": 0.13, "low": 0.08}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        9:  {"rainfall": {"high": 0.15, "medium": 0.10, "low": 0.05}, "heat": {"high": 0.05, "medium": 0.03, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.06, "medium": 0.04, "low": 0.02}, "traffic": {"high": 0.16, "medium": 0.12, "low": 0.07}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        10: {"rainfall": {"high": 0.03, "medium": 0.02, "low": 0.01}, "heat": {"high": 0.02, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.02, "medium": 0.01, "low": 0.00}, "aqi": {"high": 0.15, "medium": 0.10, "low": 0.06}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        11: {"rainfall": {"high": 0.01, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.10, "medium": 0.07, "low": 0.03}, "aqi": {"high": 0.22, "medium": 0.15, "low": 0.08}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        12: {"rainfall": {"high": 0.00, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.15, "medium": 0.10, "low": 0.05}, "aqi": {"high": 0.28, "medium": 0.20, "low": 0.11}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
    },

    # ── JAIPUR — Rajasthan desert, extreme heat Apr-Jun, dust storms, moderate fog Dec-Jan ──
    "jaipur": {
        1:  {"rainfall": {"high": 0.01, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.20, "medium": 0.14, "low": 0.08}, "aqi": {"high": 0.22, "medium": 0.15, "low": 0.08}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.04, "medium": 0.04, "low": 0.04}},
        2:  {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.10, "medium": 0.07, "low": 0.03}, "aqi": {"high": 0.15, "medium": 0.10, "low": 0.06}, "traffic": {"high": 0.10, "medium": 0.08, "low": 0.04}, "social": {"high": 0.04, "medium": 0.04, "low": 0.04}},
        3:  {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.25, "medium": 0.15, "low": 0.07}, "cold_fog": {"high": 0.02, "medium": 0.01, "low": 0.00}, "aqi": {"high": 0.10, "medium": 0.07, "low": 0.04}, "traffic": {"high": 0.10, "medium": 0.08, "low": 0.04}, "social": {"high": 0.04, "medium": 0.04, "low": 0.04}},
        4:  {"rainfall": {"high": 0.01, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.55, "medium": 0.40, "low": 0.22}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.08, "medium": 0.05, "low": 0.03}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.04, "medium": 0.04, "low": 0.04}},
        5:  {"rainfall": {"high": 0.03, "medium": 0.02, "low": 0.01}, "heat": {"high": 0.72, "medium": 0.55, "low": 0.35}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.10, "medium": 0.07, "low": 0.04}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.04, "medium": 0.04, "low": 0.04}},
        6:  {"rainfall": {"high": 0.12, "medium": 0.08, "low": 0.04}, "heat": {"high": 0.65, "medium": 0.48, "low": 0.28}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.08, "medium": 0.05, "low": 0.03}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.04, "medium": 0.04, "low": 0.04}},
        7:  {"rainfall": {"high": 0.38, "medium": 0.27, "low": 0.14}, "heat": {"high": 0.15, "medium": 0.08, "low": 0.03}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.06, "medium": 0.04, "low": 0.02}, "traffic": {"high": 0.16, "medium": 0.12, "low": 0.07}, "social": {"high": 0.04, "medium": 0.04, "low": 0.04}},
        8:  {"rainfall": {"high": 0.32, "medium": 0.22, "low": 0.11}, "heat": {"high": 0.10, "medium": 0.06, "low": 0.02}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.05, "medium": 0.03, "low": 0.02}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.04, "medium": 0.04, "low": 0.04}},
        9:  {"rainfall": {"high": 0.12, "medium": 0.08, "low": 0.04}, "heat": {"high": 0.10, "medium": 0.06, "low": 0.02}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.07, "medium": 0.05, "low": 0.03}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.04, "medium": 0.04, "low": 0.04}},
        10: {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.02, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.05, "medium": 0.03, "low": 0.01}, "aqi": {"high": 0.18, "medium": 0.12, "low": 0.07}, "traffic": {"high": 0.10, "medium": 0.08, "low": 0.04}, "social": {"high": 0.04, "medium": 0.04, "low": 0.04}},
        11: {"rainfall": {"high": 0.01, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.15, "medium": 0.10, "low": 0.05}, "aqi": {"high": 0.25, "medium": 0.18, "low": 0.10}, "traffic": {"high": 0.10, "medium": 0.08, "low": 0.04}, "social": {"high": 0.04, "medium": 0.04, "low": 0.04}},
        12: {"rainfall": {"high": 0.01, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.22, "medium": 0.15, "low": 0.08}, "aqi": {"high": 0.28, "medium": 0.20, "low": 0.11}, "traffic": {"high": 0.10, "medium": 0.08, "low": 0.04}, "social": {"high": 0.04, "medium": 0.04, "low": 0.04}},
    },

    # ── LUCKNOW — UP Gangetic plain, severe floods, extreme heat, dense fog like Delhi ──
    "lucknow": {
        1:  {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.55, "medium": 0.40, "low": 0.25}, "aqi": {"high": 0.65, "medium": 0.50, "low": 0.32}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        2:  {"rainfall": {"high": 0.03, "medium": 0.02, "low": 0.01}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.35, "medium": 0.25, "low": 0.14}, "aqi": {"high": 0.45, "medium": 0.32, "low": 0.20}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        3:  {"rainfall": {"high": 0.04, "medium": 0.02, "low": 0.01}, "heat": {"high": 0.15, "medium": 0.08, "low": 0.03}, "cold_fog": {"high": 0.08, "medium": 0.05, "low": 0.02}, "aqi": {"high": 0.25, "medium": 0.18, "low": 0.10}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        4:  {"rainfall": {"high": 0.03, "medium": 0.02, "low": 0.01}, "heat": {"high": 0.45, "medium": 0.32, "low": 0.18}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.15, "medium": 0.10, "low": 0.06}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        5:  {"rainfall": {"high": 0.05, "medium": 0.03, "low": 0.01}, "heat": {"high": 0.62, "medium": 0.48, "low": 0.30}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.12, "medium": 0.08, "low": 0.05}, "traffic": {"high": 0.16, "medium": 0.12, "low": 0.07}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        6:  {"rainfall": {"high": 0.22, "medium": 0.15, "low": 0.07}, "heat": {"high": 0.52, "medium": 0.38, "low": 0.22}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.07, "medium": 0.05, "low": 0.03}, "traffic": {"high": 0.18, "medium": 0.13, "low": 0.08}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        7:  {"rainfall": {"high": 0.48, "medium": 0.35, "low": 0.20}, "heat": {"high": 0.12, "medium": 0.06, "low": 0.02}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.04, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.20, "medium": 0.15, "low": 0.09}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        8:  {"rainfall": {"high": 0.45, "medium": 0.32, "low": 0.18}, "heat": {"high": 0.08, "medium": 0.04, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.04, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.18, "medium": 0.13, "low": 0.08}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        9:  {"rainfall": {"high": 0.28, "medium": 0.20, "low": 0.10}, "heat": {"high": 0.06, "medium": 0.03, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.08, "medium": 0.05, "low": 0.03}, "traffic": {"high": 0.16, "medium": 0.12, "low": 0.07}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        10: {"rainfall": {"high": 0.05, "medium": 0.03, "low": 0.01}, "heat": {"high": 0.02, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.06, "medium": 0.04, "low": 0.02}, "aqi": {"high": 0.55, "medium": 0.40, "low": 0.25}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        11: {"rainfall": {"high": 0.01, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.38, "medium": 0.28, "low": 0.16}, "aqi": {"high": 0.72, "medium": 0.55, "low": 0.35}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        12: {"rainfall": {"high": 0.01, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.50, "medium": 0.36, "low": 0.22}, "aqi": {"high": 0.68, "medium": 0.52, "low": 0.33}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
    },

    # ── INDORE — Central MP, moderate monsoon, hot summers, relatively clean air ──
    "indore": {
        1:  {"rainfall": {"high": 0.01, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.08, "medium": 0.05, "low": 0.02}, "aqi": {"high": 0.12, "medium": 0.08, "low": 0.05}, "traffic": {"high": 0.10, "medium": 0.07, "low": 0.04}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        2:  {"rainfall": {"high": 0.01, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.05, "medium": 0.03, "low": 0.01}, "aqi": {"high": 0.08, "medium": 0.05, "low": 0.03}, "traffic": {"high": 0.08, "medium": 0.06, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        3:  {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.10, "medium": 0.06, "low": 0.02}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.06, "medium": 0.04, "low": 0.02}, "traffic": {"high": 0.08, "medium": 0.06, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        4:  {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.30, "medium": 0.20, "low": 0.10}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.05, "medium": 0.03, "low": 0.02}, "traffic": {"high": 0.10, "medium": 0.07, "low": 0.04}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        5:  {"rainfall": {"high": 0.05, "medium": 0.03, "low": 0.01}, "heat": {"high": 0.45, "medium": 0.32, "low": 0.18}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.04, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.10, "medium": 0.07, "low": 0.04}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        6:  {"rainfall": {"high": 0.28, "medium": 0.20, "low": 0.10}, "heat": {"high": 0.12, "medium": 0.07, "low": 0.03}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.03, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        7:  {"rainfall": {"high": 0.45, "medium": 0.32, "low": 0.18}, "heat": {"high": 0.02, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.02, "medium": 0.01, "low": 0.01}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        8:  {"rainfall": {"high": 0.40, "medium": 0.28, "low": 0.15}, "heat": {"high": 0.02, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.02, "medium": 0.01, "low": 0.01}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        9:  {"rainfall": {"high": 0.22, "medium": 0.15, "low": 0.08}, "heat": {"high": 0.05, "medium": 0.03, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.03, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.10, "medium": 0.07, "low": 0.04}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        10: {"rainfall": {"high": 0.04, "medium": 0.02, "low": 0.01}, "heat": {"high": 0.02, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.03, "medium": 0.02, "low": 0.01}, "aqi": {"high": 0.10, "medium": 0.07, "low": 0.04}, "traffic": {"high": 0.08, "medium": 0.06, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        11: {"rainfall": {"high": 0.01, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.06, "medium": 0.04, "low": 0.02}, "aqi": {"high": 0.15, "medium": 0.10, "low": 0.06}, "traffic": {"high": 0.08, "medium": 0.06, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        12: {"rainfall": {"high": 0.00, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.10, "medium": 0.07, "low": 0.03}, "aqi": {"high": 0.18, "medium": 0.12, "low": 0.07}, "traffic": {"high": 0.08, "medium": 0.06, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
    },

    # ── PATNA — Bihar Gangetic plain, worst floods in India, extreme heat, dense fog ──
    "patna": {
        1:  {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.55, "medium": 0.40, "low": 0.24}, "aqi": {"high": 0.45, "medium": 0.32, "low": 0.20}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        2:  {"rainfall": {"high": 0.03, "medium": 0.02, "low": 0.01}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.35, "medium": 0.25, "low": 0.14}, "aqi": {"high": 0.30, "medium": 0.22, "low": 0.13}, "traffic": {"high": 0.10, "medium": 0.08, "low": 0.04}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        3:  {"rainfall": {"high": 0.05, "medium": 0.03, "low": 0.01}, "heat": {"high": 0.12, "medium": 0.07, "low": 0.03}, "cold_fog": {"high": 0.10, "medium": 0.06, "low": 0.03}, "aqi": {"high": 0.18, "medium": 0.12, "low": 0.07}, "traffic": {"high": 0.10, "medium": 0.08, "low": 0.04}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        4:  {"rainfall": {"high": 0.06, "medium": 0.04, "low": 0.02}, "heat": {"high": 0.38, "medium": 0.28, "low": 0.15}, "cold_fog": {"high": 0.01, "medium": 0.01, "low": 0.00}, "aqi": {"high": 0.12, "medium": 0.08, "low": 0.05}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        5:  {"rainfall": {"high": 0.10, "medium": 0.07, "low": 0.03}, "heat": {"high": 0.55, "medium": 0.40, "low": 0.24}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.10, "medium": 0.07, "low": 0.04}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        6:  {"rainfall": {"high": 0.30, "medium": 0.22, "low": 0.12}, "heat": {"high": 0.40, "medium": 0.28, "low": 0.15}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.06, "medium": 0.04, "low": 0.02}, "traffic": {"high": 0.16, "medium": 0.12, "low": 0.07}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        7:  {"rainfall": {"high": 0.60, "medium": 0.44, "low": 0.25}, "heat": {"high": 0.08, "medium": 0.04, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.03, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.18, "medium": 0.13, "low": 0.08}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        8:  {"rainfall": {"high": 0.58, "medium": 0.42, "low": 0.24}, "heat": {"high": 0.06, "medium": 0.03, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.03, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.16, "medium": 0.12, "low": 0.07}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        9:  {"rainfall": {"high": 0.42, "medium": 0.30, "low": 0.16}, "heat": {"high": 0.06, "medium": 0.03, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.06, "medium": 0.04, "low": 0.02}, "traffic": {"high": 0.14, "medium": 0.10, "low": 0.06}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        10: {"rainfall": {"high": 0.12, "medium": 0.08, "low": 0.04}, "heat": {"high": 0.02, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.05, "medium": 0.03, "low": 0.01}, "aqi": {"high": 0.28, "medium": 0.20, "low": 0.11}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        11: {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.30, "medium": 0.22, "low": 0.13}, "aqi": {"high": 0.42, "medium": 0.30, "low": 0.18}, "traffic": {"high": 0.10, "medium": 0.08, "low": 0.04}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
        12: {"rainfall": {"high": 0.01, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.48, "medium": 0.35, "low": 0.20}, "aqi": {"high": 0.48, "medium": 0.35, "low": 0.20}, "traffic": {"high": 0.10, "medium": 0.08, "low": 0.04}, "social": {"high": 0.05, "medium": 0.05, "low": 0.05}},
    },

    # ── BHOPAL — Central MP, hilly terrain, moderate monsoon, moderate heat ──
    "bhopal": {
        1:  {"rainfall": {"high": 0.01, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.10, "medium": 0.07, "low": 0.03}, "aqi": {"high": 0.15, "medium": 0.10, "low": 0.06}, "traffic": {"high": 0.08, "medium": 0.06, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        2:  {"rainfall": {"high": 0.01, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.06, "medium": 0.04, "low": 0.02}, "aqi": {"high": 0.10, "medium": 0.07, "low": 0.04}, "traffic": {"high": 0.07, "medium": 0.05, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        3:  {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.08, "medium": 0.05, "low": 0.02}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.07, "medium": 0.05, "low": 0.03}, "traffic": {"high": 0.07, "medium": 0.05, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        4:  {"rainfall": {"high": 0.02, "medium": 0.01, "low": 0.00}, "heat": {"high": 0.28, "medium": 0.18, "low": 0.08}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.05, "medium": 0.03, "low": 0.02}, "traffic": {"high": 0.08, "medium": 0.06, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        5:  {"rainfall": {"high": 0.05, "medium": 0.03, "low": 0.01}, "heat": {"high": 0.42, "medium": 0.30, "low": 0.16}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.04, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.08, "medium": 0.06, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        6:  {"rainfall": {"high": 0.28, "medium": 0.20, "low": 0.10}, "heat": {"high": 0.12, "medium": 0.07, "low": 0.03}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.03, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.10, "medium": 0.07, "low": 0.04}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        7:  {"rainfall": {"high": 0.48, "medium": 0.35, "low": 0.20}, "heat": {"high": 0.02, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.02, "medium": 0.01, "low": 0.01}, "traffic": {"high": 0.12, "medium": 0.09, "low": 0.05}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        8:  {"rainfall": {"high": 0.42, "medium": 0.30, "low": 0.16}, "heat": {"high": 0.02, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.02, "medium": 0.01, "low": 0.01}, "traffic": {"high": 0.10, "medium": 0.07, "low": 0.04}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        9:  {"rainfall": {"high": 0.22, "medium": 0.15, "low": 0.08}, "heat": {"high": 0.04, "medium": 0.02, "low": 0.01}, "cold_fog": {"high": 0.00, "medium": 0.00, "low": 0.00}, "aqi": {"high": 0.03, "medium": 0.02, "low": 0.01}, "traffic": {"high": 0.08, "medium": 0.06, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        10: {"rainfall": {"high": 0.03, "medium": 0.02, "low": 0.01}, "heat": {"high": 0.01, "medium": 0.01, "low": 0.00}, "cold_fog": {"high": 0.04, "medium": 0.02, "low": 0.01}, "aqi": {"high": 0.12, "medium": 0.08, "low": 0.05}, "traffic": {"high": 0.07, "medium": 0.05, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        11: {"rainfall": {"high": 0.01, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.08, "medium": 0.05, "low": 0.02}, "aqi": {"high": 0.18, "medium": 0.12, "low": 0.07}, "traffic": {"high": 0.07, "medium": 0.05, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
        12: {"rainfall": {"high": 0.00, "medium": 0.00, "low": 0.00}, "heat": {"high": 0.00, "medium": 0.00, "low": 0.00}, "cold_fog": {"high": 0.12, "medium": 0.08, "low": 0.04}, "aqi": {"high": 0.20, "medium": 0.14, "low": 0.08}, "traffic": {"high": 0.07, "medium": 0.05, "low": 0.03}, "social": {"high": 0.03, "medium": 0.03, "low": 0.03}},
    },
}

RISK_PROBABILITIES = _CITY_BASE_PROBS


# ── Payout and Pricing Differentials ──

# Average payout per trigger event (in Rs.) — BASE values for Tier 1 Urban
AVG_PAYOUT_PER_EVENT = {
    "rainfall": 350,
    "heat": 320,
    "cold_fog": 280,
    "aqi": 280,
    "traffic": 250,
    "social": 450,
}

# City tier multiplier for payouts (reflects cost of living)
CITY_TIER_MULTIPLIER = {
    "tier_1": 1.0,    # Metros: full payout
    "tier_2": 0.80,   # Major cities: 80% of metro payout
    "tier_3": 0.60,   # Smaller cities: 60% of metro payout
}

# Area type multiplier for payouts (reflects local earning potential)
AREA_TYPE_MULTIPLIER = {
    "urban": 1.0,        # Full payout
    "semi_urban": 0.75,  # 75% — lower cost, fewer deliveries
    "rural": 0.55,       # 55% — much lower earnings, but higher need
}

# Margin multiplier (35% gross margin target)
MARGIN = 1.35

# Max weekly premium by city tier × zone density.
# Anchored to 1.25% of weekly earnings per tier:
#   tier_1 = ₹6000/wk  →  ₹75 max
#   tier_2 = ₹4500/wk  →  ₹56 max  (4500/6000 × 75)
#   tier_3 = ₹3000/wk  →  ₹38 max  (3000/6000 × 75)
# Zone density (high/medium/low) reflects congestion — ₹10 steps within tier.
CITY_TIER_ZONE_PREMIUM = {
    "tier_1": {"high": 75, "medium": 65, "low": 55},
    "tier_2": {"high": 56, "medium": 49, "low": 41},
    "tier_3": {"high": 38, "medium": 33, "low": 28},
}

# Lookup: city name → city tier (used to derive tier when only city is known)
CITY_TIER_CODES = {
    "mumbai": "tier_1", "delhi": "tier_1", "bangalore": "tier_1",
    "chennai": "tier_1", "kolkata": "tier_1",
    "pune": "tier_2", "hyderabad": "tier_2", "ahmedabad": "tier_2", "jaipur": "tier_2",
    "lucknow": "tier_3", "indore": "tier_3", "patna": "tier_3", "bhopal": "tier_3",
}

BASE_TRIGGER_LOSS_COVERAGE = {
    "rainfall": 280.0,
    "heat": 180.0,
    "aqi": 160.0,
    "traffic": 100.0,
    "cold_fog": 120.0,
    "social": 400.0,
}


def premium_to_weekly_cap(premium_amount: float) -> float:
    """Map weekly premium → max weekly payout cap.
    Uses 8/3 multiplier so ₹75→₹200, ₹56→₹150, ₹38→₹100, ₹28→₹75.
    Rounds to nearest ₹25 for clean communication to riders.
    """
    premium = max(25.0, min(75.0, float(premium_amount)))
    return max(75.0, round(premium * 8 / 3 / 25) * 25)


def zone_tier_to_weekly_cap(zone_tier: str, city_tier: str = "tier_1") -> float:
    """Return the weekly payout cap for a zone density + city tier combination."""
    tier_prems = CITY_TIER_ZONE_PREMIUM.get(city_tier, CITY_TIER_ZONE_PREMIUM["tier_1"])
    target_premium = tier_prems.get(str(zone_tier).lower(), 60.0)
    return premium_to_weekly_cap(target_premium)


def coverage_triggers_from_premium(premium_amount: float) -> dict[str, float]:
    scale = premium_to_weekly_cap(premium_amount) / 200.0
    return {
        trigger: round(loss_amount * scale, 1)
        for trigger, loss_amount in BASE_TRIGGER_LOSS_COVERAGE.items()
    }


class PricingEngine:
    """
    Calculates weekly premiums at the City + Zone Tier + Month level.

    Formula:
      For each trigger:
        trigger_premium = risk_probability x avg_payout x MARGIN

      Weekly premium = sum of all trigger_premiums
    """

    def calculate_premium(
        self,
        city: str,
        zone_tier: str,  # "high", "medium", "low"
        month: int,       # 1-12
        city_tier: str = "tier_1",    # "tier_1", "tier_2", "tier_3"
        area_type: str = "urban",     # "urban", "semi_urban", "rural"
        activity_tier: str = "high",  # "high", "medium", "low" -> slide: workers with <5 active days in 30 go to lower tier
    ) -> dict:
        """
        Calculate the weekly premium for a given city/zone/month.
        Uses the ML actuarial registry for the base quote, then applies
        area/activity multipliers for the final microinsurance ticket.
        """
        city_lower = city.lower()
        zone_key = str(zone_tier).lower()
        pricing_inputs = ml.get_pricing_inputs(city, zone_key, month, city_tier)
        if not pricing_inputs:
            logger.warning(f"No risk data for {city}, month {month}. Using defaults.")
            return self._default_premium(city, zone_tier, month, city_tier, area_type)

        # City tier is already encoded in the model features. Area and activity stay
        # as post-model multipliers so semi-urban / rural and low-activity workers
        # still price lower without changing the public API.
        tier_mult = CITY_TIER_MULTIPLIER.get(city_tier, 1.0)
        area_mult = AREA_TYPE_MULTIPLIER.get(area_type, 1.0)
        activity_tier_mult = {"high": 1.0, "medium": 0.9, "low": 0.7}.get(activity_tier, 1.0)
        actuarial = pricing_inputs["actuarial"]
        model_premium = ml.predict_premium(
            pricing_inputs["month_sin"],
            pricing_inputs["month_cos"],
            pricing_inputs["zone_tier_enc"],
            pricing_inputs["city_tier_enc"],
            pricing_inputs["peril_probabilities"],
            actuarial["expected_loss"],
            actuarial["coefficient_of_variation"],
            actuarial["safety_loading"],
        )
        adjusted_total = model_premium * area_mult * activity_tier_mult
        tier_prems = CITY_TIER_ZONE_PREMIUM.get(city_tier, CITY_TIER_ZONE_PREMIUM["tier_1"])
        max_premium = tier_prems.get(zone_key, 60)
        min_premium = max(20, max_premium // 3)
        zone_floor = max_premium * 0.60 * area_mult * activity_tier_mult
        adjusted_total = max(adjusted_total, zone_floor)
        final_total = max(min_premium, min(max_premium, round(adjusted_total)))

        expected_components = actuarial["expected_components"]
        total_component_loss = sum(expected_components.values())
        if total_component_loss > 0:
            scale_factor = final_total / total_component_loss
            breakdown = {
                peril: round(component * scale_factor, 1)
                for peril, component in expected_components.items()
            }
        else:
            equal_share = round(final_total / max(len(AVG_PAYOUT_PER_EVENT), 1), 1)
            breakdown = {peril: equal_share for peril in AVG_PAYOUT_PER_EVENT}

        current_sum = round(sum(breakdown.values()), 1)
        if breakdown and abs(current_sum - final_total) > 0.01:
            largest_key = max(breakdown, key=breakdown.get)
            breakdown[largest_key] = round(breakdown[largest_key] + (final_total - current_sum), 1)

        return {
            "city": city,
            "zone_tier": zone_tier,
            "city_tier": city_tier,
            "area_type": area_type,
            "activity_tier": activity_tier,
            "month": month,
            "weekly_premium": final_total,
            "total_weekly_premium": final_total,
            "breakdown": breakdown,
            "margin_applied": MARGIN,
            "multipliers_used": {
                "city_tier": tier_mult,
                "area": area_mult,
                "activity_tier": activity_tier_mult
            },
            "formula": "Actuarial expected loss + safety loading, then ML-smoothed premium with area/activity adjustments.",
            "actuarial": {
                "expected_loss": actuarial["expected_loss"],
                "std_loss": actuarial["std_loss"],
                "coefficient_of_variation": actuarial["coefficient_of_variation"],
                "safety_loading_pct": round(actuarial["safety_loading"] * 100, 1),
            },
            "ml_model": "GradientBoostingRegressor",
            "weekly_cap": premium_to_weekly_cap(final_total),
        }

    def calculate_annual_schedule(self, city: str, zone_tier: str, city_tier: str = "tier_1") -> list:
        """Calculate premium for every month of the year."""
        return [
            self.calculate_premium(city, zone_tier, month, city_tier=city_tier)
            for month in range(1, 13)
        ]

    def get_rate_card(self, city: str, month: int) -> dict:
        """Get the full rate card for a city/month across all zone tiers."""
        return {
            "city": city,
            "month": month,
            "tiers": {
                "high": self.calculate_premium(city, "high", month),
                "medium": self.calculate_premium(city, "medium", month),
                "low": self.calculate_premium(city, "low", month),
            }
        }

    def _default_premium(self, city: str = "Unknown", zone_tier: str = "medium",
                         month: int = 1, city_tier: str = "tier_1", area_type: str = "urban") -> dict:
        tier_mult = CITY_TIER_MULTIPLIER.get(city_tier, 1.0)
        area_mult = AREA_TYPE_MULTIPLIER.get(area_type, 1.0)
        base = round(45 * tier_mult * area_mult)
        return {
            "city": city,
            "zone_tier": zone_tier,
            "city_tier": city_tier,
            "area_type": area_type,
            "month": month,
            "base_rate": CITIES_BASE_RATE.get(city.lower(), 20),
            "weekly_premium": base,
            "total_weekly_premium": base,
            "breakdown": {t: round(7.5 * tier_mult * area_mult, 1) for t in AVG_PAYOUT_PER_EVENT},
            "note": "Default premium — no city-specific data available",
            "weekly_cap": premium_to_weekly_cap(base),
        }


# Base rates per city (Rs. per week base)
CITIES_BASE_RATE = {
    # Tier 1
    "mumbai": 22, "delhi": 24, "bangalore": 20, "chennai": 20, "kolkata": 20,
    # Tier 2
    "pune": 16, "hyderabad": 16, "ahmedabad": 15, "jaipur": 15,
    # Tier 3
    "lucknow": 12, "indore": 12, "patna": 10, "bhopal": 12,
}

# City name → tier mapping (for quick lookup)
CITY_TIER_MAP = {
    "mumbai": "tier_1", "delhi": "tier_1", "bangalore": "tier_1",
    "chennai": "tier_1", "kolkata": "tier_1",
    "pune": "tier_2", "hyderabad": "tier_2", "ahmedabad": "tier_2", "jaipur": "tier_2",
    "lucknow": "tier_3", "indore": "tier_3", "patna": "tier_3", "bhopal": "tier_3",
}
