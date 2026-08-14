from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any

from .config import RESULTS_DIR, ensure_directories, gateway_settings, lexicon_path
from .constants import BINGO_BONUS, DATASET_VERSION, LETTER_VALUES, RACK_SIZE, TOP_MOVE_LIMIT
from .dataset import subset
from .lexicon import Lexicon
from .solver import grid_from_cells, validate_and_score_move


def move_rank(score: int, top_moves: list[dict[str, Any]]) -> int | None:
    """Return a competition rank when a score reaches the frozen top-N window."""
    if not top_moves:
        return None
    cutoff_score = int(top_moves[-1]["score"])
    if len(top_moves) >= TOP_MOVE_LIMIT and score < cutoff_score:
        return None
    return 1 + sum(int(candidate["score"]) > score for candidate in top_moves)


def dense_board_text(position: dict[str, Any]) -> str:
    board_size = int(position["board_size"])
    coordinate_width = len(str(board_size - 1))
    cells = {
        (int(cell["x"]), int(cell["y"]), int(cell["z"])): (
            str(cell["letter"]).lower() if cell.get("is_blank") else str(cell["letter"]).upper()
        )
        for cell in position["board"]
    }
    lines = []
    x_labels = " ".join(f"{x:>{coordinate_width}}" for x in range(board_size))
    for z in range(board_size):
        lines.append(f"Z-LAYER {z}")
        lines.append(f"{'':>{coordinate_width + 5}}X→  {x_labels}")
        for y in range(board_size):
            row = " ".join(f"{cells.get((x, y, z), '.'):>{coordinate_width}}" for x in range(board_size))
            lines.append(f"Y={y:<{coordinate_width}}     {row}")
        lines.append("")
    return "\n".join(lines).rstrip()


def prompt_for_position(position: dict[str, Any]) -> list[dict[str, str]]:
    board_size = int(position["board_size"])
    center = board_size // 2
    inner = board_size // 4
    far_inner = board_size - 1 - inner
    letter_values = " ".join(
        f"{letter}={value}" for letter, value in LETTER_VALUES.items() if letter != "?"
    )
    system = "\n".join(
        [
            "You are an unaided 3D Scrabble benchmarking agent.",
            "Use only the lattice and rack in this prompt. Do not use tools, files, search, or code execution.",
            f"The English game occupies a {board_size}×{board_size}×{board_size} lattice. Coordinates are 0-indexed (x,y,z).",
            "Words run only on the X, Y, or Z axis. New tiles in one move must lie on one axis.",
            "All main and perpendicular cross-words must be valid English words.",
            f"The center cube is ({center},{center},{center}). A lowercase board letter is an existing zero-point blank.",
            f"Premiums apply only when first occupied: center is DW; cubes whose three coordinates are each 0 or {board_size - 1} are TW; cubes whose three coordinates are each {inner} or {far_inner} are DW.",
            f"Cubes with exactly two coordinates equal to {center} are TL when the third is 0 or {board_size - 1}, and DL when the third is {inner} or {far_inner}. All other cubes have no premium.",
            f"Letter values are: {letter_values}. A blank is worth 0 points.",
            f"A move places at most {RACK_SIZE} rack tiles; using all {RACK_SIZE} earns a {BINGO_BONUS}-point bonus.",
            "Goal: return the legal move with the highest immediate raw score.",
            "Return only newly placed tiles; never repeat existing crossing tiles.",
            "A ? rack tile may represent one missing letter.",
            'Reply with exactly: {"tool":"play_move_3d","arguments":{"placements":[{"x":0,"y":0,"z":0,"letter":"A"}]}}',
            "Return one raw JSON object and no prose.",
        ]
    )
    payload = {
        "benchmark": "scrabble3d-exact-immediate-score",
        "board_size": [board_size, board_size, board_size],
        "rack": list(position["rack"]),
        "board_encoding": "z-layers; X columns; Y rows; . is empty",
        "board": dense_board_text(position).splitlines(),
    }
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(payload)},
    ]


def parse_tool_payload(text: str) -> list[dict[str, Any]]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("Response did not contain JSON.")
        payload = json.loads(cleaned[start : end + 1])
    if not isinstance(payload, dict) or payload.get("tool") != "play_move_3d":
        raise ValueError("Response did not use the play_move_3d tool envelope.")
    placements = (payload.get("arguments") or {}).get("placements")
    if not isinstance(placements, list):
        raise ValueError("Tool payload is missing arguments.placements.")
    return placements


def _completion(
    model: str,
    reasoning_effort: str,
    messages: list[dict[str, str]],
) -> tuple[str, str | None, dict[str, int], int]:
    base_url, token = gateway_settings()
    body = json.dumps(
        {
            "model": model,
            "messages": messages,
            "reasoning_effort": reasoning_effort,
            "include_reasoning": True,
            "max_tokens": 8192,
            "stream": False,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=1800) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"cli2api returned HTTP {exc.code}: {details}") from exc
    latency_ms = round((time.perf_counter() - started) * 1000)
    message = payload["choices"][0]["message"]
    content = message["content"]
    reasoning = (
        message.get("reasoning_content")
        or message.get("reasoning")
        or message.get("thinking")
        or None
    )
    usage = payload.get("usage") or {}
    return content, reasoning, {
        "prompt_tokens": int(usage.get("prompt_tokens", 0) or 0),
        "completion_tokens": int(usage.get("completion_tokens", 0) or 0),
        "total_tokens": int(usage.get("total_tokens", 0) or 0),
    }, latency_ms


def execute_run(
    model: str,
    reasoning_effort: str,
    preset: str,
    boards: int | None = None,
) -> dict[str, Any]:
    ensure_directories()
    lexicon = Lexicon.from_path(lexicon_path())
    positions = subset(preset, boards)
    run_id = f"run-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"
    results = []
    print(f"Scrabble³ · {model} · effort={reasoning_effort} · {len(positions)} board(s)", flush=True)
    for index, position in enumerate(positions, start=1):
        print(f"[{index}/{len(positions)}] {position['id']} rack={position['rack']}", flush=True)
        raw_response = ""
        reasoning = None
        usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        latency_ms = 0
        error = None
        move = None
        try:
            raw_response, reasoning, usage, latency_ms = _completion(
                model, reasoning_effort, prompt_for_position(position)
            )
            placements = parse_tool_payload(raw_response)
            move = validate_and_score_move(
                lexicon,
                grid_from_cells(position["board"]),
                position["rack"],
                placements,
            )
        except Exception as exc:  # benchmark records model/gateway failures per board
            error = str(exc)
        optimal_score = int(position["optimal_score"])
        score = move.score if move else 0
        rank = move_rank(score, position.get("top_moves", [])) if move else None
        result = {
            "position_id": position["id"],
            "rack": position["rack"],
            "score": score,
            "optimal_score": optimal_score,
            "score_pct": 100 * score / optimal_score if optimal_score else 0,
            "is_legal": move is not None,
            "is_optimal": bool(move and move.score == optimal_score),
            "move_rank": rank,
            "move_rank_cutoff": TOP_MOVE_LIMIT,
            "is_top_20": rank is not None,
            "move": move.to_dict() if move else None,
            "canonical_optimal_move": position["canonical_optimal_move"],
            "error": error,
            "raw_response": raw_response,
            "reasoning": reasoning,
            "usage": usage,
            "latency_ms": latency_ms,
        }
        results.append(result)
        outcome = "EXACT" if result["is_optimal"] else "LEGAL" if result["is_legal"] else "REJECTED"
        rank_text = f"rank #{rank}" if rank is not None else f"rank >{TOP_MOVE_LIMIT}" if move else "unranked"
        print(f"    {outcome} · {score}/{optimal_score} · {rank_text} · {latency_ms / 1000:.1f}s", flush=True)
        if error:
            print(f"    {error}", flush=True)

    legal = sum(result["is_legal"] for result in results)
    optimal = sum(result["is_optimal"] for result in results)
    points = sum(result["score"] for result in results)
    possible = sum(result["optimal_score"] for result in results)
    ranked = [result["move_rank"] for result in results if result["move_rank"] is not None]
    payload = {
        "run_id": run_id,
        "dataset_version": positions[0].get("dataset_version", DATASET_VERSION) if positions else DATASET_VERSION,
        "board_size": positions[0].get("board_size") if positions else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model": model,
        "reasoning_effort": reasoning_effort,
        "preset": preset,
        "boards": len(results),
        "status": "completed",
        "summary": {
            "legal": legal,
            "legal_pct": 100 * legal / len(results) if results else 0,
            "exact_optimal": optimal,
            "exact_optimal_pct": 100 * optimal / len(results) if results else 0,
            "top_20_moves": len(ranked),
            "top_20_move_pct": 100 * len(ranked) / len(results) if results else 0,
            "mean_rank_at_20": sum(ranked) / len(ranked) if ranked else None,
            "points": points,
            "optimal_points": possible,
            "score_pct": 100 * points / possible if possible else 0,
            "latency_ms": sum(result["latency_ms"] for result in results),
            "total_tokens": sum(result["usage"]["total_tokens"] for result in results),
        },
        "results": results,
    }
    output = RESULTS_DIR / f"{run_id}.json"
    output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Saved {output}", flush=True)
    return payload
