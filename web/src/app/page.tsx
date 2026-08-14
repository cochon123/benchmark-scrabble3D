import Link from "next/link";

import { BenchmarkCharts } from "@/components/BenchmarkCharts";
import { ModelLogo } from "@/components/ModelLogo";
import { getPositions, getRuns } from "@/lib/data";
import { modelName } from "@/lib/modelMeta";
import type { BenchmarkRun } from "@/lib/types";

export const dynamic = "force-dynamic";

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

function duration(run: BenchmarkRun) {
  return `${(run.summary.latency_ms / Math.max(run.boards, 1) / 1000).toFixed(1)}s`;
}

export default function BenchmarkPage() {
  const positions = getPositions();
  const runs = [...getRuns(positions[0]?.dataset_version)].sort((a, b) => {
    return b.summary.score_pct - a.summary.score_pct;
  });
  const completed = runs.filter((run) => run.status === "completed");
  const bestScore = completed.length ? Math.max(...completed.map((run) => run.summary.score_pct)) : 0;
  const uniqueModels = new Set(runs.map((run) => run.model)).size;

  return (
    <div className="page-shell benchmark-page">
      <section className="benchmark-hero">
        <div className="hero-layout">
          <h1>Can a model find the exact best move in three dimensions?</h1>
          <div className="hero-summary">
            <p>Models receive only the 15 × 15 × 15 board, rack, coordinate convention, and rules. One raw JSON move is scored against the exact solver optimum.</p>
            <div className="hero-links">
              <Link href="/dataset" className="text-link">Inspect the fixed dataset <span>↗</span></Link>
              <Link href="/protocol" className="text-link">Read the methodology <span>↗</span></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="summary-strip" aria-label="Benchmark summary">
        <div><span>Models tested</span><strong>{uniqueModels}</strong></div>
        <div><span>Completed runs</span><strong>{completed.length}</strong></div>
        <div><span>Dataset positions</span><strong>{positions.length}</strong></div>
        <div className="summary-primary"><span>Best point score <i>diagnostic</i></span><strong>{pct(bestScore)}</strong></div>
      </section>

      <BenchmarkCharts runs={runs} />

      <section className="leaderboard-section">
        <div className="section-heading">
          <div><h2>Model runs</h2></div>
          <p>Ranked by point score. This leaderboard is diagnostic; exact-optimal results remain inside each model run.</p>
        </div>

        {runs.length ? (
          <div className="leaderboard" role="table" aria-label="Model benchmark runs">
            <div className="leaderboard-head" role="row">
              <span role="columnheader">Rank / model</span>
              <span role="columnheader">Point score</span>
              <span role="columnheader">Top-20 move</span>
              <span role="columnheader">Legal</span>
              <span role="columnheader">Avg. latency</span>
              <span role="columnheader">Tokens</span>
              <span aria-hidden="true" />
            </div>
            {runs.map((run, index) => (
              <Link href={`/runs/${run.run_id}`} className="leaderboard-row" role="row" key={run.run_id}>
                <span className="model-cell" role="cell">
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  <ModelLogo model={run.model} />
                  <span><b>{modelName(run.model)}</b><small>{run.reasoning_effort} reasoning · {run.preset} · {run.boards} board{run.boards === 1 ? "" : "s"}</small></span>
                </span>
                <span className="score-cell" role="cell"><strong>{pct(run.summary.score_pct)}</strong><small>{run.summary.points} / {run.summary.optimal_points} pts</small></span>
                <span role="cell"><b>{pct(run.summary.top_20_move_pct ?? 0)}</b><small>{run.summary.top_20_moves ?? 0} / {run.boards}</small></span>
                <span role="cell"><b>{pct(run.summary.legal_pct)}</b><small>{run.summary.legal} / {run.boards}</small></span>
                <span role="cell"><b>{duration(run)}</b><small>per board</small></span>
                <span role="cell"><b>{run.summary.total_tokens.toLocaleString()}</b><small>total</small></span>
                <span className="row-arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p className="kicker">No runs yet</p>
            <h3>The benchmark is ready.</h3>
            <p>Generate the first model record with the smoke preset.</p>
            <code>python3 -m scrabble3d_bench run --preset smoke</code>
          </div>
        )}
      </section>

      <section className="benchmark-note">
        <span>What counts</span>
        <p>A result counts as exact-optimal only when the model returns new tile placements as <code>(x, y, z, letter)</code> in one raw JSON tool envelope, with no candidates or solver hints.</p>
        <Link href="/protocol">Read the evaluation contract →</Link>
      </section>
    </div>
  );
}
