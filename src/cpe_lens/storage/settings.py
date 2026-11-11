from __future__ import annotations

import json
import logging
from typing import Any

from cpe_lens.storage.database import Database
from cpe_lens.utils import utc_now

_LOGGER = logging.getLogger(__name__)


class SettingsStore:
    """Persist only the small, numeric user-editable settings overrides."""

    def __init__(self, database: Database) -> None:
        self._database = database

    def read(self) -> dict[str, Any]:
        with self._database.connect() as connection:
            rows = connection.execute("SELECT key, value FROM app_settings").fetchall()
        values: dict[str, Any] = {}
        for row in rows:
            try:
                values[str(row["key"])] = json.loads(row["value"])
            except (TypeError, ValueError):
                _LOGGER.warning("Ignoring invalid app setting %s", row["key"])
        return values

    def replace(self, values: dict[str, Any]) -> None:
        """Replace all overrides with the supplied non-default values."""

        now = utc_now().isoformat()
        with self._database.connect() as connection:
            connection.execute("DELETE FROM app_settings")
            for key, value in values.items():
                connection.execute(
                    "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)",
                    (key, json.dumps(value), now),
                )

    def clear(self) -> None:
        with self._database.connect() as connection:
            connection.execute("DELETE FROM app_settings")
