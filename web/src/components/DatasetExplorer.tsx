"use client";

import { useState } from "react";

import { Rack } from "@/components/Rack";
import { SpatialBoard } from "@/components/SpatialBoard";
import type { Position } from "@/lib/types";

export function DatasetExplorer({ positions }: { positions: Position[] }) {
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(true);
  const position = positions[index];

  if (!position) {
    return <div className="page-shell empty-state"><p className="kicker">No dataset</p><h1>Generate the position set first.</h1></div>;
  }

  const move = position.canonical_optimal_move;

  return (
    <div className="page-shell dataset-page">
      <header className="dataset-header">
        <div>
          <p className="kicker">Fixed benchmark dataset</p>
          <h1>Spatial positions, fully inspectable.</h1>
        </div>
        <p>Every model receives this same lattice and rack, with no candidates, solver plan, coordinates, scores, or search results.</p>
      </header>

      <div className="dataset-workspace">
        <aside className="position-browser">
          <div className="browser-heading"><span>Positions</span><b>{positions.length}</b></div>
          <div className="position-list">
            {positions.map((item, itemIndex) => (
              <button key={item.id} className={itemIndex === index ? "active" : ""} onClick={() => setIndex(itemIndex)}>
                <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                <b>{item.id}</b>
                <small>{item.density}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="position-view">
          <div className="position-toolbar">
            <div><span>Position {String(index + 1).padStart(2, "0")}</span><h2>{position.id}</h2></div>
            <button className={showAnswer ? "active" : ""} onClick={() => setShowAnswer((value) => !value)}>
              <i /> {showAnswer ? "Hide" : "Show"} exact move
            </button>
          </div>
          <SpatialBoard boardSize={position.board_size} board={position.board} highlight={showAnswer ? move.placements : []} />
        </section>

        <aside className="position-meta">
          <section>
            <span className="meta-label">Rack</span>
            <Rack letters={position.rack} />
          </section>
          <dl className="position-stats">
            <div><dt>Optimal score</dt><dd>{position.optimal_score}</dd></div>
            <div><dt>Axis</dt><dd>{move.axis?.toUpperCase()}</dd></div>
            <div><dt>Tied moves</dt><dd>{position.optimal_moves.length}</dd></div>
            <div><dt>New cubes</dt><dd>{move.placements.length}</dd></div>
            <div><dt>Board words</dt><dd>{position.existing_words.length}</dd></div>
            <div><dt>Legal moves</dt><dd>{position.legal_move_count.toLocaleString()}</dd></div>
          </dl>
          <section>
            <span className="meta-label">Existing 3D words</span>
            <div className="word-list">{position.existing_words.map(({ axis, word }) => <b key={`${axis}-${word}`}>{word} · {axis.toUpperCase()}</b>)}</div>
          </section>
          <section>
            <span className="meta-label">Words formed</span>
            <div className="word-list">{move.words.map((word) => <b key={word}>{word}</b>)}</div>
          </section>
          <section>
            <span className="meta-label">New cube coordinates</span>
            <div className="placement-list">
              {move.placements.map((tile) => <code key={`${tile.x}-${tile.y}-${tile.z}`}><b>{tile.letter}</b><span>x{tile.x} y{tile.y} z{tile.z}</span></code>)}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
