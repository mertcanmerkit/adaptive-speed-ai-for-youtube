#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import subprocess
import sys


ROOT = pathlib.Path(__file__).resolve().parents[1]
GH_PRIVACY_COMMAND = "gh repo view OWNER/REPO --json isPrivate,url,nameWithOwner"

REQUIRED_FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursor/rules/project.mdc",
    ".github/copilot-instructions.md",
    "ai-project.yaml",
    "scripts/ai_project_check.py",
    "docs/00_project_brief.md",
    "docs/01_ai_operating_model.md",
    "docs/02_session_handoff_prompt.md",
    "docs/03_validation.md",
    "docs/04_cross_ai_orchestration.md",
    "docs/05_project_adoption.md",
    "docs/06_memory_freshness.md",
    "docs/07_ai_orchestration_source_of_truth.md",
    "docs/08_product_decisions.md",
    "knowledge/README_FOR_AI.md",
    "source_of_truth/README.md",
    "work/README.md",
]

MEMORY_FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursor/rules/project.mdc",
    ".github/copilot-instructions.md",
    "ai-project.yaml",
    "docs/02_session_handoff_prompt.md",
    "docs/03_validation.md",
    "docs/06_memory_freshness.md",
    "docs/07_ai_orchestration_source_of_truth.md",
    "docs/08_product_decisions.md",
    "knowledge/README_FOR_AI.md",
    "source_of_truth/README.md",
]

EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "__pycache__",
    "node_modules",
    "vendor",
    "dist",
    "build",
    "tmp",
    "opencode",
    "min-chrome-profile",
    "min-extension",
    ".pytest_cache",
    ".ruff_cache",
}

NON_IMPLEMENTATION_FILES = {
    ".gitignore",
    "README.md",
    "scripts/ai_project_check.py",
    "artifacts/.gitkeep",
    "source_of_truth/.gitkeep",
}

SECRET_PATTERNS = [
    ("private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("AWS access key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("OpenAI-style API key", re.compile(r"sk-[A-Za-z0-9_-]{20,}")),
    (
        "credential assignment",
        re.compile(r"(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*['\"][^'\"]{12,}['\"]"),
    ),
]


def run(command: list[str]) -> tuple[int, str, str]:
    try:
        result = subprocess.run(
            command,
            cwd=ROOT,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        return 127, "", str(exc)
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def read_text(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def parse_scalar(text: str, key: str) -> str | None:
    match = re.search(rf"^\s*{re.escape(key)}:\s*['\"]?([^'\"\n#]+)", text, re.MULTILINE)
    return match.group(1).strip() if match else None


def parse_bool(text: str, key: str) -> bool | None:
    value = parse_scalar(text, key)
    if value is None:
        return None
    lowered = value.lower()
    if lowered in {"true", "yes"}:
        return True
    if lowered in {"false", "no"}:
        return False
    return None


def iter_project_files():
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        relative_parts = path.relative_to(ROOT).parts
        if any(part in EXCLUDED_DIRS for part in relative_parts):
            continue
        yield path


def github_repo_from_url(url: str) -> str | None:
    url = url.strip()
    if not url:
        return None
    ssh = re.match(r"git@github\.com:([^/]+)/(.+?)(?:\.git)?$", url)
    if ssh:
        return f"{ssh.group(1)}/{ssh.group(2)}"
    https = re.match(r"https://github\.com/([^/]+)/(.+?)(?:\.git)?/?$", url)
    if https:
        return f"{https.group(1)}/{https.group(2)}"
    return None


def check_required_files(errors: list[str]) -> None:
    for relative in REQUIRED_FILES:
        if not (ROOT / relative).is_file():
            errors.append(f"missing required file: {relative}")


def check_manifest(errors: list[str]) -> None:
    manifest_path = ROOT / "ai-project.yaml"
    if not manifest_path.is_file():
        errors.append("missing ai-project.yaml")
        return
    manifest = manifest_path.read_text(encoding="utf-8")
    for required in [
        "version:",
        "project:",
        "privacy:",
        "memory:",
        "freshness:",
        "validation:",
        "compatibility:",
        "read_order:",
        "stale_after_days:",
        "require_private_remote_verification:",
    ]:
        if required not in manifest:
            errors.append(f"ai-project.yaml missing {required}")
    if parse_bool(manifest, "public_allowed") is not False:
        errors.append("ai-project.yaml must set public_allowed: false unless public publishing is intentional")

    last_reviewed = parse_scalar(manifest, "last_reviewed")
    stale_after = parse_scalar(manifest, "stale_after_days")
    if not last_reviewed or not stale_after:
        errors.append("ai-project.yaml must include freshness.last_reviewed and stale_after_days")
        return
    try:
        reviewed_date = dt.date.fromisoformat(last_reviewed)
        stale_days = int(stale_after)
    except ValueError:
        errors.append("ai-project.yaml freshness values are invalid")
        return
    age_days = (dt.date.today() - reviewed_date).days
    if age_days > stale_days:
        errors.append(
            f"project memory is stale: last_reviewed={last_reviewed}, stale_after_days={stale_days}"
        )


def check_agent_adapters(errors: list[str]) -> None:
    ag = read_text("AGENTS.md") if (ROOT / "AGENTS.md").is_file() else ""
    if "ai-project.yaml" not in ag or "python3 scripts/ai_project_check.py" not in ag:
        errors.append("AGENTS.md must point to ai-project.yaml and scripts/ai_project_check.py")
    for relative in ["CLAUDE.md", ".cursor/rules/project.mdc", ".github/copilot-instructions.md"]:
        if (ROOT / relative).is_file() and "AGENTS.md" not in read_text(relative):
            errors.append(f"{relative} must delegate to AGENTS.md")


def check_privacy(errors: list[str], warnings: list[str]) -> None:
    manifest = read_text("ai-project.yaml") if (ROOT / "ai-project.yaml").is_file() else ""
    require_private = parse_bool(manifest, "require_private_remote_verification")
    code, stdout, _ = run(["git", "remote", "-v"])
    if code != 0 or not stdout:
        return
    repos = sorted({repo for repo in (github_repo_from_url(line.split()[1]) for line in stdout.splitlines() if len(line.split()) >= 2) if repo})
    if not repos:
        return
    for repo in repos:
        gh_code, gh_stdout, gh_stderr = run(["gh", "repo", "view", repo, "--json", "isPrivate,url,nameWithOwner"])
        if gh_code != 0:
            message = f"could not verify GitHub privacy for {repo}: {gh_stderr or gh_stdout}"
            if require_private:
                errors.append(message)
            else:
                warnings.append(message)
            continue
        try:
            payload = json.loads(gh_stdout)
        except json.JSONDecodeError:
            errors.append(f"could not parse gh privacy response for {repo}")
            continue
        if payload.get("isPrivate") is not True:
            errors.append(f"public GitHub remote blocked: {payload.get('url', repo)}")


def check_secrets(errors: list[str]) -> None:
    for path in iter_project_files():
        try:
            if path.stat().st_size > 2_000_000:
                continue
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        relative = path.relative_to(ROOT)
        for label, pattern in SECRET_PATTERNS:
            if pattern.search(text):
                errors.append(f"possible {label} in {relative}")


def check_memory_freshness(warnings: list[str]) -> None:
    memory_paths = [ROOT / relative for relative in MEMORY_FILES if (ROOT / relative).is_file()]
    if not memory_paths:
        return
    latest_memory = max(path.stat().st_mtime for path in memory_paths)
    implementation_files = []
    memory_set = {path.resolve() for path in memory_paths}
    for path in iter_project_files():
        if path.resolve() in memory_set:
            continue
        relative = path.relative_to(ROOT)
        if relative.as_posix() in NON_IMPLEMENTATION_FILES:
            continue
        if relative.parts[0] in {"docs", "knowledge", "source_of_truth", "work", "artifacts"}:
            continue
        implementation_files.append(path)
    if not implementation_files:
        return
    latest_impl = max(path.stat().st_mtime for path in implementation_files)
    if latest_impl > latest_memory:
        warnings.append(
            "implementation files are newer than key memory files; review docs/06_memory_freshness.md"
        )


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    check_required_files(errors)
    check_manifest(errors)
    check_agent_adapters(errors)
    check_privacy(errors, warnings)
    check_secrets(errors)
    check_memory_freshness(warnings)

    for warning in warnings:
        print(f"WARN: {warning}", file=sys.stderr)
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1

    print("ai project checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
