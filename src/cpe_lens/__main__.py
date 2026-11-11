from __future__ import annotations

import sys
from collections.abc import Callable

from cpe_lens.cli import dev, lint, start, test, typecheck

_COMMANDS: dict[str, Callable[[list[str] | None], int]] = {
    "start": start,
    "serve": start,
    "dev": dev,
    "test": test,
    "lint": lint,
    "typecheck": typecheck,
}


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if args and args[0] in _COMMANDS:
        return _COMMANDS[args[0]](args[1:])
    return start(args)


if __name__ == "__main__":
    raise SystemExit(main())
