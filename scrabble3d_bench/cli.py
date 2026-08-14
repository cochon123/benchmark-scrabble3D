from __future__ import annotations

import argparse
import json

from .dataset import generate_dataset, load_dataset
from .runner import dense_board_text, execute_run


def main() -> None:
    parser = argparse.ArgumentParser(prog="scrabble3d-bench")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("generate-dataset", help="solve and freeze the six reference positions")

    inspect_parser = subparsers.add_parser("inspect", help="print one position as Z layers")
    inspect_parser.add_argument("--position")

    run_parser = subparsers.add_parser("run", help="benchmark a model through local cli2api")
    run_parser.add_argument("--model", default="codex/gpt-5.6-luna")
    run_parser.add_argument("--reasoning-effort", default="low", choices=["none", "low", "medium", "high", "xhigh", "max"])
    run_parser.add_argument("--preset", default="smoke", choices=["smoke", "standard", "full"])
    run_parser.add_argument("--boards", type=int)

    args = parser.parse_args()
    if args.command == "generate-dataset":
        positions = generate_dataset()
        print(f"Generated {len(positions)} positions.")
        return
    if args.command == "inspect":
        positions = load_dataset()
        position = next((item for item in positions if item["id"] == args.position), positions[0])
        print(dense_board_text(position))
        print(json.dumps({"rack": position["rack"], "optimal": position["canonical_optimal_move"]}, indent=2))
        return
    execute_run(args.model, args.reasoning_effort, args.preset, args.boards)
