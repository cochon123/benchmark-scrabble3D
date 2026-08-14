from __future__ import annotations

import json
from typing import Any

from .config import DATASET_PATH, ensure_directories, lexicon_path
from .constants import AXES, BOARD_SIZE, CENTER, DATASET_VERSION, TOP_MOVE_LIMIT
from .lexicon import Lexicon
from .solver import enumerate_moves, grid_from_cells, read_word, word_text


SEEDS = [
    ("prism-01", "four-word-3d", ("STONE", "SHORE", "CLOUD"), "x", "z", "ASIDE", "AERILST"),
    ("prism-02", "four-word-3d", ("PLANE", "STARE", "CRANE"), "x", "z", "SPARE", "DEIRST?"),
    ("prism-03", "four-word-3d", ("CHAIR", "STAIR", "LEARN"), "x", "y", "SCAR", "AEINRST"),
    ("prism-04", "four-word-3d", ("GREAT", "STEAM", "DREAM"), "x", "y", "AGILE", "ACDILTY"),
    ("prism-05", "four-word-3d", ("TRAIN", "GRAIN", "BRAIN"), "x", "z", "STONE", "ABEGIRS"),
    ("prism-06", "four-word-3d", ("HEART", "PEARL", "LEAST"), "x", "y", "WHALE", "AEGINT?"),
]


def _seed_cells(
    center_words: tuple[str, str, str],
    branch_root_axis: str,
    branch_axis: str,
    branch_word: str,
) -> list[tuple[int, int, int, str]]:
    """Build a connected four-word lattice around prototype center (3, 3, 3)."""
    cells: dict[tuple[int, int, int], str] = {}

    def place(word: str, axis: str, start: tuple[int, int, int]) -> None:
        delta = AXES[axis]
        for index, letter in enumerate(word):
            point = tuple(start[i] + delta[i] * index for i in range(3))
            previous = cells.get(point)
            if previous is not None and previous != letter:
                raise ValueError(f"Conflicting seed letters at {point}: {previous}/{letter}")
            cells[point] = letter

    for axis, word in zip(AXES, center_words):
        start = [3, 3, 3]
        start[("x", "y", "z").index(axis)] = 1
        place(word, axis, tuple(start))

    root = [3, 3, 3]
    root[("x", "y", "z").index(branch_root_axis)] = 1
    if branch_word[1] != cells[tuple(root)]:
        raise ValueError(f"Branch {branch_word} does not cross its root tile.")
    branch_start = list(root)
    branch_start[("x", "y", "z").index(branch_axis)] -= 1
    place(branch_word, branch_axis, tuple(branch_start))
    return [(*point, letter) for point, letter in sorted(cells.items())]


def existing_words(cells: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Return every maximal existing board word, once, across all three axes."""
    grid = grid_from_cells(cells)
    words = []
    for point in sorted(grid):
        for axis, delta in AXES.items():
            before = tuple(point[i] - delta[i] for i in range(3))
            if before in grid:
                continue
            word = read_word(grid, point, axis)
            if len(word) > 1:
                words.append({"axis": axis, "word": word_text(word)})
    return words


def _is_connected(cells: list[dict[str, Any]]) -> bool:
    points = {(int(cell["x"]), int(cell["y"]), int(cell["z"])) for cell in cells}
    if not points:
        return False
    reached = {next(iter(points))}
    frontier = list(reached)
    while frontier:
        point = frontier.pop()
        for delta in AXES.values():
            for sign in (-1, 1):
                neighbor = tuple(point[i] + delta[i] * sign for i in range(3))
                if neighbor in points and neighbor not in reached:
                    reached.add(neighbor)
                    frontier.append(neighbor)
    return reached == points


def generate_dataset() -> list[dict[str, Any]]:
    ensure_directories()
    lexicon = Lexicon.from_path(lexicon_path())
    positions = []
    for position_id, density, center_words, branch_root_axis, branch_axis, branch_word, rack in SEEDS:
        raw_cells = _seed_cells(center_words, branch_root_axis, branch_axis, branch_word)
        # Author seeds in a compact coordinate frame, then translate them as a
        # unit to the center of the full board.
        offset = CENTER[0] - 3
        cells = [
            {"x": x + offset, "y": y + offset, "z": z + offset, "letter": letter, "is_blank": False, "is_existing": True}
            for x, y, z, letter in raw_cells
        ]
        board_words = existing_words(cells)
        if (
            len(board_words) < 4
            or {word["axis"] for word in board_words} != set(AXES)
            or not _is_connected(cells)
        ):
            raise RuntimeError(f"Seed {position_id} is not a four-word, three-axis lattice.")
        invalid_words = [word["word"] for word in board_words if not lexicon.contains(word["word"])]
        if invalid_words:
            raise RuntimeError(f"Seed {position_id} contains invalid words: {invalid_words}")

        moves = enumerate_moves(lexicon, grid_from_cells(cells), rack)
        if not moves:
            raise RuntimeError(f"Seed {position_id} produced no legal moves.")
        optimal_score = moves[0].score
        optimal = [move for move in moves if move.score == optimal_score]
        canonical = sorted(optimal, key=lambda move: (len(move.placements), move.key()))[0]
        positions.append(
            {
                "id": position_id,
                "density": density,
                "dataset_version": DATASET_VERSION,
                "board_size": BOARD_SIZE,
                "board": cells,
                "existing_words": board_words,
                "rack": rack,
                "optimal_score": canonical.score,
                "optimal_moves": [move.to_dict() for move in optimal],
                "canonical_optimal_move": canonical.to_dict(),
                "top_moves": [move.to_dict() for move in moves[:TOP_MOVE_LIMIT]],
                "legal_move_count": len(moves),
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
