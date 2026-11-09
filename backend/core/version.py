from __future__ import annotations

import os
import subprocess

from django.conf import settings

from core.version_generated import APP_VERSION


def _run_git(*args: str) -> str:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=settings.BASE_DIR,
            capture_output=True,
            check=True,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.SubprocessError):
        return ""

    return result.stdout.strip()


def _resolve_commit() -> str:
    for name in ("RENDER_GIT_COMMIT", "GITHUB_SHA", "GIT_COMMIT_SHA"):
        value = os.environ.get(name)
        if value:
            return value.strip()

    return _run_git("rev-parse", "HEAD")


def _resolve_branch() -> str:
    for name in ("RENDER_GIT_BRANCH", "GITHUB_HEAD_REF", "GITHUB_REF_NAME"):
        value = os.environ.get(name)
        if value:
            return value.strip()

    return _run_git("rev-parse", "--abbrev-ref", "HEAD")


def _resolve_environment() -> str:
    if os.environ.get("RENDER"):
        return (
            "preview"
            if os.environ.get("IS_PULL_REQUEST") == "true"
            else "production"
        )

    vercel_environment = os.environ.get("VERCEL_ENV")
    if vercel_environment:
        return vercel_environment.strip()

    if os.environ.get("GITHUB_ACTIONS") == "true":
        return "ci"

    if settings.DEBUG:
        return "development"

    return "local"


def get_build_info() -> dict[str, str]:
    commit = _resolve_commit()
    commit_short = commit[:7] if commit else "dev"

    return {
        "service": "civen-backend",
        "version": APP_VERSION,
        "tag": f"v{APP_VERSION}",
        "commit": commit_short,
        "commit_full": commit,
        "branch": _resolve_branch(),
        "environment": _resolve_environment(),
    }
