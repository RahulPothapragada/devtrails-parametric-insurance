"""
Traffic Service — Traffic disruption monitoring.
Uses TomTom Traffic API (free tier: 2500 calls/day) or mock.
"""

import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class TrafficService:
    """Fetches real-time traffic flow data for zones."""

    def __init__(self):
        self.api_key = settings.TOMTOM_API_KEY

    async def get_zone_traffic(self, lat: float, lng: float) -> dict:
        """Get average traffic speed for a zone."""
        if not self.api_key:
            return self._mock_traffic()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json",
                    params={
                        "key": self.api_key,
                        "point": f"{lat},{lng}",
                    },
                    timeout=10.0,
                )
                data = response.json()

            flow = data.get("flowSegmentData", {})
            return {
                "current_speed_kmh": flow.get("currentSpeed", 30),
                "free_flow_speed_kmh": flow.get("freeFlowSpeed", 45),
                "congestion_pct": round(
                    (1 - flow.get("currentSpeed", 30) / max(flow.get("freeFlowSpeed", 45), 1)) * 100
                ),
                "source": "tomtom",
            }
        except Exception as e:
            logger.error(f"TomTom API error: {e}")
            return self._mock_traffic()

    def _mock_traffic(self) -> dict:
        """Mock traffic data."""
        return {
            "current_speed_kmh": 18,
            "free_flow_speed_kmh": 40,
            "congestion_pct": 55,
            "source": "mock",
        }
