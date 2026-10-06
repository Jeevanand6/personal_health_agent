import re
import uuid
from typing import Any, Dict, List, Optional, Tuple
from app.models.chat_session import ChatMessage
from app.core.logging import logger


class QueryRouteMode:
    GENERAL = "general"
    PERSONAL_HEALTH = "personal_health"
    MIXED_HEALTH = "mixed_health"
    CURRENT_WEB = "current_web"
    DOCUMENT_SPECIFIC = "document_specific"


class QueryRouteResult:
    def __init__(
        self,
        mode: str,
        intent: str,
        target_entity: Optional[str] = None,
        is_follow_up: bool = False,
        follow_up_context: Optional[str] = None,
        raw_question: str = "",
    ):
        self.mode = mode
        self.intent = intent
        self.target_entity = target_entity
        self.is_follow_up = is_follow_up
        self.follow_up_context = follow_up_context
        self.raw_question = raw_question

    def __repr__(self) -> str:
        return (
            f"<QueryRouteResult mode={self.mode} intent={self.intent} "
            f"entity={self.target_entity} follow_up={self.is_follow_up}>"
        )


class QueryRouter:
    """
    Lightweight, deterministic Query Router executed BEFORE health-data retrieval.
    Classifies user messages into:
    - GENERAL: Direct LLM response (zero health document retrieval).
    - PERSONAL_HEALTH: Authenticated user health records + documents.
    - MIXED_HEALTH: User health records + general medical knowledge.
    - CURRENT_WEB: Live web/weather/current events + LLM.
    - DOCUMENT_SPECIFIC: Strictly scoped to an authorized selected document.
    """

    # Common lab test terms
    LAB_TERMS = [
        "hb", "hemoglobin", "glucose", "sugar", "fbs", "ppbs", "hba1c", "a1c",
        "creatinine", "cholesterol", "lipid", "ldl", "hdl", "triglyceride",
        "platelet", "wbc", "rbc", "blood pressure", "bp", "systolic", "diastolic",
        "thyroid", "tsh", "uric acid", "bilirubin", "sgot", "sgpt", "alt", "ast"
    ]

    # Common medication candidate keywords
    MED_KEYWORDS = [
        "paracetamol", "azithromycin", "metformin", "amlodipine", "telmisartan",
        "atorvastatin", "pantoprazole", "amoxicillin", "cetirizine", "aspirin",
        "insulin", "ibuprofen", "omeprazole", "iron", "iron tablets", "calcium",
        "vitamin", "multivitamin", "antibiotic"
    ]

    def _extract_recent_entities(
        self, recent_messages: Optional[List[ChatMessage]]
    ) -> Dict[str, Any]:
        """
        Inspects recent conversation turns to extract context for follow-up resolution.
        """
        result: Dict[str, Any] = {
            "last_user_query": None,
            "last_assistant_reply": None,
            "mentioned_tests": [],
            "mentioned_meds": [],
            "had_doctor": False,
            "had_health_context": False,
        }

        if not recent_messages:
            return result

        # Look at the last assistant and user messages
        for msg in reversed(recent_messages):
            txt = (msg.content or "").lower()
            if msg.role == "assistant" and not result["last_assistant_reply"]:
                result["last_assistant_reply"] = msg.content
                for t in self.LAB_TERMS:
                    if re.search(rf"\b{re.escape(t)}\b", txt):
                        result["mentioned_tests"].append(t)
                        result["had_health_context"] = True
                for m in self.MED_KEYWORDS:
                    if re.search(rf"\b{re.escape(m)}\b", txt):
                        result["mentioned_meds"].append(m)
                        result["had_health_context"] = True
                if "doctor" in txt or "dr." in txt or "dr " in txt or "clinic" in txt or "hospital" in txt:
                    result["had_doctor"] = True
                    result["had_health_context"] = True
                if "prescription" in txt or "prescribed" in txt or "dose" in txt:
                    result["had_health_context"] = True

            elif msg.role == "user" and not result["last_user_query"]:
                result["last_user_query"] = msg.content
                for t in self.LAB_TERMS:
                    if re.search(rf"\b{re.escape(t)}\b", txt):
                        result["mentioned_tests"].append(t)
                        result["had_health_context"] = True
                for m in self.MED_KEYWORDS:
                    if re.search(rf"\b{re.escape(m)}\b", txt):
                        result["mentioned_meds"].append(m)
                        result["had_health_context"] = True

        return result

    def route(
        self,
        question: str,
        document_id: Optional[uuid.UUID] = None,
        recent_messages: Optional[List[ChatMessage]] = None,
    ) -> QueryRouteResult:
        """
        Classifies incoming user question into one of the 5 architectural routes.
        """
        q = question.strip()
        q_lower = q.lower()
        recent_meta = self._extract_recent_entities(recent_messages)

        # -------------------------------------------------------------
        # ROUTE 1: DOCUMENT_SPECIFIC
        # -------------------------------------------------------------
        if document_id is not None:
            return QueryRouteResult(
                mode=QueryRouteMode.DOCUMENT_SPECIFIC,
                intent="DOCUMENT_SPECIFIC_ACTIVE",
                raw_question=q,
            )

        # Check explicit document-specific phrases when not explicitly selected
        explicit_doc_triggers = [
            "what does this prescription say",
            "what does this document say",
            "what is written in this document",
            "what does this report say",
            "summarize this document",
            "summarize this prescription",
            "explain this prescription",
            "explain this report",
            "explain this document",
            "இந்த மருந்துச் சீட்டு என்ன சொல்கிறது",
            "இந்த ஆவணத்தை விளக்கவும்",
        ]
        if any(t in q_lower for t in explicit_doc_triggers):
            return QueryRouteResult(
                mode=QueryRouteMode.DOCUMENT_SPECIFIC,
                intent="DOCUMENT_EXPLICIT_REFERENCE",
                raw_question=q,
            )

        # -------------------------------------------------------------
        # ROUTE 2: CURRENT_WEB (Weather, News, Live Data)
        # -------------------------------------------------------------
        weather_triggers = [
            "weather", "temperature", "forecast", "climate", "is it raining",
            "how hot is it", "வானிலை", "மழை", "வெப்பநிலை"
        ]
        is_weather_q = any(w in q_lower for w in weather_triggers)

        current_info_triggers = [
            "latest news", "breaking news", "current events", "what happened today",
            "today's news", "latest score", "live score", "ipl score", "match score",
            "current gold rate", "gold price today", "stock price today", "bitcoin price",
            "latest covid guidance", "current covid guidance", "latest medical guidelines",
            "current government rules", "latest guidelines"
        ]
        is_current_info_q = any(c in q_lower for c in current_info_triggers)

        if is_weather_q:
            return QueryRouteResult(
                mode=QueryRouteMode.CURRENT_WEB,
                intent="WEATHER",
                raw_question=q,
            )

        if is_current_info_q:
            return QueryRouteResult(
                mode=QueryRouteMode.CURRENT_WEB,
                intent="CURRENT_INFORMATION",
                raw_question=q,
            )

        # -------------------------------------------------------------
        # ROUTE 3: MULTI-TURN FOLLOW-UP RESOLUTION
        # -------------------------------------------------------------
        follow_up_phrases = [
            "what does that mean", "what does this mean", "what does it mean",
            "what do that mean", "what does that indicate",
            "is that normal", "is that high", "is that low", "is that dangerous",
            "is that bad", "is that okay", "is that safe",
            "why is that", "why is it", "why", "what causes that", "what caused that",
            "what should i do about that", "what should i do",
            "how long should i take it", "when should i take it",
            "who prescribed it", "who gave it", "which doctor was that",
            "அதன் பொருள் என்ன", "அது இயல்பானதா", "நான் என்ன செய்ய வேண்டும்"
        ]
        is_follow_up_phrase = any(fp in q_lower for fp in follow_up_phrases) or (
            len(q.split()) <= 4 and any(p in q_lower for p in ["that", "this", "it", "why"])
        )

        if is_follow_up_phrase and recent_meta["had_health_context"]:
            # Follow-up referencing health records previously discussed!
            target = None
            if recent_meta["mentioned_tests"]:
                target = recent_meta["mentioned_tests"][0]
            elif recent_meta["mentioned_meds"]:
                target = recent_meta["mentioned_meds"][0]

            return QueryRouteResult(
                mode=QueryRouteMode.MIXED_HEALTH,
                intent="FOLLOW_UP_INTERPRETATION",
                target_entity=target,
                is_follow_up=True,
                follow_up_context=recent_meta["last_assistant_reply"],
                raw_question=q,
            )

        # -------------------------------------------------------------
        # ROUTE 4: MIXED_HEALTH (Personal Record + General Explanation)
        # -------------------------------------------------------------
        # Pattern A: "What does my Hb / glucose / [test] mean?"
        # Pattern B: "Is my medicine commonly used for [condition]?"
        # Pattern C: "My doctor prescribed iron tablets. Why are they used?"
        # Pattern D: "What should I discuss with my doctor?"
        # Pattern E: "Explain my prescription"
        has_personal_anchor = any(
            p in q_lower for p in [
                "my", "i", "mine", "me", "prescribed to me", "my doctor",
                "my prescription", "my report", "my result", "my test",
                "எனது", "என்", "எனக்கு"
            ]
        )

        is_interpretive = any(
            w in q_lower for w in [
                "mean", "indicate", "explain", "why is", "why was", "why are",
                "commonly used", "used for", "how does it work", "purpose of",
                "discuss with my doctor", "what should i ask", "விளக்கவும்", "பொருள்"
            ]
        )

        has_lab_word = any(t in q_lower for t in self.LAB_TERMS)
        has_med_word = any(
            m in q_lower for m in self.MED_KEYWORDS + ["medicine", "medication", "drug", "tablet", "tab", "cap"]
        )

        # Check for explicit mixed questions:
        if has_personal_anchor and is_interpretive and (has_lab_word or has_med_word):
            target = None
            for t in self.LAB_TERMS:
                if re.search(rf"\b{re.escape(t)}\b", q_lower):
                    target = t
                    break
            if not target:
                for m in self.MED_KEYWORDS:
                    if re.search(rf"\b{re.escape(m)}\b", q_lower):
                        target = m
                        break

            return QueryRouteResult(
                mode=QueryRouteMode.MIXED_HEALTH,
                intent="PERSONAL_RECORD_INTERPRETATION",
                target_entity=target,
                raw_question=q,
            )

        # "Explain my prescription" / "Explain my lab report"
        if has_personal_anchor and any(w in q_lower for w in ["explain", "summary", "summarize", "understand"]):
            if "prescription" in q_lower or "மருந்துச் சீட்டு" in q_lower or "report" in q_lower:
                return QueryRouteResult(
                    mode=QueryRouteMode.MIXED_HEALTH,
                    intent="PRESCRIPTION_OR_REPORT_EXPLANATION",
                    raw_question=q,
                )

        # -------------------------------------------------------------
        # ROUTE 5: PERSONAL_HEALTH (Direct record retrieval)
        # -------------------------------------------------------------
        personal_health_triggers = [
            "what medicines did my doctor prescribe",
            "what medicines did i take",
            "what did my doctor prescribe",
            "medicines did my doctor prescribe",
            "list my medicines", "show my medicines", "my medications",
            "what was my hb", "what is my hb", "what is my latest hb",
            "what was my blood sugar", "what is my glucose", "what is my hba1c",
            "what did my prescription say", "what does my prescription say",
            "show my health timeline", "show my timeline", "my timeline",
            "my health history", "my medical history", "past visits",
            "what abnormalities were found in my reports", "abnormalities in my reports",
            "which values are abnormal", "show abnormal results", "my abnormal tests",
            "who is my doctor", "what is my doctor's name", "who treated me",
            "which doctor prescribed this", "who wrote this prescription",
            "when was my visit", "when was my report", "date of my prescription",
            "what was my diagnosis", "what did the doctor diagnose me with",
            "what was my dosage", "what is my dose of",
            "மருத்துவர் யார்", "எனது மருந்துகள்", "எனது Hb அளவு", "மாறுபட்ட முடிவுகள்"
        ]

        if any(p in q_lower for p in personal_health_triggers):
            # Resolve specific intent
            intent = "PERSONAL_HEALTH_RECORDS"
            target = None
            if any(w in q_lower for w in ["medicine", "medication", "drug", "tablet", "tab", "cap"]):
                intent = "MEDICATION"
            elif any(w in q_lower for w in ["doctor", "physician", "clinic", "who treated", "who saw"]):
                intent = "DOCTOR"
            elif any(w in q_lower for w in ["timeline", "history", "chronology", "past visits"]):
                intent = "TIMELINE"
            elif any(w in q_lower for w in ["abnormal", "high", "low", "out of range"]):
                intent = "ABNORMAL_RESULT"
            elif any(w in q_lower for w in ["prescribe", "prescription"]):
                intent = "MEDICATION"
            elif any(w in q_lower for w in ["diagnosis", "diagnose", "condition"]):
                intent = "DIAGNOSIS"
            elif any(w in q_lower for w in ["date", "when was", "visit"]):
                intent = "DATE"
            elif has_lab_word:
                intent = "LAB_RESULT"
                for t in self.LAB_TERMS:
                    if re.search(rf"\b{re.escape(t)}\b", q_lower):
                        target = t
                        break

            return QueryRouteResult(
                mode=QueryRouteMode.PERSONAL_HEALTH,
                intent=intent,
                target_entity=target,
                raw_question=q,
            )

        # General Personal Health with "my" + health keyword:
        # e.g., "my blood test", "my hemoglobin", "what was my creatinine", "my medicines"
        if has_personal_anchor and (has_lab_word or has_med_word or any(w in q_lower for w in ["doctor", "report", "prescription", "diagnosis"])):
            intent = "PERSONAL_HEALTH_RECORDS"
            target = None
            for t in self.LAB_TERMS:
                if re.search(rf"\b{re.escape(t)}\b", q_lower):
                    intent = "LAB_RESULT"
                    target = t
                    break
            if not target:
                for m in self.MED_KEYWORDS:
                    if re.search(rf"\b{re.escape(m)}\b", q_lower):
                        intent = "MEDICATION"
                        target = m
                        break

            return QueryRouteResult(
                mode=QueryRouteMode.PERSONAL_HEALTH,
                intent=intent,
                target_entity=target,
                raw_question=q,
            )

        # -------------------------------------------------------------
        # ROUTE 6: GENERAL (General AI Assistant — ZERO Document Retrieval)
        # -------------------------------------------------------------
        # Everything else is GENERAL!
        # Examples:
        # "What is Python?"
        # "Explain quantum computing"
        # "Who is Elon Musk?"
        # "Give me a workout plan"
        # "Explain GST"
        # "Write an email to my manager"
        # "What are the benefits of meditation?"
        # "What is diabetes?" (General disease info, NOT "my diabetes")
        # "What is paracetamol?" (General pharmacology, NOT "my medicine")
        # "How does the immune system work?"
        return QueryRouteResult(
            mode=QueryRouteMode.GENERAL,
            intent="GENERAL_KNOWLEDGE",
            raw_question=q,
        )


query_router = QueryRouter()
