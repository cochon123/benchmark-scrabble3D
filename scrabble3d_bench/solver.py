from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Iterable

from .constants import AXES, BINGO_BONUS, BOARD_SIZE, CENTER, LETTER_VALUES, premium_at
from .lexicon import Lexicon
from .models import Move, Placement

Coordinate = tuple[int, int, int]


@dataclass(frozen=True)
class BoardTile:
    letter: str
    is_blank: bool = False


Grid = dict[Coordinate, BoardTile]


def grid_from_cells(cells: list[dict]) -> Grid:
    return {
        (int(cell["x"]), int(cell["y"]), int(cell["z"])): BoardTile(
            str(cell["letter"]).upper(), bool(cell.get("is_blank", False))
        )
        for cell in cells
    }


def grid_to_cells(grid: Grid) -> list[dict]:
    return [
        {
            "x": x,
            "y": y,
            "z": z,
            "letter": tile.letter,
            "is_blank": tile.is_blank,
            "is_existing": True,
        }
        for (x, y, z), tile in sorted(grid.items(), key=lambda item: item[0][::-1])
    ]


def in_bounds(point: Coordinate) -> bool:
    return all(0 <= value < BOARD_SIZE for value in point)


def add(point: Coordinate, delta: Coordinate, scale: int = 1) -> Coordinate:
    return tuple(point[index] + delta[index] * scale for index in range(3))  # type: ignore[return-value]


def neighbors(point: Coordinate) -> list[Coordinate]:
    result = []
    for delta in AXES.values():
        for sign in (-1, 1):
            candidate = add(point, delta, sign)
            if in_bounds(candidate):
                result.append(candidate)
    return result


def read_word(grid: Grid, point: Coordinate, axis: str) -> list[tuple[Coordinate, BoardTile]]:
    delta = AXES[axis]
    start = point
    while in_bounds(add(start, delta, -1)) and add(start, delta, -1) in grid:
        start = add(start, delta, -1)
    word = []
    cursor = start
    while in_bounds(cursor) and cursor in grid:
        word.append((cursor, grid[cursor]))
        cursor = add(cursor, delta)
    return word


def word_text(word: list[tuple[Coordinate, BoardTile]]) -> str:
    return "".join(tile.letter for _, tile in word)


def score_word(word: list[tuple[Coordinate, BoardTile]], new_points: set[Coordinate]) -> int:
    subtotal = 0
    word_multiplier = 1
    for point, tile in word:
        value = 0 if tile.is_blank else LETTER_VALUES[tile.letter]
        if point in new_points:
            letter_multiplier, cube_word_multiplier, _ = premium_at(*point)
            subtotal += value * letter_multiplier
            word_multiplier *= cube_word_multiplier
        else:
            subtotal += value
    return subtotal * word_multiplier


def normalize_placements(raw_placements: Iterable[dict], grid: Grid) -> list[Placement]:
    deduped: dict[Coordinate, Placement] = {}
    for raw in raw_placements:
        point = int(raw["x"]), int(raw["y"]), int(raw["z"])
        if not in_bounds(point):
            raise ValueError(f"Placement out of bounds: {point}")
        letter = str(raw["letter"]).strip().upper()
        if len(letter) != 1 or letter not in LETTER_VALUES or letter == "?":
            raise ValueError(f"Invalid placement letter: {letter!r}")
        existing = grid.get(point)
        if existing:
            if existing.letter != letter:
                raise ValueError(f"Placement collides with existing tile at {point}")
            continue
        deduped[point] = Placement(*point, letter)
    placements = sorted(deduped.values(), key=lambda p: p.coordinate)
    if not placements:
        raise ValueError("No new tiles were provided.")
    if len(placements) > 7:
        raise ValueError("A move may not place more than seven tiles.")
    return placements


def assign_blanks(placements: list[Placement], rack: str) -> list[Placement]:
    available = Counter(rack.upper())
    assigned = []
    for placement in placements:
        if available[placement.letter]:
            available[placement.letter] -= 1
            assigned.append(placement)
        elif available["?"]:
            available["?"] -= 1
            assigned.append(Placement(*placement.coordinate, placement.letter, True))
        else:
            raise ValueError(f"Rack cannot supply letter {placement.letter!r}.")
    return assigned


def infer_axis(placements: list[Placement]) -> str | None:
    if len(placements) == 1:
        return None
    varying = []
    for index, axis in enumerate(("x", "y", "z")):
        if len({placement.coordinate[index] for placement in placements}) > 1:
            varying.append(axis)
    if len(varying) != 1:
        raise ValueError("Placements must lie on exactly one of the X, Y, or Z axes.")
    return varying[0]


def validate_and_score_move(
    lexicon: Lexicon,
    grid: Grid,
    rack: str,
    raw_placements: Iterable[dict],
) -> Move:
    placements = assign_blanks(normalize_placements(raw_placements, grid), rack)
    axis = infer_axis(placements)
    updated = dict(grid)
    for placement in placements:
        updated[placement.coordinate] = BoardTile(placement.letter, placement.is_blank)

    new_points = {placement.coordinate for placement in placements}
    board_was_empty = not grid
    if board_was_empty and CENTER not in new_points:
        raise ValueError(f"The opening move must cover center cube {CENTER}.")

    words: list[str] = []
    score = 0
    touched_existing = False

    if axis:
        axis_index = ("x", "y", "z").index(axis)
        coordinates = [placement.coordinate[axis_index] for placement in placements]
        anchor = list(placements[0].coordinate)
        for value in range(min(coordinates), max(coordinates) + 1):
            anchor[axis_index] = value
            if tuple(anchor) not in updated:
                raise ValueError("Move has a gap in its main word.")

        main_word = read_word(updated, placements[0].coordinate, axis)
        main_text = word_text(main_word)
        if not lexicon.contains(main_text):
            raise ValueError(f"Main word is invalid: {main_text}")
        words.append(main_text)
        score += score_word(main_word, new_points)
        touched_existing = any(point not in new_points for point, _ in main_word)

        for placement in placements:
            for cross_axis in AXES:
                if cross_axis == axis:
                    continue
                cross_word = read_word(updated, placement.coordinate, cross_axis)
                if len(cross_word) <= 1:
                    continue
                cross_text = word_text(cross_word)
                if not lexicon.contains(cross_text):
                    raise ValueError(f"{cross_axis.upper()} cross-word is invalid: {cross_text}")
                words.append(cross_text)
                score += score_word(cross_word, new_points)
                touched_existing = True
    else:
        placement = placements[0]
        spatial_words = [read_word(updated, placement.coordinate, candidate) for candidate in AXES]
        spatial_words = [word for word in spatial_words if len(word) > 1]
        if not spatial_words:
            raise ValueError("Single-tile move does not form a word on any axis.")
        for spatial_word in spatial_words:
            text = word_text(spatial_word)
            if not lexicon.contains(text):
                raise ValueError(f"Cross-word is invalid: {text}")
            words.append(text)
            score += score_word(spatial_word, new_points)
            touched_existing = any(point not in new_points for point, _ in spatial_word)

    if not board_was_empty and not touched_existing:
        raise ValueError("Move does not connect to the existing lattice.")
    if len(placements) == 7:
        score += BINGO_BONUS
    return Move(placements=placements, score=score, words=sorted(set(words)), axis=axis)


def _rack_can_supply(letters: list[str], rack: str) -> bool:
    available = Counter(rack.upper())
    blanks = available["?"]
    for letter in letters:
        if available[letter]:
            available[letter] -= 1
        elif blanks:
            blanks -= 1
        else:
            return False
    return True


def enumerate_moves(lexicon: Lexicon, grid: Grid, rack: str) -> list[Move]:
    """Enumerate every legal axis-aligned word and return moves best-first."""
    moves: dict[tuple, Move] = {}
    board_empty = not grid
    pattern_cache: dict[tuple[int, tuple[str | None, ...]], tuple[str, ...]] = {}

    def matching_words(length: int, pattern: tuple[str | None, ...]) -> tuple[str, ...]:
        cache_key = (length, pattern)
        cached = pattern_cache.get(cache_key)
        if cached is not None:
            return cached
        matches = []
        for word in lexicon.words_by_length[length]:
            if any(letter is not None and word[index] != letter for index, letter in enumerate(pattern)):
                continue
            required = [word[index] for index, letter in enumerate(pattern) if letter is None]
            if _rack_can_supply(required, rack):
                matches.append(word)
        result = tuple(matches)
        pattern_cache[cache_key] = result
        return result

    for length, words in lexicon.words_by_length.items():
        for axis, delta in AXES.items():
            other = [index for index, name in enumerate(("x", "y", "z")) if name != axis]
            axis_index = ("x", "y", "z").index(axis)
            for fixed_a in range(BOARD_SIZE):
                for fixed_b in range(BOARD_SIZE):
                    for start_value in range(BOARD_SIZE - length + 1):
                        start = [0, 0, 0]
                        start[axis_index] = start_value
                        start[other[0]] = fixed_a
                        start[other[1]] = fixed_b
                        start_point = tuple(start)
                        before = add(start_point, delta, -1)
                        after = add(start_point, delta, length)
                        if (in_bounds(before) and before in grid) or (in_bounds(after) and after in grid):
                            continue

                        segment = [add(start_point, delta, offset) for offset in range(length)]
                        pattern = tuple(grid[point].letter if point in grid else None for point in segment)
                        segment_connects = any(
                            point in grid or any(neighbor in grid for neighbor in neighbors(point))
                            for point in segment
                        )
                        if not board_empty and not segment_connects:
                            continue
                        for word in matching_words(length, pattern):
                            raw = []
                            covers_center = False
                            for point, letter in zip(segment, word):
                                covers_center = covers_center or point == CENTER
                                existing = grid.get(point)
                                if not existing:
                                    raw.append({"x": point[0], "y": point[1], "z": point[2], "letter": letter})
                            if not raw or len(raw) > 7:
                                continue
                            if board_empty and not covers_center:
                                continue
                            try:
                                move = validate_and_score_move(lexicon, grid, rack, raw)
                            except ValueError:
                                continue
                            previous = moves.get(move.key())
                            if previous is None or move.score > previous.score:
                                moves[move.key()] = move
    return sorted(
        moves.values(),
        key=lambda move: (-move.score, len(move.placements), move.key()),
    )


def best_moves(lexicon: Lexicon, grid: Grid, rack: str) -> list[Move]:
    moves = enumerate_moves(lexicon, grid, rack)
    if not moves:
        return []
    best_score = moves[0].score
    return [move for move in moves if move.score == best_score]
