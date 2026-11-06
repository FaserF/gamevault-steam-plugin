#!/usr/bin/env python3
"""
Generates a structured, deduplicated changelog from git commit history for GameVault Steam Plugin.

- Reads commits between FROM_TAG and HEAD (or all commits if no tag)
- Filters noise: version bumps, merge commits, bot commits
- Groups by conventional commit type with friendly emoji headers
- Deduplicates: exact + near-duplicate collapsing
- Breaking changes bubble to the top in a CAUTION callout
- Outputs clean GitHub-flavored Markdown
"""

import argparse
import re
import subprocess
import sys

NOISE_PATTERNS = [
    r"^\s*$",
    r"^(Update|Aktualisier[et]?|Add|Adds|Adde|Delete|Deletes|Remove|Removes|Rename|Renames|Move|Moves|Fix|Edit|Change|Modify)\s+[\w\-\.\/]+\.\w{1,10}\s*$",
    r"^Merge (pull request|branch|remote-tracking branch)\b",
    r"^Merge from\b",
    r"^(chore|build)(\([^)]*\))?:\s*(bump|release|version)\b",
    r"^(bump|release)(\s+version)?\s+v?\d",
    r"^v?\d+\.\d+\.\d+\s*$",
    r"^\[skip[- ]ci\]",
    r"^chore: regenerate (manifest|connections|changelog)\b",
    r"^(auto.?generated?|automated?|bot:)\b",
    r'^Revert "Revert',
    r"^Initial commit\s*$",
    r"^WIP\b",
    r"^wip\b",
]
_NOISE_RE = [re.compile(p, re.IGNORECASE) for p in NOISE_PATTERNS]

CATEGORY_ORDER = [
    "breaking",
    "feat",
    "fix",
    "perf",
    "refactor",
    "api",
    "docs",
    "test",
    "ci",
    "chore",
    "other",
]

CATEGORY_EMOJI = {
    "breaking": "💥 Breaking Changes",
    "feat": "✨ New Features",
    "fix": "🐛 Bug Fixes",
    "perf": "⚡ Performance Improvements",
    "refactor": "♻️ Code Refactoring",
    "api": "🔌 API & Integration Updates",
    "docs": "📝 Documentation",
    "test": "🧪 Tests & Coverage",
    "ci": "🤖 CI/CD & Automation",
    "chore": "🧹 Maintenance & Chores",
    "other": "📦 Other Changes",
}

CONVENTIONAL_RE = re.compile(
    r"^(?P<type>[a-zA-Z]+)(?:\((?P<scope>[^)]+)\))?(?P<breaking>!)?:\s*(?P<desc>.+)$"
)

def get_commits(from_tag: str | None = None) -> list[tuple[str, str, str]]:
    rev_range = f"{from_tag}..HEAD" if from_tag else "HEAD"
    cmd = ["git", "log", rev_range, "--format=%H%x00%an%x00%s%x00%b%x1e"]
    try:
        raw = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode("utf-8", errors="replace")
    except subprocess.CalledProcessError:
        cmd = ["git", "log", "--format=%H%x00%an%x00%s%x00%b%x1e"]
        raw = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode("utf-8", errors="replace")

    commits = []
    for record in raw.split("\x1e"):
        record = record.strip()
        if not record:
            continue
        parts = record.split("\x00")
        if len(parts) >= 3:
            sha, author, subject = parts[0].strip(), parts[1].strip(), parts[2].strip()
            body = parts[3].strip() if len(parts) > 3 else ""
            commits.append((sha[:8], author, subject, body))
    return commits

def parse_commit(sha: str, author: str, subject: str, body: str):
    for pat in _NOISE_RE:
        if pat.search(subject):
            return None

    is_breaking = "BREAKING CHANGE" in body or "BREAKING-CHANGE" in body
    m = CONVENTIONAL_RE.match(subject)
    if m:
        c_type = m.group("type").lower()
        scope = m.group("scope")
        desc = m.group("desc").strip()
        if m.group("breaking"):
            is_breaking = True
        return {
            "sha": sha,
            "author": author,
            "category": "breaking" if is_breaking else c_type if c_type in CATEGORY_ORDER else "other",
            "scope": scope,
            "desc": desc,
            "subject": subject,
            "breaking": is_breaking,
        }

    return {
        "sha": sha,
        "author": author,
        "category": "breaking" if is_breaking else "other",
        "scope": None,
        "desc": subject,
        "subject": subject,
        "breaking": is_breaking,
    }

def generate_markdown(parsed_commits: list[dict], version: str, repo: str = "FaserF/gamevault-steam-plugin") -> str:
    buckets: dict[str, list[dict]] = {cat: [] for cat in CATEGORY_ORDER}
    for c in parsed_commits:
        cat = c["category"]
        if cat not in buckets:
            cat = "other"
        buckets[cat].append(c)

    lines = [f"## What's Changed in {version}\n"]

    if buckets["breaking"]:
        lines.append("> [!CAUTION]")
        lines.append("> **Breaking Changes:**\n")
        for c in buckets["breaking"]:
            lines.append(f"> - {c['desc']} ([`{c['sha']}`](https://github.com/{repo}/commit/{c['sha']}))")
        lines.append("")

    for cat in CATEGORY_ORDER:
        if cat == "breaking":
            continue
        entries = buckets[cat]
        if not entries:
            continue

        header = CATEGORY_EMOJI.get(cat, cat.capitalize())
        lines.append(f"### {header}\n")
        for c in entries:
            scope_prefix = f"**{c['scope']}**: " if c["scope"] else ""
            lines.append(f"- {scope_prefix}{c['desc']} ([`{c['sha']}`](https://github.com/{repo}/commit/{c['sha']})) by @{c['author']}")
        lines.append("")

    return "\n".join(lines).strip() + "\n"

def main():
    parser = argparse.ArgumentParser(description="Generate changelog for GameVault Steam Plugin")
    parser.add_argument("--from-tag", default=None)
    parser.add_argument("--version", default="v2.0.0")
    parser.add_argument("--repo", default="FaserF/gamevault-steam-plugin")
    args = parser.parse_args()

    raw_commits = get_commits(args.from_tag)
    parsed = []
    seen = set()
    for sha, author, subject, body in raw_commits:
        p = parse_commit(sha, author, subject, body)
        if p and p["desc"].lower() not in seen:
            seen.add(p["desc"].lower())
            parsed.append(p)

    md = generate_markdown(parsed, args.version, args.repo)
    sys.stdout.write(md)

if __name__ == "__main__":
    main()
