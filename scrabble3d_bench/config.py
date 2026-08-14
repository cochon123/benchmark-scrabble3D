from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATASET_PATH = DATA_DIR / "dataset" / "positions.json"
RESULTS_DIR = DATA_DIR / "results"
LEXICON_DIR = DATA_DIR / "lexicon"
ENV_PATH = ROOT / ".env"


def ensure_directories() -> None:
    for path in (DATASET_PATH.parent, RESULTS_DIR, LEXICON_DIR):
        path.mkdir(parents=True, exist_ok=True)


def load_env() -> None:
    if not ENV_PATH.exists():
        return
    for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def lexicon_path() -> Path:
    for candidate in (LEXICON_DIR / "NWL23.txt", LEXICON_DIR / "ENABLE.txt"):
        if candidate.exists():
            return candidate
    raise FileNotFoundError("Add data/lexicon/NWL23.txt or data/lexicon/ENABLE.txt.")


def gateway_settings() -> tuple[str, str]:
    load_env()
    base_url = os.environ.get("CLI2API_BASE_URL", "http://127.0.0.1:3927/v1").rstrip("/")
    token = os.environ.get("CLI2API_TOKEN", "")
    if not token:
        raise RuntimeError("CLI2API_TOKEN is required. Use the same token passed to cli2api serve.")
    return base_url, token
