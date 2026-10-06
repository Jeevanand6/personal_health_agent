import uuid
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.audit_log import AuditLog
from app.core.logging import audit_logger, logger, redact_sensitive_data


class AuditEventType(str, Enum):
    LOGIN = "LOGIN"
    DOCUMENT_UPLOAD = "DOCUMENT_UPLOAD"
    DOCUMENT_VIEW = "DOCUMENT_VIEW"
    DOCUMENT_DELETE = "DOCUMENT_DELETE"
    AI_PROCESSING = "AI_PROCESSING"
    DATA_EXPORT = "DATA_EXPORT"


class AuditService:
    """
    Centralized service for compliance and security audit logging.
    Records events to both the dedicated audit logger stream and the audit_logs database table.
    Guarantees no sensitive data (passwords, JWTs, API keys, medical document text) is ever recorded.
    """

    def _sanitize_details(self, details: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Strips or redacts any sensitive keys from audit event details."""
        if not details:
            return {}

        safe_dict = {}
        for k, v in details.items():
            k_lower = str(k).lower()
            if any(term in k_lower for term in ["password", "token", "secret", "api_key", "raw_text", "cleaned_text"]):
                continue  # Never include passwords, tokens, API keys, or raw text in audit logs
            safe_dict[k] = redact_sensitive_data(v)
        return safe_dict

    def log_event(
        self,
        db: Session,
        event_type: Union[AuditEventType, str],
        status: str = "SUCCESS",
        user_id: Optional[uuid.UUID] = None,
        resource_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> Optional[AuditLog]:
        """
        Records a security audit event to the audit log stream and the database.
        """
        ev_type_str = event_type.value if isinstance(event_type, AuditEventType) else str(event_type)
        safe_details = self._sanitize_details(details)

        # 1. Structured log stream entry
        audit_logger.info(
            f"EVENT={ev_type_str} | STATUS={status} | USER={user_id or 'anonymous'} | "
            f"RESOURCE={resource_id or 'none'} | IP={ip_address or 'unknown'} | "
            f"DETAILS={safe_details}"
        )

        # 2. Database record persistence
        try:
            audit_record = AuditLog(
                user_id=user_id,
                event_type=ev_type_str,
                status=status.upper(),
                resource_id=str(resource_id) if resource_id else None,
                ip_address=ip_address,
                user_agent=(user_agent[:255] if user_agent else None),
                details=safe_details,
            )
            db.add(audit_record)
            db.commit()
            db.refresh(audit_record)
            return audit_record
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to persist audit log to database: {exc}")
            return None

    def get_user_audit_logs(
        self,
        db: Session,
        user_id: uuid.UUID,
        limit: int = 50,
    ) -> List[AuditLog]:
        """Retrieves recent audit logs for a specific authenticated user."""
        return (
            db.query(AuditLog)
            .filter(AuditLog.user_id == user_id)
            .order_by(desc(AuditLog.created_at))
            .limit(limit)
            .all()
        )


audit_service = AuditService()
