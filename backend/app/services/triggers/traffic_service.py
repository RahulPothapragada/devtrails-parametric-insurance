"""
Traffic Service — Real-time traffic via Google Maps Roads API.

Uses the Roads API speedLimits + snapToRoads endpoint to get current
vehicle speed near a zone's centre point.

Free tier: $200/month credit → ~40,000 calls free.
Falls back to TomTom if Google key is missing, then to mock.
"""

import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class TrafficService:
    """Fetches real-time traffic speed for a zone centre."""

    def __init__(self):
        self.google_key = settings.GOOGLE_MAPS_API_KEY
        self.tomtom_key = settings.TOMTOM_API_KEY

    async def get_zone_traffic(self, lat: float, lng: float) -> dict:
        if self.google_key:
            result = await self._google_traffic(lat, lng)
            if result:
                return result

        if self.tomtom_key:
            result = await self._tomtom_traffic(lat, lng)
            if result:
                return result

        return self._mock_traffic()

    # ── Google Maps Roads API ─────────────────────────────────────

    async def _google_traffic(self, lat: float, lng: float) -> dict | None:
        """
        Uses Google Maps Distance Matrix API to infer congestion.
        Compares driving duration vs duration_in_traffic for a short
        reference segment centred on the zone.

        A ratio > 1.5 means heavy congestion; we map this to km/h.
        """
        try:
            # Small offset to create an origin→destination pair within the zone
            origin = f"{lat},{lng}"
            dest   = f"{lat + 0.005},{lng + 0.005}"   # ~550m away

            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    "https://maps.googleapis.com/maps/api/distancematrix/json",
                    params={
                        "origins":       origin,
                        "destinations":  dest,
                        "mode":          "driving",
                        "departure_time": "now",      # required for traffic model
                        "traffic_model":  "best_guess",
                        "key":            self.google_key,
                    },
                )
                data = r.json()

            if data.get("status") != "OK":
                logger.warning("Google Distance Matrix status: %s", data.get("status"))
                return None

            element = data["rows"][0]["elements"][0]
            if element.get("status") != "OK":
                return None

            free_flow_secs  = element["duration"]["value"]
            traffic_secs    = element.get("duration_in_traffic", {}).get("value", free_flow_secs)
            distance_m      = element["distance"]["value"]

            # Current speed = distance / travel time
            current_speed_ms  = distance_m / max(traffic_secs, 1)
            free_flow_speed_ms = distance_m / max(free_flow_secs, 1)

            current_speed_kmh   = round(current_speed_ms * 3.6, 1)
            free_flow_speed_kmh = round(free_flow_speed_ms * 3.6, 1)
            congestion_pct      = round((1 - current_speed_ms / max(free_flow_speed_ms, 0.1)) * 100)
            congestion_pct      = max(0, min(100, congestion_pct))

            logger.info(
                "Google traffic (%.4f,%.4f): %.1f km/h (free flow %.1f km/h, congestion %d%%)",
                lat, lng, current_speed_kmh, free_flow_speed_kmh, congestion_pct,
            )

            return {
                "current_speed_kmh":   current_speed_kmh,
                "free_flow_speed_kmh": free_flow_speed_kmh,
                "congestion_pct":      congestion_pct,
                "source":              "google_maps_live",
            }

        except Exception as e:
            logger.error("Google Maps traffic error: %s", e)
            return None

    # ── TomTom fallback ───────────────────────────────────────────

    async def _tomtom_traffic(self, lat: float, lng: float) -> dict | None:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json",
                    params={"key": self.tomtom_key, "point": f"{lat},{lng}"},
                )
                data = r.json()

            flow = data.get("flowSegmentData", {})
            current   = flow.get("currentSpeed", 30)
            free_flow = flow.get("freeFlowSpeed", 45)
            return {
                "current_speed_kmh":   current,
                "free_flow_speed_kmh": free_flow,
                "congestion_pct":      round((1 - current / max(free_flow, 1)) * 100),
                "source":              "tomtom_live",
            }
        except Exception as e:
            logger.error("TomTom traffic error: %s", e)
            return None

    # ── Mock fallback ─────────────────────────────────────────────

    def _mock_traffic(self) -> dict:
        return {
            "current_speed_kmh":   18.0,
            "free_flow_speed_kmh": 40.0,
            "congestion_pct":      55,
            "source":              "mock",
        }
