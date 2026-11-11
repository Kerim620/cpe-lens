from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from cpe_lens.models.controls import (
    OperationLogEntry,
    OperationStatus,
    RiskLevel,
    VerificationStatus,
)
from cpe_lens.storage.database import Database
from cpe_lens.utils import utc_now


def _iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


class OperationStore:
    """Persists operation metadata; authentication secrets are never accepted.

    Wi-Fi passwords, APN passwords, SMS bodies and tokens must be removed by the
    caller before data reaches this class.
    """

    def __init__(self, database: Database) -> None:
        self._database = database

    def record(
        self,
        *,
        action: str,
        title_key: str,
        risk: RiskLevel,
        status: OperationStatus,
        verification: VerificationStatus,
        capability_ids: list[str],
        current: dict[str, Any],
        proposed: dict[str, Any],
        message_key: str,
        device_model: str | None,
        created_at: datetime | None = None,
    ) -> int:
        with self._database.connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO operation_logs (
                    created_at, action, title_key, risk, status, verification,
                    capability_ids_json, current_json, proposed_json, message_key, device_model
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    _iso(created_at or utc_now()),
                    action,
                    title_key,
                    risk.value,
                    status.value,
                    verification.value,
                    json.dumps(capability_ids, ensure_ascii=False),
                    json.dumps(current, ensure_ascii=False),
                    json.dumps(proposed, ensure_ascii=False),
                    message_key,
                    device_model,
                ),
            )
            return int(cursor.lastrowid or 0)

    def list_recent(self, limit: int = 50) -> list[OperationLogEntry]:
        with self._database.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM operation_logs ORDER BY id DESC LIMIT ?",
                (max(1, min(limit, 200)),),
            ).fetchall()
        entries: list[OperationLogEntry] = []
        for row in rows:
            entries.append(
                OperationLogEntry(
                    id=int(row["id"]),
                    created_at=datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00")),
                    action=str(row["action"]),
                    title_key=str(row["title_key"]),
                    risk=RiskLevel(str(row["risk"])),
                    status=OperationStatus(str(row["status"])),
                    verification=VerificationStatus(str(row["verification"])),
                    capability_ids=json.loads(row["capability_ids_json"]),
                    current=json.loads(row["current_json"]),
                    proposed=json.loads(row["proposed_json"]),
                    message_key=str(row["message_key"]),
                    device_model=row["device_model"],
                )
            )
        return entries
