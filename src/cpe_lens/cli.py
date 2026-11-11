from __future__ import annotations

import argparse
import contextlib
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

from cpe_lens.config import Settings


def _project_root() -> Path:
    candidates = [Path.cwd(), Path(__file__).resolve().parents[2]]
    for candidate in candidates:
        if (candidate / "pyproject.toml").is_file() and (candidate / "frontend").is_dir():
            return candidate
    return Path.cwd()


def _npm() -> str:
    npm = shutil.which("npm")
    if npm is None:
        print("npm was not found. Install Node.js 20 or newer to run the frontend.", file=sys.stderr)
        raise SystemExit(127)
    return npm


def _run(command: list[str], *, cwd: Path, env: dict[str, str] | None = None) -> int:
    print(f"$ {' '.join(command)}", flush=True)
    completed = subprocess.run(command, cwd=cwd, env=env, check=False)
    return completed.returncode


def _ensure_frontend_dependencies(root: Path) -> None:
    frontend = root / "frontend"
    if (frontend / "node_modules").is_dir():
        return
    print("Installing frontend dependencies (first run)...", flush=True)
    code = _run([_npm(), "install"], cwd=frontend)
    if code != 0:
        raise SystemExit(code)


def _frontend_sources(frontend: Path) -> list[Path]:
    sources = [
        frontend / "index.html",
        frontend / "package.json",
        frontend / "package-lock.json",
        frontend / "vite.config.ts",
        frontend / "tailwind.config.js",
        frontend / "postcss.config.js",
        frontend / "tsconfig.json",
        frontend / "tsconfig.app.json",
        frontend / "tsconfig.node.json",
    ]
    sources.extend(path for path in (frontend / "src").rglob("*") if path.is_file())
    return sources


def _frontend_build_is_stale(frontend: Path) -> bool:
    index = frontend / "dist" / "index.html"
    if not index.is_file():
        return True
    built_at = index.stat().st_mtime
    return any(source.stat().st_mtime > built_at for source in _frontend_sources(frontend) if source.exists())


def _build_frontend(root: Path) -> None:
    frontend = root / "frontend"
    _ensure_frontend_dependencies(root)
    if not _frontend_build_is_stale(frontend):
        return
    print("Building frontend...", flush=True)
    code = _run([_npm(), "run", "build"], cwd=frontend)
    if code != 0:
        raise SystemExit(code)


def _signal_group(process: subprocess.Popen[bytes], sig: signal.Signals) -> None:
    with contextlib.suppress(ProcessLookupError, PermissionError):
        os.killpg(os.getpgid(process.pid), sig)


def _stop(processes: list[subprocess.Popen[bytes]]) -> None:
    for process in processes:
        if process.poll() is None:
            _signal_group(process, signal.SIGTERM)
    deadline = time.monotonic() + 5
    for process in processes:
        remaining = max(0.0, deadline - time.monotonic())
        try:
            process.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            _signal_group(process, signal.SIGKILL)
            with contextlib.suppress(subprocess.TimeoutExpired):
                process.wait(timeout=2)


def dev(argv: list[str] | None = None) -> int:
    settings = Settings()
    parser = argparse.ArgumentParser(description="Run CPE Lens in development mode")
    parser.add_argument("--host", default=settings.host)
    parser.add_argument("--port", type=int, default=settings.port)
    parser.add_argument("--no-frontend", action="store_true", help="Run only the FastAPI backend")
    args = parser.parse_args(argv)

    root = _project_root()
    api_url = f"http://{args.host}:{args.port}"
    env = os.environ.copy()
    env["VITE_API_PROXY"] = api_url
    env["CPE_LENS_HOST"] = args.host
    env["CPE_LENS_PORT"] = str(args.port)
    processes: list[subprocess.Popen[bytes]] = []
    try:
        backend = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "cpe_lens.main:create_app",
                "--factory",
                "--host",
                args.host,
                "--port",
                str(args.port),
                "--reload",
                "--reload-dir",
                str(root / "src"),
            ],
            cwd=root,
            env=env,
            start_new_session=True,
        )
        processes.append(backend)
        print(f"API: {api_url}", flush=True)
        if not args.no_frontend:
            _ensure_frontend_dependencies(root)
            frontend = subprocess.Popen(
                [_npm(), "run", "dev"],
                cwd=root / "frontend",
                env=env,
                start_new_session=True,
            )
            processes.append(frontend)
            print("UI:  http://127.0.0.1:5173", flush=True)
        while True:
            for process in processes:
                code = process.poll()
                if code is not None:
                    return code
            time.sleep(0.5)
    except KeyboardInterrupt:
        return 0
    finally:
        _stop(processes)


def start(argv: list[str] | None = None) -> int:
    settings = Settings()
    parser = argparse.ArgumentParser(description="Run CPE Lens")
    parser.add_argument("--host", default=settings.host)
    parser.add_argument("--port", type=int, default=settings.port)
    parser.add_argument("--build", action="store_true", help="Build the frontend first (requires Node.js)")
    args = parser.parse_args(argv)

    root = _project_root()
    if args.build:
        _build_frontend(root)
    dist = root / "frontend" / "dist"
    if not (dist / "index.html").is_file():
        print(
            "Frontend build is missing. Run `python -m cpe_lens start --build` on a machine with Node.js, "
            "or copy a built frontend/dist directory into the project.",
            file=sys.stderr,
        )
        return 1

    os.chdir(root)
    os.environ["CPE_LENS_FRONTEND_DIST"] = str(dist)
    os.environ["CPE_LENS_HOST"] = args.host
    os.environ["CPE_LENS_PORT"] = str(args.port)

    import uvicorn

    print(f"CPE Lens: http://{args.host}:{args.port}", flush=True)
    uvicorn.run(
        "cpe_lens.main:create_app",
        factory=True,
        host=args.host,
        port=args.port,
        log_level=settings.log_level.lower(),
    )
    return 0


def test(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run CPE Lens tests")
    parser.add_argument("--backend-only", action="store_true")
    parser.add_argument("--frontend-only", action="store_true")
    args = parser.parse_args(argv)
    if args.backend_only and args.frontend_only:
        parser.error("--backend-only and --frontend-only are mutually exclusive")

    root = _project_root()
    if not args.frontend_only:
        code = _run([sys.executable, "-m", "pytest"], cwd=root)
        if code != 0:
            return code
    if not args.backend_only:
        _ensure_frontend_dependencies(root)
        code = _run([_npm(), "run", "test"], cwd=root / "frontend")
        if code != 0:
            return code
        code = _run([_npm(), "run", "typecheck"], cwd=root / "frontend")
        if code != 0:
            return code
    return 0


def lint(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Lint the CPE Lens backend")
    parser.parse_args(argv)
    root = _project_root()
    code = _run([sys.executable, "-m", "ruff", "check", "src", "tests"], cwd=root)
    if code != 0:
        return code
    return _run([sys.executable, "-m", "ruff", "format", "--check", "src", "tests"], cwd=root)


def typecheck(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Type-check backend and frontend")
    parser.parse_args(argv)
    root = _project_root()
    code = _run([sys.executable, "-m", "mypy"], cwd=root)
    if code != 0:
        return code
    _ensure_frontend_dependencies(root)
    return _run([_npm(), "run", "typecheck"], cwd=root / "frontend")
