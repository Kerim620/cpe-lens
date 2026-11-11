#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"

PYTHON=${PYTHON:-python3}
if [ ! -x .venv/bin/python ]; then
    echo "Creating local Python environment..."
    "$PYTHON" -m venv .venv
fi
PY=.venv/bin/python
if ! "$PY" -m pip --version >/dev/null 2>&1; then
    "$PY" -m ensurepip --upgrade
fi

if [ ! -f .venv/.cpe-lens-installed ] || [ pyproject.toml -nt .venv/.cpe-lens-installed ]; then
    "$PY" -m pip install --disable-pip-version-check -q -e .
    touch .venv/.cpe-lens-installed
fi
exec "$PY" -m cpe_lens start "$@"
