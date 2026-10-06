import re
import urllib.parse
from typing import Any, Dict, List, Tuple
import httpx
from app.core.logging import logger


class WebSearchHelper:
    """
    Helper for fetching real-time, live web context (weather, current guidelines, latest news).
    Used exclusively when the Query Router classifies a query as CURRENT_WEB.
    """

    async def get_live_context(self, question: str) -> Tuple[str, List[Dict[str, Any]]]:
        q_lower = question.lower()
        sources: List[Dict[str, Any]] = []

        # 1. WEATHER QUERIES
        if any(w in q_lower for w in ["weather", "temperature", "forecast", "climate", "rain", "மழை", "வானிலை"]):
            # Extract city if present
            city = "Chennai"
            words = question.strip().rstrip("?").split()
            for idx, word in enumerate(words):
                if word.lower() in ["in", "at", "for"] and idx + 1 < len(words):
                    cand = words[idx + 1].strip(".,?!")
                    if len(cand) > 2 and cand.lower() not in ["the", "my", "this", "today"]:
                        city = cand.capitalize()
                        break

            try:
                encoded_city = urllib.parse.quote(city)
                url = f"https://wttr.in/{encoded_city}?format=3"
                async with httpx.AsyncClient(timeout=4.0) as client:
                    resp = await client.get(url, headers={"User-Agent": "curl/7.68.0"})
                    if resp.status_code == 200 and resp.text.strip():
                        weather_text = resp.text.strip()
                        sources.append({
                            "document_name": f"Live Weather ({city})",
                            "source_type": "web",
                            "snippet": weather_text,
                        })
                        context = f"=== LIVE REAL-TIME WEATHER INFORMATION ===\nLocation: {city}\nCurrent Conditions: {weather_text}\n"
                        return context, sources
            except Exception as exc:
                logger.warning(f"Error fetching live weather: {exc}")

            return (
                "=== LIVE REAL-TIME WEATHER INFORMATION ===\n"
                "Real-time weather station connection timed out. Please check local meteorological reports.\n",
                sources
            )

        # 2. GENERAL CURRENT EVENTS / LATEST GUIDELINES
        try:
            clean_query = re.sub(r"[^\w\s]", "", question)[:60].strip()
            encoded_q = urllib.parse.quote_plus(clean_query)
            # Use DuckDuckGo Lite / HTML endpoint for clean text snippets
            url = f"https://html.duckduckgo.com/html/?q={encoded_q}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    # Extract snippet texts from results
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(resp.text, "html.parser")
                    snippets = []
                    for res in soup.find_all("a", class_="result__snippet")[:3]:
                        text = res.get_text(strip=True)
                        if text:
                            snippets.append(text)

                    if snippets:
                        context_body = "\n".join([f"- {s}" for s in snippets])
                        sources.append({
                            "document_name": "Live Web Search Results",
                            "source_type": "web",
                            "snippet": snippets[0][:150],
                        })
                        return f"=== LIVE REAL-TIME WEB SEARCH RESULTS ===\n{context_body}\n", sources
        except Exception as exc:
            logger.warning(f"Error fetching live web search: {exc}")

        return (
            "=== LIVE REAL-TIME WEB CONTEXT ===\n"
            "Live web search was not reachable at this moment. Answer using verified guidelines.\n",
            sources
        )


web_search_helper = WebSearchHelper()
