"""
XP / Gamification Engine — SecureTrail Learning System v3
==========================================================
Tracks developer XP earned by resolving security vulnerabilities across scans.

XP award rules:
  Resolved CRITICAL  → 20 XP each
  Resolved HIGH      → 10 XP each
  Resolved MEDIUM    →  5 XP each
  Resolved LOW       →  2 XP each

Level thresholds (cumulative XP):
  Level 1  Apprentice        0 – 99
  Level 2  Developer       100 – 249
  Level 3  Practitioner    250 – 499
  Level 4  Engineer        500 – 999
  Level 5  Specialist     1000 – 1999
  Level 6  Expert         2000 – 3999
  Level 7  Master        4000+

Storage: lightweight JSON file per-repo in Backend/Learning/.xp_store/
         (swap to DB column if persistence across replicas is needed)
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_XP_STORE_DIR = Path(__file__).parent / ".xp_store"

# XP awarded per resolved finding by severity
XP_PER_RESOLVED: dict[str, int] = {
    "critical": 20,
    "high":     10,
    "medium":    5,
    "low":       2,
    "info":      0,
}

LEVELS: list[dict] = [
    {"level": 1, "label": "Apprentice",   "min_xp": 0,    "max_xp": 99},
    {"level": 2, "label": "Developer",    "min_xp": 100,  "max_xp": 249},
    {"level": 3, "label": "Practitioner", "min_xp": 250,  "max_xp": 499},
    {"level": 4, "label": "Engineer",     "min_xp": 500,  "max_xp": 999},
    {"level": 5, "label": "Specialist",   "min_xp": 1000, "max_xp": 1999},
    {"level": 6, "label": "Expert",       "min_xp": 2000, "max_xp": 3999},
    {"level": 7, "label": "Master",       "min_xp": 4000, "max_xp": 999999},
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _store_path(repo_name: str) -> Path:
    safe_name = "".join(c if c.isalnum() or c in "-_." else "_" for c in repo_name)
    return _XP_STORE_DIR / f"{safe_name}.json"


def _load_xp(repo_name: str) -> dict:
    path = _store_path(repo_name)
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            pass
    return {"total_xp": 0, "history": []}


def _save_xp(repo_name: str, data: dict) -> None:
    try:
        _XP_STORE_DIR.mkdir(parents=True, exist_ok=True)
        _store_path(repo_name).write_text(json.dumps(data, indent=2))
    except Exception as exc:
        logger.warning("XP store write failed for %s: %s", repo_name, exc)


def get_level_for_xp(xp: int) -> dict:
    """Return the level dict that corresponds to the given total XP."""
    for lvl in reversed(LEVELS):
        if xp >= lvl["min_xp"]:
            return lvl
    return LEVELS[0]


def _progress_in_level(xp: int, level: dict) -> int:
    """Percentage progress within the current level band (0-100)."""
    if level["level"] == len(LEVELS):
        return 100
    band = level["max_xp"] - level["min_xp"] + 1
    progress = (xp - level["min_xp"]) / band * 100
    return min(100, max(0, int(progress)))


# ── XP calculation from resolved findings ─────────────────────────────────────

def calculate_xp_gained(resolved_severities: dict[str, int]) -> int:
    """
    Calculate XP earned from a set of resolved findings.

    Parameters
    ----------
    resolved_severities : {severity: count} of fixed findings
                          (from historical_comparison.compare_scans)

    Returns
    -------
    int — XP gained this scan
    """
    total = 0
    for sev, count in resolved_severities.items():
        total += XP_PER_RESOLVED.get(sev.lower(), 0) * count
    return total


def xp_breakdown(resolved_severities: dict[str, int]) -> list[dict]:
    """Return a breakdown of XP gained per severity."""
    items = []
    for sev in ("critical", "high", "medium", "low"):
        count = resolved_severities.get(sev, 0)
        if count > 0:
            xp = XP_PER_RESOLVED[sev] * count
            items.append({
                "severity":   sev,
                "count":      count,
                "xp_per":     XP_PER_RESOLVED[sev],
                "xp_gained":  xp,
            })
    return items


# ── Public API ─────────────────────────────────────────────────────────────────

def compute_xp_data(
    repo_name: str,
    resolved_severities: dict[str, int],
    scan_id: str = "",
    persist: bool = True,
) -> dict[str, Any]:
    """
    Compute XP gained this scan, update the running total, and return the
    full XP data block for the frontend.

    Parameters
    ----------
    repo_name            : repository name (used as store key)
    resolved_severities  : {severity: count} resolved this scan
    scan_id              : job UUID (for deduplication in history)
    persist              : whether to write the updated XP to disk

    Returns
    -------
    dict:
        xp_gained          : int   (XP earned this scan)
        xp_total           : int   (running total)
        level              : int   (current level number)
        level_label        : str   (current level name)
        next_level         : int | None
        next_level_label   : str | None
        next_level_xp      : int | None  (XP needed to reach next level)
        level_progress_pct : int   (% through current level)
        breakdown          : list   (per-severity XP)
        leveled_up         : bool  (did we just cross a level boundary?)
    """
    store = _load_xp(repo_name)

    # Deduplication: skip if this scan_id was already processed
    processed_ids: set[str] = {h.get("scan_id", "") for h in store.get("history", [])}
    if scan_id and scan_id in processed_ids:
        xp_gained = 0
    else:
        xp_gained = calculate_xp_gained(resolved_severities)

    prev_total = store.get("total_xp", 0)
    new_total  = prev_total + xp_gained

    prev_level = get_level_for_xp(prev_total)
    new_level  = get_level_for_xp(new_total)
    leveled_up = new_level["level"] > prev_level["level"]

    # Update store
    if xp_gained > 0 or not scan_id:
        store["total_xp"] = new_total
        store.setdefault("history", []).append({
            "scan_id":  scan_id,
            "xp_gained": xp_gained,
            "total_after": new_total,
            "resolved": resolved_severities,
        })
        if persist:
            _save_xp(repo_name, store)

    # Next level info
    current_level_idx = next(
        (i for i, lvl in enumerate(LEVELS) if lvl["level"] == new_level["level"]),
        len(LEVELS) - 1,
    )
    next_lvl = LEVELS[min(current_level_idx + 1, len(LEVELS) - 1)]
    is_max_level = new_level["level"] == LEVELS[-1]["level"]

    return {
        "xp_gained":          xp_gained,
        "xp_total":           new_total,
        "level":              new_level["level"],
        "level_label":        new_level["label"],
        "next_level":         None if is_max_level else next_lvl["level"],
        "next_level_label":   None if is_max_level else next_lvl["label"],
        "next_level_xp":      None if is_max_level else next_lvl["min_xp"] - new_total,
        "level_progress_pct": _progress_in_level(new_total, new_level),
        "breakdown":          xp_breakdown(resolved_severities),
        "leveled_up":         leveled_up,
    }
