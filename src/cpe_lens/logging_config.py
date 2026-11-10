from __future__ import annotations

import logging


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    # huawei-lte-api emits the password at DEBUG in Connection.__init__.
    logging.getLogger("huawei_lte_api").setLevel(logging.WARNING)
