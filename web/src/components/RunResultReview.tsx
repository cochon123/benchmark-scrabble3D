"use client";

import { useEffect, useState } from "react";

import { Rack } from "@/components/Rack";
import { SpatialBoard } from "@/components/SpatialBoard";
import type { Position, RunResult } from "@/lib/types";

function price(value?: number) {
  if (value == null) return "—";
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

export function RunResultReview({ result, position, index }: { result: RunResult; position: Position; index: number }) {
  const [showOptimal, setShowOptimal] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const reasoning = result.reasoning ?? result.reasoning_content ?? result.thinking ?? null;
  const outcome = result.is_optimal ? "Exact optimum" : result.is_legal ? "Legal, suboptimal" : "Illegal move";

  useEffect(() => {
    if (!showTrace) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setShowTrace(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [showTrace]);

  return (
    <article className="result-row">
      <div className="result-summary">
        <div className="result-index">{String(index + 1).padStart(2, "0")}</div>
        <div className="result-copy">
          <div className={`outcome ${result.is_optimal ? "optimal" : result.is_legal ? "legal" : "rejected"}`}>{outcome}</div>
          <h3>{result.position_id}</h3>
          <p>{result.error ?? `${result.move?.words.join(" · ") || "No words formed"} · ${result.move?.axis?.toUpperCase() ?? "—"} axis`}</p>
          <div className="result-rack"><span>Rack</span><Rack letters={position.rack} /></div>
          <dl className="result-facts">
            <div><dt>Score</dt><dd>{result.score} / {result.optimal_score} pts</dd></div>
            <div><dt>Ratio</dt><dd>{result.score_pct.toFixed(1)}%</dd></div>
            <div><dt>Estimated price</dt><dd>{price(result.estimated_cost_usd)}</dd></div>
            <div><dt>Tokens spent</dt><dd>{result.usage?.total_tokens?.toLocaleString() ?? "—"}</dd></div>
          </dl>
          <div className="result-actions">
            <button className={`text-button ${showOptimal ? "active" : ""}`} type="button" onClick={() => setShowOptimal((value) => !value)}>{showOptimal ? "Show model move" : "Show optimal move"}<span>↔</span></button>
            <button className="text-button" type="button" onClick={() => setShowTrace(true)}>Show reasoning summary<span>↗</span></button>
          </div>
        </div>
      </div>
      <div className="result-board-wrap">
        <SpatialBoard boardSize={position.board_size} board={position.board} highlight={showOptimal ? position.canonical_optimal_move.placements : result.move?.placements ?? []} highlightTone={showOptimal ? "optimal" : "model"} />
      </div>

      {showTrace ? (
        <div className="trace-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowTrace(false); }}>
          <section className="trace-dialog" role="dialog" aria-modal="true" aria-labelledby={`trace-title-${index}`}>
            <div className="trace-header"><div><p className="kicker">Model trace</p><h2 id={`trace-title-${index}`}>{result.position_id}</h2></div><button type="button" aria-label="Close reasoning trace" onClick={() => setShowTrace(false)}>×</button></div>
            {reasoning ? <><h3>Provider-exposed reasoning summary</h3><pre>{reasoning}</pre></> : <p className="trace-notice">This provider did not expose a reasoning summary. The recorded output and evaluator trace are shown below.</p>}
            <h3>Raw model response</h3>
            <pre>{result.raw_response || "No raw response was recorded."}</pre>
            <h3>Evaluator trace</h3>
            <pre>{result.error || `${outcome}. ${result.score} / ${result.optimal_score} points.`}</pre>
            <div className="trace-usage"><span>Prompt tokens <b>{result.usage?.prompt_tokens?.toLocaleString() ?? "—"}</b></span><span>Output tokens <b>{result.usage?.completion_tokens?.toLocaleString() ?? "—"}</b></span></div>
          </section>
        </div>
      ) : null}
    </article>
  );
}
