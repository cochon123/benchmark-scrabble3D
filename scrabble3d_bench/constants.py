from __future__ import annotations

BOARD_SIZE = 15
RACK_SIZE = 7
BINGO_BONUS = 50
CENTER = (BOARD_SIZE // 2,) * 3
DATASET_VERSION = "15x15x15-v1"
AXES = {
    "x": (1, 0, 0),
    "y": (0, 1, 0),
    "z": (0, 0, 1),
}

LETTER_VALUES = {
    "A": 1, "B": 3, "C": 3, "D": 2, "E": 1, "F": 4, "G": 2,
    "H": 4, "I": 1, "J": 8, "K": 5, "L": 1, "M": 3, "N": 1,
    "O": 1, "P": 3, "Q": 10, "R": 1, "S": 1, "T": 1, "U": 1,
    "V": 4, "W": 4, "X": 8, "Y": 4, "Z": 10, "?": 0,
}

TILE_DISTRIBUTION = {
    "A": 9, "B": 2, "C": 2, "D": 4, "E": 12, "F": 2, "G": 3,
    "H": 2, "I": 9, "J": 1, "K": 1, "L": 4, "M": 2, "N": 6,
    "O": 8, "P": 2, "Q": 1, "R": 6, "S": 4, "T": 6, "U": 4,
    "V": 2, "W": 2, "X": 1, "Y": 2, "Z": 1, "?": 2,
}


def premium_at(x: int, y: int, z: int) -> tuple[int, int, str | None]:
    """Return (letter multiplier, word multiplier, label) for one cube.

    The spatial premium map is rotationally symmetric. Eight outer corners are
    triple-word, eight inner corners are double-word, face-axis points are
    triple-letter, and the remaining inner axis points are double-letter.
    """
    point = (x, y, z)
    if point == CENTER:
        return 1, 2, "DW"
    if all(value in {0, BOARD_SIZE - 1} for value in point):
        return 1, 3, "TW"
    inner = BOARD_SIZE // 4
    if all(value in {inner, BOARD_SIZE - 1 - inner} for value in point):
        return 1, 2, "DW"
    centered = sum(value == CENTER[0] for value in point)
    if centered == 2 and any(value in {0, BOARD_SIZE - 1} for value in point):
        return 3, 1, "TL"
    if centered == 2 and any(value in {inner, BOARD_SIZE - 1 - inner} for value in point):
        return 2, 1, "DL"
    return 1, 1, None
