import Link from "next/link";
import { notFound } from "next/navigation";

import { ModelLogo } from "@/components/ModelLogo";
import { RunResultReview } from "@/components/RunResultReview";
import { getPositions, getRuns } from "@/lib/data";
import { modelName } from "@/lib/modelMeta";

export const dynamic = "force-dynamic";

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

function price(value?: number | null) {
  if (value == null) return "—";
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = getRuns().find((item) => item.run_id === runId);
  if (!run) notFound();
  const currentPositions = getPositions();
  const currentDatasetVersion = currentPositions[0]?.dataset_version;
  if (run.dataset_version !== currentDatasetVersion) {
    return (
      <div className="page-shell run-page">
        <Link href="/" className="back-link">← Current benchmark</Link>
        <div className="empty-state">
          <p className="kicker">Archived incompatible run</p>
          <h1>This result used the previous 7 × 7 × 7 dataset.</h1>
          <p>It is retained on disk, but is excluded from the 15 × 15 × 15 leaderboard because the datasets are not directly comparable.</p>
        </div>
      </div>
    );
  }
  const positions = new Map(currentPositions.map((position) => [position.id, position]));

  return (
    <div className="page-shell run-page">
      <Link href="/" className="back-link">← All model runs</Link>

      <header className="run-header">
        <div className="run-title">
          <ModelLogo model={run.model} large />
          <div>
            <div className="run-labels"><span>{run.status}</span><span>{run.reasoning_effort} reasoning</span><span>{run.preset}</span></div>
            <h1>{modelName(run.model)}</h1>
            <p>{run.model} · {new Date(run.created_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
        </div>
      </header>

      <section className="run-metrics" aria-label="Run summary">
        <div className="primary-metric"><span>Exact optimal</span><strong>{pct(run.summary.exact_optimal_pct)}</strong><small>{run.summary.exact_optimal} of {run.boards} boards</small></div>
        <div><span>Point ratio <i>diagnostic</i></span><strong>{pct(run.summary.score_pct)}</strong><small>{run.summary.points} / {run.summary.optimal_points} points</small></div>
        <div><span>Legal moves <i>diagnostic</i></span><strong>{pct(run.summary.legal_pct)}</strong><small>{run.summary.legal} of {run.boards} boards</small></div>
        <div><span>Estimated price <i>API equivalent</i></span><strong>{price(run.total_estimated_cost_usd)}</strong><small>{run.summary.total_tokens.toLocaleString()} tokens</small></div>
      </section>

      <section className="results-section">
        <div className="section-heading compact">
          <div><p className="kicker">Board results</p><h2>Every submitted move</h2></div>
          <p>Pink cubes are the model placement. The exact move remains available in the dataset view.</p>
        </div>

        <div className="result-list">
          {run.results.map((result, index) => {
            const position = positions.get(result.position_id);
            if (!position) return null;
            return (
              <RunResultReview result={result} position={position} index={index} key={result.position_id} />
            );
          })}
        </div>
      </section>
    </div>
  );
}
