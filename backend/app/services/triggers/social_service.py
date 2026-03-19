"""
Social Disruption Service — Detects bandhs, strikes, curfews via NLP.
Uses NewsAPI (free tier: 100 calls/day) + keyword matching.
"""

import httpx
import re
from datetime import datetime, timedelta
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Keywords that indicate social disruptions
DISRUPTION_KEYWORDS = {
    "bandh": ["bandh", "bharat bandh", "maharashtra bandh", "state bandh"],
    "strike": ["strike", "protest", "agitation", "dharna", "morcha"],
    "curfew": ["curfew", "section 144", "section144", "prohibitory orders"],
    "shutdown": ["shutdown", "market closed", "shops closed", "forced closure"],
}

SEVERITY_INDICATORS = {
    "high": ["curfew", "section 144", "shoot at sight", "army deployed"],
    "medium": ["bandh", "complete shutdown", "total bandh", "dawn to dusk"],
    "low": ["partial", "strike", "protest", "dharna"],
}


class SocialDisruptionService:
    """
    NLP-based detection of social disruptions from news feeds.
    This is one of the AI differentiators — no other team will detect
    bandhs/strikes from news data.
    """

    def __init__(self):
        self.api_key = settings.NEWSAPI_KEY

    async def check_disruptions(self, city: str) -> dict:
        """
        Check for social disruptions in a city.
        Returns: disruption found (bool), type, severity, confidence.
        """
        if not self.api_key:
            return self._mock_social(city)

        try:
            # Search for disruption-related news in the city
            articles = await self._fetch_news(city)
            if not articles:
                return {"disruption_found": False, "source": "newsapi"}

            # Analyze articles for disruption signals
            analysis = self._analyze_articles(articles, city)
            return analysis

        except Exception as e:
            logger.error(f"Social disruption check error: {e}")
            return self._mock_social(city)

    async def _fetch_news(self, city: str) -> list:
        """Fetch recent news articles mentioning the city + disruption keywords."""
        query_terms = f'("{city}" AND (bandh OR strike OR curfew OR shutdown OR protest))'

        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query_terms,
                    "from": (datetime.now() - timedelta(hours=24)).isoformat(),
                    "language": "en",
                    "sortBy": "publishedAt",
                    "pageSize": 20,
                    "apiKey": self.api_key,
                },
                timeout=10.0,
            )
            data = response.json()

        return data.get("articles", [])

    def _analyze_articles(self, articles: list, city: str) -> dict:
        """
        NLP analysis of news articles to determine:
        - Is there a disruption?
        - What type (bandh/strike/curfew)?
        - What severity?
        - Confidence score
        """
        signals = {
            "bandh_count": 0,
            "strike_count": 0,
            "curfew_count": 0,
            "total_articles": len(articles),
            "severity": "none",
        }

        for article in articles:
            text = f"{article.get('title', '')} {article.get('description', '')}".lower()

            for keyword in DISRUPTION_KEYWORDS["bandh"]:
                if keyword in text:
                    signals["bandh_count"] += 1
            for keyword in DISRUPTION_KEYWORDS["curfew"]:
                if keyword in text:
                    signals["curfew_count"] += 1
            for keyword in DISRUPTION_KEYWORDS["strike"]:
                if keyword in text:
                    signals["strike_count"] += 1

            # Check severity
            for indicator in SEVERITY_INDICATORS["high"]:
                if indicator in text:
                    signals["severity"] = "high"
            if signals["severity"] == "none":
                for indicator in SEVERITY_INDICATORS["medium"]:
                    if indicator in text:
                        signals["severity"] = "medium"

        # Determine if disruption is confirmed
        total_mentions = signals["bandh_count"] + signals["strike_count"] + signals["curfew_count"]
        confidence = min(total_mentions / max(len(articles), 1), 1.0)

        if total_mentions >= 3 and confidence >= 0.3:
            disruption_type = "bandh" if signals["bandh_count"] > signals["strike_count"] else "strike"
            if signals["curfew_count"] > 0:
                disruption_type = "curfew"

            return {
                "disruption_found": True,
                "type": disruption_type,
                "severity": signals["severity"] or "low",
                "confidence": round(confidence, 2),
                "articles_analyzed": len(articles),
                "mentions": total_mentions,
                "source": "newsapi_nlp",
            }

        return {"disruption_found": False, "confidence": round(confidence, 2), "source": "newsapi_nlp"}

    def _mock_social(self, city: str) -> dict:
        """Mock social disruption data."""
        return {
            "disruption_found": False,
            "type": None,
            "severity": "none",
            "confidence": 0.0,
            "source": "mock",
        }
