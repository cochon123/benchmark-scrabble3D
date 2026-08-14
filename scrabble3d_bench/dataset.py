from __future__ import annotations

import json
from typing import Any

from .config import DATASET_PATH, ensure_directories, lexicon_path
from .constants import BOARD_SIZE, CENTER, DATASET_VERSION
from .lexicon import Lexicon
from .solver import best_moves, grid_from_cells


SEEDS = [
    ("prism-01", "sparse", [(1, 3, 3, "S"), (2, 3, 3, "T"), (3, 3, 3, "O"), (4, 3, 3, "N"), (5, 3, 3, "E")], "AERILST"),
    ("prism-02", "sparse", [(3, 1, 3, "P"), (3, 2, 3, "L"), (3, 3, 3, "A"), (3, 4, 3, "N"), (3, 5, 3, "E")], "DEIRST?"),
    ("prism-03", "sparse", [(3, 3, 1, "C"), (3, 3, 2, "L"), (3, 3, 3, "O"), (3, 3, 4, "U"), (3, 3, 5, "D")], "AEINRST"),
    ("prism-04", "bridge", [(1, 3, 3, "S"), (2, 3, 3, "T"), (3, 3, 3, "O"), (4, 3, 3, "N"), (5, 3, 3, "E"), (3, 1, 3, "S"), (3, 2, 3, "H"), (3, 4, 3, "R"), (3, 5, 3, "E")], "ACDILTY"),
    ("prism-05", "bridge", [(1, 3, 3, "S"), (2, 3, 3, "T"), (3, 3, 3, "O"), (4, 3, 3, "N"), (5, 3, 3, "E"), (3, 3, 1, "C"), (3, 3, 2, "L"), (3, 3, 4, "U"), (3, 3, 5, "D")], "ABEGIRS"),
    ("prism-06", "junction", [(1, 3, 3, "S"), (2, 3, 3, "T"), (3, 3, 3, "O"), (4, 3, 3, "N"), (5, 3, 3, "E"), (3, 1, 3, "S"), (3, 2, 3, "H"), (3, 4, 3, "R"), (3, 5, 3, "E"), (3, 3, 1, "C"), (3, 3, 2, "L"), (3, 3, 4, "U"), (3, 3, 5, "D")], "AEGINT?"),
]


def generate_dataset() -> list[dict[str, Any]]:
    ensure_directories()
    lexicon = Lexicon.from_path(lexicon_path())
    positions = []
    for position_id, density, raw_cells, rack in SEEDS:
        # Seed shapes were authored around the center of the original 7-cube
        # prototype. Translate them as a unit so their geometry stays stable.
        offset = CENTER[0] - 3
        cells = [
            {"x": x + offset, "y": y + offset, "z": z + offset, "letter": letter, "is_blank": False, "is_existing": True}
            for x, y, z, letter in raw_cells
        ]
        optimal = best_moves(lexicon, grid_from_cells(cells), rack)
        if not optimal:
            raise RuntimeError(f"Seed {position_id} produced no legal moves.")
        canonical = sorted(optimal, key=lambda move: (len(move.placements), move.key()))[0]
        positions.append(
            {
                "id": position_id,
                "density": density,
                "dataset_version": DATASET_VERSION,
                "board_size": BOARD_SIZE,
                "board": cells,
                "rack": rack,
                "optimal_score": canonical.score,
                "optimal_moves": [move.to_dict() for move in optimal],
                "canonical_optimal_move": canonical.to_dict(),
            }
        )
    DATASET_PATH.write_text(json.dumps(positions, indent=2), encoding="utf-8")
    return positions


def load_dataset() -> list[dict[str, Any]]:
    if not DATASET_PATH.exists():
        return generate_dataset()
    positions = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    if any(
        position.get("dataset_version") != DATASET_VERSION
        or position.get("board_size") != BOARD_SIZE
        for position in positions
    ):
        return generate_dataset()
    return positions


def subset(preset: str, boards: int | None = None) -> list[dict[str, Any]]:
    positions = load_dataset()
    count = boards if boards is not None else {"smoke": 1, "standard": 3, "full": len(positions)}[preset]
    return positions[:count]
