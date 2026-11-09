#!/usr/bin/env python3
"""Valida a consistência da versão canônica e dos artefatos gerados."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / "VERSION"
CHANGELOG_FILE = ROOT / "CHANGELOG.md"
FRONTEND_VERSION_FILE = ROOT / "frontend" / "src" / "generated" / "version.ts"
BACKEND_VERSION_FILE = ROOT / "backend" / "core" / "version_generated.py"
PACKAGE_FILE = ROOT / "frontend" / "package.json"
PACKAGE_LOCK_FILE = ROOT / "frontend" / "package-lock.json"

SEMVER_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")

errors: list[str] = []


def check(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def read_version() -> str | None:
    if not VERSION_FILE.is_file():
        errors.append(f"arquivo não encontrado: {VERSION_FILE.relative_to(ROOT)}")
        return None

    version = VERSION_FILE.read_text(encoding="utf-8").strip()

    if not SEMVER_RE.fullmatch(version):
        errors.append(
            f"{VERSION_FILE.name}: versão inválida {version!r}; "
            "use o formato MAJOR.MINOR.PATCH"
        )
        return None

    return version


def check_generated_file(path: Path, expected: str, label: str) -> None:
    if not path.is_file():
        errors.append(f"{label}: arquivo não encontrado ({path.relative_to(ROOT)})")
        return

    actual = path.read_text(encoding="utf-8")
    check(actual == expected, f"{label}: conteúdo divergente de VERSION")


def check_package_json(version: str) -> None:
    if not PACKAGE_FILE.is_file():
        errors.append("package.json: arquivo não encontrado")
        return

    try:
        data = json.loads(PACKAGE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"package.json: JSON inválido ({exc})")
        return

    check(
        data.get("version") == version,
        f"package.json: version={data.get('version')!r}, esperado {version!r}",
    )


def check_package_lock(version: str) -> None:
    if not PACKAGE_LOCK_FILE.is_file():
        errors.append("package-lock.json: arquivo não encontrado")
        return

    try:
        data = json.loads(PACKAGE_LOCK_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"package-lock.json: JSON inválido ({exc})")
        return

    check(
        data.get("version") == version,
        f"package-lock.json: version={data.get('version')!r}, "
        f"esperado {version!r}",
    )

    packages = data.get("packages")
    if isinstance(packages, dict) and "" in packages:
        check(
            packages[""].get("version") == version,
            "package-lock.json: packages[\"\"].version divergente de VERSION",
        )


def check_changelog(version: str) -> None:
    if not CHANGELOG_FILE.is_file():
        errors.append("CHANGELOG.md: arquivo não encontrado")
        return

    content = CHANGELOG_FILE.read_text(encoding="utf-8")
    check(
        re.search(rf"^## \[{re.escape(version)}\]", content, re.MULTILINE) is not None,
        f"CHANGELOG.md: seção '## [{version}]' não encontrada",
    )


def check_tag(version: str) -> None:
    ref = os.environ.get("GITHUB_REF", "")
    ref_name = os.environ.get("GITHUB_REF_NAME", "")
    ref_type = os.environ.get("GITHUB_REF_TYPE", "")

    is_tag = ref.startswith("refs/tags/") or ref_type == "tag"
    if not is_tag:
        return

    tag = ref_name or ref.removeprefix("refs/tags/")
    expected = f"v{version}"
    check(
        tag == expected,
        f"tag Git: {tag!r} divergente da versão do VERSION ({expected!r})",
    )


def main() -> None:
    version = read_version()

    if version is not None:
        check_generated_file(
            FRONTEND_VERSION_FILE,
            (
                "// Arquivo gerado por scripts/sync_version.py. "
                "Não edite manualmente.\n"
                f'export const APP_VERSION = "{version}";\n'
            ),
            "frontend/src/generated/version.ts",
        )
        check_generated_file(
            BACKEND_VERSION_FILE,
            (
                "# Arquivo gerado por scripts/sync_version.py. "
                "Não edite manualmente.\n"
                f'APP_VERSION = "{version}"\n'
            ),
            "backend/core/version_generated.py",
        )
        check_package_json(version)
        check_package_lock(version)
        check_changelog(version)
        check_tag(version)

    if errors:
        print("Falha na validação de versão:", file=sys.stderr)
        for message in errors:
            print(f"  - {message}", file=sys.stderr)
        raise SystemExit(1)

    print(f"Versão {version} consistente em todos os artefatos.")


if __name__ == "__main__":
    main()
