"""
Dynamic Pricing Engine — City + Issue + Season + Zone Tier based.

Calculates weekly premiums using:
  Premium = Sum(Issue_Risk x Expected_Payout) x Margin x Zone_Factor

Rate cards are pre-computed and stored in DB.
Updated weekly every Sunday based on forecast data.
"""

from typing import Optional
import logging

logger = logging.getLogger(__name__)


# ── Historical Risk Data (Real data from IMD, CPCB, TomTom) ──
# Format: { city: { month: { trigger: { zone_tier: probability } } } }

RISK_PROBABILITIES = {
    # ── MUMBAI — Monsoon flooding (Jun-Sep), winter AQI, year-round traffic ──
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
}

# ── Tier 2: Pune — Maharashtra monsoon, moderate traffic ──
RISK_PROBABILITIES["pune"] = {
    m: {
        "rainfall":  {t: round(RISK_PROBABILITIES["mumbai"][m]["rainfall"][t] * 0.7, 2) for t in ["high", "medium", "low"]},
        "heat":      {t: round(RISK_PROBABILITIES["mumbai"][m]["heat"][t] * 0.9, 2) for t in ["high", "medium", "low"]},
        "cold_fog":  {t: round(RISK_PROBABILITIES["mumbai"][m]["cold_fog"][t] * 1.2, 2) for t in ["high", "medium", "low"]},
        "aqi":       {t: round(RISK_PROBABILITIES["mumbai"][m]["aqi"][t] * 0.6, 2) for t in ["high", "medium", "low"]},
        "traffic":   {t: round(RISK_PROBABILITIES["mumbai"][m]["traffic"][t] * 0.7, 2) for t in ["high", "medium", "low"]},
        "social":    {t: round(RISK_PROBABILITIES["mumbai"][m]["social"][t] * 0.8, 2) for t in ["high", "medium", "low"]},
    } for m in range(1, 13)
}

# ── Tier 2: Hyderabad — hot summers, moderate rain, growing traffic ──
RISK_PROBABILITIES["hyderabad"] = {
    m: {
        "rainfall":  {t: round(RISK_PROBABILITIES["chennai"][m]["rainfall"][t] * 0.6, 2) for t in ["high", "medium", "low"]},
        "heat":      {t: round(RISK_PROBABILITIES["delhi"][m]["heat"][t] * 0.8, 2) for t in ["high", "medium", "low"]},
        "cold_fog":  {t: round(RISK_PROBABILITIES["delhi"][m]["cold_fog"][t] * 0.2, 2) for t in ["high", "medium", "low"]},
        "aqi":       {t: round(RISK_PROBABILITIES["delhi"][m]["aqi"][t] * 0.4, 2) for t in ["high", "medium", "low"]},
        "traffic":   {t: round(RISK_PROBABILITIES["bangalore"][m]["traffic"][t] * 0.8, 2) for t in ["high", "medium", "low"]},
        "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
    } for m in range(1, 13)
}

# ── Tier 2: Ahmedabad — extreme heat, industrial AQI, Gujarat floods ──
RISK_PROBABILITIES["ahmedabad"] = {
    m: {
        "rainfall":  {t: round(RISK_PROBABILITIES["mumbai"][m]["rainfall"][t] * 0.5, 2) for t in ["high", "medium", "low"]},
        "heat":      {t: round(min(RISK_PROBABILITIES["delhi"][m]["heat"][t] * 1.1, 0.95), 2) for t in ["high", "medium", "low"]},
        "cold_fog":  {t: round(RISK_PROBABILITIES["delhi"][m]["cold_fog"][t] * 0.3, 2) for t in ["high", "medium", "low"]},
        "aqi":       {t: round(RISK_PROBABILITIES["delhi"][m]["aqi"][t] * 0.5, 2) for t in ["high", "medium", "low"]},
        "traffic":   {t: round(RISK_PROBABILITIES["mumbai"][m]["traffic"][t] * 0.6, 2) for t in ["high", "medium", "low"]},
        "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
    } for m in range(1, 13)
}

# ── Tier 2: Jaipur — extreme heat, dust storms, Rajasthan floods ──
RISK_PROBABILITIES["jaipur"] = {
    m: {
        "rainfall":  {t: round(RISK_PROBABILITIES["delhi"][m]["rainfall"][t] * 0.7, 2) for t in ["high", "medium", "low"]},
        "heat":      {t: round(min(RISK_PROBABILITIES["delhi"][m]["heat"][t] * 1.15, 0.95), 2) for t in ["high", "medium", "low"]},
        "cold_fog":  {t: round(RISK_PROBABILITIES["delhi"][m]["cold_fog"][t] * 0.6, 2) for t in ["high", "medium", "low"]},
        "aqi":       {t: round(RISK_PROBABILITIES["delhi"][m]["aqi"][t] * 0.45, 2) for t in ["high", "medium", "low"]},
        "traffic":   {t: round(RISK_PROBABILITIES["delhi"][m]["traffic"][t] * 0.5, 2) for t in ["high", "medium", "low"]},
        "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
    } for m in range(1, 13)
}

# ── Tier 3: Lucknow — UP floods, Delhi-like heat/fog ──
RISK_PROBABILITIES["lucknow"] = {
    m: {
        "rainfall":  {t: round(RISK_PROBABILITIES["delhi"][m]["rainfall"][t] * 0.9, 2) for t in ["high", "medium", "low"]},
        "heat":      {t: round(RISK_PROBABILITIES["delhi"][m]["heat"][t] * 0.9, 2) for t in ["high", "medium", "low"]},
        "cold_fog":  {t: round(RISK_PROBABILITIES["delhi"][m]["cold_fog"][t] * 0.85, 2) for t in ["high", "medium", "low"]},
        "aqi":       {t: round(RISK_PROBABILITIES["delhi"][m]["aqi"][t] * 0.6, 2) for t in ["high", "medium", "low"]},
        "traffic":   {t: round(RISK_PROBABILITIES["delhi"][m]["traffic"][t] * 0.4, 2) for t in ["high", "medium", "low"]},
        "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
    } for m in range(1, 13)
}

# ── Tier 3: Indore — central India heat, moderate monsoon ──
RISK_PROBABILITIES["indore"] = {
    m: {
        "rainfall":  {t: round(RISK_PROBABILITIES["mumbai"][m]["rainfall"][t] * 0.4, 2) for t in ["high", "medium", "low"]},
        "heat":      {t: round(RISK_PROBABILITIES["delhi"][m]["heat"][t] * 0.85, 2) for t in ["high", "medium", "low"]},
        "cold_fog":  {t: round(RISK_PROBABILITIES["delhi"][m]["cold_fog"][t] * 0.3, 2) for t in ["high", "medium", "low"]},
        "aqi":       {t: round(RISK_PROBABILITIES["delhi"][m]["aqi"][t] * 0.35, 2) for t in ["high", "medium", "low"]},
        "traffic":   {t: round(RISK_PROBABILITIES["mumbai"][m]["traffic"][t] * 0.35, 2) for t in ["high", "medium", "low"]},
        "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
    } for m in range(1, 13)
}

# ── Tier 3: Patna — Bihar floods (worst in India), extreme heat ──
RISK_PROBABILITIES["patna"] = {
    m: {
        "rainfall":  {t: round(min(RISK_PROBABILITIES["kolkata"][m]["rainfall"][t] * 1.3, 0.95), 2) for t in ["high", "medium", "low"]},
        "heat":      {t: round(RISK_PROBABILITIES["delhi"][m]["heat"][t] * 0.9, 2) for t in ["high", "medium", "low"]},
        "cold_fog":  {t: round(RISK_PROBABILITIES["delhi"][m]["cold_fog"][t] * 0.7, 2) for t in ["high", "medium", "low"]},
        "aqi":       {t: round(RISK_PROBABILITIES["delhi"][m]["aqi"][t] * 0.45, 2) for t in ["high", "medium", "low"]},
        "traffic":   {t: round(RISK_PROBABILITIES["kolkata"][m]["traffic"][t] * 0.4, 2) for t in ["high", "medium", "low"]},
        "social":    {"high": 0.05, "medium": 0.05, "low": 0.05},
    } for m in range(1, 13)
}

# ── Tier 3: Bhopal — central India, moderate risks ──
RISK_PROBABILITIES["bhopal"] = {
    m: {
        "rainfall":  {t: round(RISK_PROBABILITIES["mumbai"][m]["rainfall"][t] * 0.35, 2) for t in ["high", "medium", "low"]},
        "heat":      {t: round(RISK_PROBABILITIES["delhi"][m]["heat"][t] * 0.8, 2) for t in ["high", "medium", "low"]},
        "cold_fog":  {t: round(RISK_PROBABILITIES["delhi"][m]["cold_fog"][t] * 0.35, 2) for t in ["high", "medium", "low"]},
        "aqi":       {t: round(RISK_PROBABILITIES["delhi"][m]["aqi"][t] * 0.35, 2) for t in ["high", "medium", "low"]},
        "traffic":   {t: round(RISK_PROBABILITIES["mumbai"][m]["traffic"][t] * 0.3, 2) for t in ["high", "medium", "low"]},
        "social":    {"high": 0.03, "medium": 0.03, "low": 0.03},
    } for m in range(1, 13)
}


# ── Payout and Pricing Differentials ──

# Average payout per trigger event (in Rs.) — BASE values for Tier 1 Urban
AVG_PAYOUT_PER_EVENT = {
    "rainfall": 280,
    "heat": 180,
    "cold_fog": 120,
    "aqi": 160,
    "traffic": 100,
    "social": 400,
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
        Uses exact formula from underwriting specs:
        Base: (trigger probability) × (avg income lost per day) × (days exposed)
        Then adjusts for: city, peril type, worker activity tier.
        """
        city_lower = city.lower()
        risk_data = RISK_PROBABILITIES.get(city_lower, {}).get(month, {})

        if not risk_data:
            logger.warning(f"No risk data for {city}, month {month}. Using defaults.")
            return self._default_premium(city, zone_tier, month, city_tier, area_type)

        # 1. Base Multipliers (City, Area)
        tier_mult = CITY_TIER_MULTIPLIER.get(city_tier, 1.0)
        area_mult = AREA_TYPE_MULTIPLIER.get(area_type, 1.0)
        
        # 2. Worker Activity Tier Multiplier (Higher activity = higher exposure = higher premium)
        # If < 5 days => "low" tier => much less exposed, cheaper premium.
        activity_tier_mult = {"high": 1.0, "medium": 0.8, "low": 0.5}.get(activity_tier, 1.0)
        
        combined_mult = tier_mult * area_mult * activity_tier_mult

        breakdown = {}
        total = 0

        # Note: AVG_PAYOUT_PER_EVENT here mimics "avg income lost per day"
        # We model exposure based on assumed days worked in a week (e.g. 6 days)
        assumed_days_exposed_per_week = 6.0 

        for peril_type, avg_income_lost_per_day in AVG_PAYOUT_PER_EVENT.items():
            # (trigger probability)
            # From historical 10-year Gumbel/Lognormal simulation
            trigger_probability = risk_data.get(peril_type, {}).get(zone_tier, 0)
            
            # Base Formula: prob × income_lost × days_exposed
            base_trigger_premium = trigger_probability * avg_income_lost_per_day * assumed_days_exposed_per_week
            
            # Adjust for city, peril magnitude (margin), and worker activity tier
            adjusted_premium = base_trigger_premium * combined_mult * MARGIN
            
            breakdown[peril_type] = round(adjusted_premium, 1)
            total += adjusted_premium

        # STRICT TARGET RANGE FROM SLIDES: ₹20–₹50 per worker per week
        # Enforce this hard cap range for the weekly microinsurance ticket.
        final_total = max(20, min(50, round(total)))

        # ALWAYS Scale breakdown proportionally to ensure it exactly matches final_total
        if total > 0:
            scale_factor = final_total / total
            breakdown = {k: round(v * scale_factor, 1) for k, v in breakdown.items()}
            current_sum = sum(breakdown.values())
            if abs(current_sum - final_total) > 0.01:
                # Add difference to largest value to perfectly match
                largest_key = max(breakdown, key=breakdown.get)
                breakdown[largest_key] = round(breakdown[largest_key] + (final_total - current_sum), 1)
        else:
            final_total = 0

        total = final_total

        return {
            "city": city,
            "zone_tier": zone_tier,
            "city_tier": city_tier,
            "area_type": area_type,
            "activity_tier": activity_tier,
            "month": month,
            "weekly_premium": total,
            "total_weekly_premium": total,
            "breakdown": breakdown,
            "margin_applied": MARGIN,
            "multipliers_used": {
                "city_tier": tier_mult,
                "area": area_mult,
                "activity_tier": activity_tier_mult
            },
            "formula": "(trigger probability) × (avg income lost per day) × (days exposed), adjusted for city, peril, activity_tier",
        }

    def calculate_annual_schedule(self, city: str, zone_tier: str) -> list:
        """Calculate premium for every month of the year."""
        return [
            self.calculate_premium(city, zone_tier, month)
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
