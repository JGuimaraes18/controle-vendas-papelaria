#!/usr/bin/env python3
"""Sincroniza a versão canônica do arquivo VERSION com os artefatos do projeto.

Este script altera somente campos de versão. Dependências de frontend não são
modificadas.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / "VERSION"
FRONTEND_VERSION_FILE = ROOT / "frontend" / "src" / "generated" / "version.ts"
BACKEND_VERSION_FILE = ROOT / "backend" / "core" / "version_generated.py"
PACKAGE_FILE = ROOT / "frontend" / "package.json"
PACKAGE_LOCK_FILE = ROOT / "frontend" / "package-lock.json"

SEMVER_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")


def fail(message: str) -> None:
    print(f"erro: {message}", file=sys.stderr)
    raise SystemExit(1)


def read_version() -> str:
    if not VERSION_FILE.is_file():
        fail(f"arquivo não encontrado: {VERSION_FILE}")

    version = VERSION_FILE.read_text(encoding="utf-8").strip()

    if not SEMVER_RE.fullmatch(version):
        fail(
            f"versão inválida em {VERSION_FILE.name}: {version!r}. "
            "Use o formato MAJOR.MINOR.PATCH."
        )

    return version


def write_if_changed(path: Path, content: str) -> bool:
    if path.is_file() and path.read_text(encoding="utf-8") == content:
        return False

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True


def sync_frontend_version(version: str) -> bool:
    content = (
        "// Arquivo gerado por scripts/sync_version.py. Não edite manualmente.\n"
        f'export const APP_VERSION = "{version}";\n'
    )
    return write_if_changed(FRONTEND_VERSION_FILE, content)


def sync_backend_version(version: str) -> bool:
    content = (
        "# Arquivo gerado por scripts/sync_version.py. Não edite manualmente.\n"
        f'APP_VERSION = "{version}"\n'
    )
    return write_if_changed(BACKEND_VERSION_FILE, content)


def load_json(path: Path) -> dict:
    if not path.is_file():
        fail(f"arquivo não encontrado: {path}")

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"JSON inválido em {path}: {exc}")


def dump_json(path: Path, data: dict) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def sync_package_json(version: str) -> bool:
    data = load_json(PACKAGE_FILE)
    data["version"] = version
    return write_if_changed(PACKAGE_FILE, dump_json(PACKAGE_FILE, data))


def sync_package_lock(version: str) -> bool:
    data = load_json(PACKAGE_LOCK_FILE)
    data["version"] = version

    packages = data.get("packages")
    if isinstance(packages, dict) and "" in packages:
        packages[""]["version"] = version

    return write_if_changed(PACKAGE_LOCK_FILE, dump_json(PACKAGE_LOCK_FILE, data))


def main() -> None:
    version = read_version()

    changes = []

    if sync_frontend_version(version):
        changes.append(str(FRONTEND_VERSION_FILE.relative_to(ROOT)))
    if sync_backend_version(version):
        changes.append(str(BACKEND_VERSION_FILE.relative_to(ROOT)))
    if sync_package_json(version):
        changes.append(str(PACKAGE_FILE.relative_to(ROOT)))
    if sync_package_lock(version):
        changes.append(str(PACKAGE_LOCK_FILE.relative_to(ROOT)))

    if changes:
        print(f"Versão {version} sincronizada em:")
        for path in changes:
            print(f"  - {path}")
    else:
        print(f"Versão {version} já está sincronizada.")


if __name__ == "__main__":
    main()
