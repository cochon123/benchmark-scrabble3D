from __future__ import annotations

import io
import json
from unittest.mock import patch

from scrabble3d_bench.constants import BOARD_SIZE, CENTER, premium_at
from scrabble3d_bench.lexicon import Lexicon
from scrabble3d_bench.runner import _completion, dense_board_text, prompt_for_position
from scrabble3d_bench.solver import BoardTile, in_bounds, validate_and_score_move


def test_opening_move_must_cross_spatial_center() -> None:
    lexicon = Lexicon({"CAT"})
    move = validate_and_score_move(
        lexicon,
        {},
        "CATXXXX",
        [
            {"x": CENTER[0] - 1, "y": CENTER[1], "z": CENTER[2], "letter": "C"},
            {"x": CENTER[0], "y": CENTER[1], "z": CENTER[2], "letter": "A"},
            {"x": CENTER[0] + 1, "y": CENTER[1], "z": CENTER[2], "letter": "T"},
        ],
    )
    assert CENTER in {placement.coordinate for placement in move.placements}
    assert move.axis == "x"
    assert move.words == ["CAT"]


def test_move_can_run_on_depth_axis() -> None:
    lexicon = Lexicon({"CAT", "AT"})
    grid = {CENTER: BoardTile("A")}
    move = validate_and_score_move(
        lexicon,
        grid,
        "CTXXXXX",
        [
            {"x": CENTER[0], "y": CENTER[1], "z": CENTER[2] - 1, "letter": "C"},
            {"x": CENTER[0], "y": CENTER[1], "z": CENTER[2] + 1, "letter": "T"},
        ],
    )
    assert move.axis == "z"
    assert move.words == ["CAT"]


def test_one_cube_can_score_words_on_three_axes() -> None:
    lexicon = Lexicon({"CAT"})
    cx, cy, cz = CENTER
    grid = {
        (cx - 1, cy, cz): BoardTile("C"), (cx + 1, cy, cz): BoardTile("T"),
        (cx, cy - 1, cz): BoardTile("C"), (cx, cy + 1, cz): BoardTile("T"),
        (cx, cy, cz - 1): BoardTile("C"), (cx, cy, cz + 1): BoardTile("T"),
    }
    move = validate_and_score_move(
        lexicon,
        grid,
        "AEEEEEE",
        [{"x": cx, "y": cy, "z": cz, "letter": "A"}],
    )
    assert move.words == ["CAT"]
    assert move.score == 30  # each CAT is 5 points, doubled at the new center cube


def test_spatial_premium_map_is_symmetric() -> None:
    assert premium_at(0, 0, 0)[2] == "TW"
    assert premium_at(BOARD_SIZE - 1, BOARD_SIZE - 1, BOARD_SIZE - 1)[2] == "TW"
    inner = BOARD_SIZE // 4
    assert premium_at(inner, BOARD_SIZE - 1 - inner, inner)[2] == "DW"


def test_board_bounds_cover_full_fifteen_cube_lattice() -> None:
    assert BOARD_SIZE == 15
    assert CENTER == (7, 7, 7)
    assert in_bounds((14, 14, 14))
    assert not in_bounds((15, 14, 14))


def test_prompt_and_dense_board_follow_position_size() -> None:
    position = {"board_size": BOARD_SIZE, "board": [], "rack": "ABCDEFG"}
    board = dense_board_text(position)
    assert board.count("Z-LAYER") == BOARD_SIZE
    assert "14" in board.splitlines()[1]
    messages = prompt_for_position(position)
    assert "15×15×15" in messages[0]["content"]
    assert "each 3 or 11" in messages[0]["content"]
    assert "50-point bonus" in messages[0]["content"]


def test_completion_preserves_provider_reasoning_summary() -> None:
    response = {
        "choices": [{"message": {
            "content": '{"tool":"play_move_3d","arguments":{"placements":[]}}',
            "reasoning": "provider summary",
            "reasoning_content": "provider summary",
        }}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 2, "total_tokens": 12},
    }
    fake_http_response = io.BytesIO(json.dumps(response).encode("utf-8"))
    with (
        patch("scrabble3d_bench.runner.gateway_settings", return_value=("http://example.test/v1", "token")),
        patch("scrabble3d_bench.runner.urllib.request.urlopen", return_value=fake_http_response),
    ):
        content, reasoning, usage, _ = _completion("codex/test", "low", [])
    assert content.startswith('{"tool"')
    assert reasoning == "provider summary"
    assert usage["total_tokens"] == 12
