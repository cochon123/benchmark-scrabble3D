import Link from "next/link";

import { ModelLogo } from "@/components/ModelLogo";
import { modelMeta, modelName } from "@/lib/modelMeta";
import type { BenchmarkRun } from "@/lib/types";

type ChartRow = {
  runId: string;
  model: string;
  name: string;
  reasoningEffort: string;
  score: number;
  averageTokens: number;
  minTokens: number;
  maxTokens: number;
  releaseTimestamp: number;
  releaseIsFallback: boolean;
  releaseSource: BenchmarkRun["release_date_source"];
  cost: number | null;
};

function tokenValues(run: BenchmarkRun) {
  const recorded = run.results
    .map((result) => result.usage?.total_tokens)
    .filter((value): value is number => typeof value === "number");
  const average = run.summary.avg_total_tokens ?? run.summary.total_tokens / Math.max(run.boards, 1);
  return {
    average,
    min: run.summary.min_total_tokens ?? (recorded.length ? Math.min(...recorded) : average),
    max: run.summary.max_total_tokens ?? (recorded.length ? Math.max(...recorded) : average),
  };
}

function chartRows(runs: BenchmarkRun[]): ChartRow[] {
  return runs.map((run) => {
    const tokens = tokenValues(run);
    const releaseDate = run.release_date || run.created_at;
    return {
      runId: run.run_id,
      model: run.model,
      name: modelName(run.model),
      reasoningEffort: run.reasoning_effort,
      score: run.summary.score_pct,
      averageTokens: tokens.average,
      minTokens: tokens.min,
      maxTokens: tokens.max,
      releaseTimestamp: new Date(releaseDate).getTime(),
      releaseIsFallback: !run.release_date,
      releaseSource: run.release_date_source,
      cost: run.total_estimated_cost_usd ?? run.summary.total_estimated_cost_usd ?? run.summary.total_cost_usd ?? null,
    };
  });
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function PerformanceBars({ rows }: { rows: ChartRow[] }) {
  const ranked = [...rows].sort((a, b) => b.score - a.score);
  return (
    <section className="chart-panel chart-wide score-bars-panel">
      <div className="chart-heading">
        <div><h3>Performance by model</h3></div>
        <p>Point score · diagnostic</p>
      </div>
      <div className="performance-bars">
        <div className="performance-axis" aria-hidden="true"><span /><span /><span /><span><i>0</i><i>25</i><i>50</i><i>75</i><i>100%</i></span></div>
        {ranked.map((row, index) => (
          <Link href={`/runs/${row.runId}`} className="performance-row" key={row.runId}>
            <span className="chart-rank">{String(index + 1).padStart(2, "0")}</span>
            <ModelLogo model={row.model} />
            <span className="performance-name"><b>{row.name} <small>({row.reasoningEffort})</small></b></span>
            <span className="performance-track" aria-label={`${row.name}: ${row.score.toFixed(1)} percent point score`}>
              <i className="score-bar" style={{ width: `${Math.max(0, Math.min(row.score, 100))}%` }} />
              <b style={{ left: `${Math.max(1, Math.min(row.score, 94))}%` }}>{row.score.toFixed(1)}%</b>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ScatterPlot({ rows, xValue, xLabel, title, formatX, emptyText }: {
  rows: ChartRow[];
  xValue: (row: ChartRow) => number | null;
  xLabel: string;
  title: string;
  formatX: (value: number) => string;
  emptyText: string;
}) {
  const points = rows.map((row) => ({ row, x: xValue(row) })).filter((item): item is { row: ChartRow; x: number } => item.x !== null && Number.isFinite(item.x));
  const width = 680;
  const height = 310;
  const left = 60;
  const right = 24;
  const top = 20;
  const bottom = 52;
  const values = points.map((point) => point.x);
  const minRaw = values.length ? Math.min(...values) : 0;
  const maxRaw = values.length ? Math.max(...values) : 1;
  const padding = minRaw === maxRaw ? Math.max(Math.abs(minRaw) * 0.12, 0.000001) : (maxRaw - minRaw) * 0.08;
  const min = Math.max(0, minRaw - padding);
  const max = maxRaw + padding;
  const x = (value: number) => left + ((value - min) / Math.max(max - min, Number.EPSILON)) * (width - left - right);
  const y = (value: number) => top + (1 - value / 100) * (height - top - bottom);
  const xTicks = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4);

  return (
    <section className="chart-panel">
      <div className="chart-heading"><div><h3>{title}</h3></div></div>
      {points.length ? (
        <div className="svg-chart">
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}. Y-axis is diagnostic point score.`}>
            {[0, 25, 50, 75, 100].map((tick) => <g key={tick}><line className="chart-gridline" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text className="chart-axis-text" x={left - 10} y={y(tick) + 4} textAnchor="end">{tick}%</text></g>)}
            {xTicks.map((tick, index) => <g key={index}><line className="chart-tickline" x1={x(tick)} x2={x(tick)} y1={top} y2={height - bottom} /><text className="chart-axis-text" x={x(tick)} y={height - 25} textAnchor="middle">{formatX(tick)}</text></g>)}
            <text className="chart-axis-label" x={(left + width - right) / 2} y={height - 2} textAnchor="middle">{xLabel}</text>
            {points.map(({ row, x: value }) => {
              const cx = x(value);
              const cy = y(row.score);
              const tooltipX = cx > width - 270 ? cx - 250 : cx + 16;
              const tooltipY = cy < 100 ? cy + 18 : cy - 86;
              const logo = modelMeta(row.model).logoUrl;
              const release = new Date(row.releaseTimestamp).toLocaleDateString("en", { month: "short", year: "numeric" });
              const isReleaseChart = xLabel.startsWith("Release");
              const detail = isReleaseChart
                ? `${row.releaseIsFallback ? "First run" : row.releaseSource === "cli2api_catalog" ? "Catalog release" : "Released"} · ${release}`
                : `Price · ${row.cost == null ? "—" : `$${row.cost < 0.01 ? row.cost.toFixed(4) : row.cost.toFixed(2)}`}`;
              return (
                <a href={`/runs/${row.runId}`} key={row.runId}>
                  <g className={`scatter-point ${row.releaseIsFallback && xLabel.startsWith("Release") ? "date-fallback" : ""}`}>
                    <circle cx={cx} cy={cy} r="8" />
                    <circle className="scatter-ring" cx={cx} cy={cy} r="13" />
                    <g className="scatter-tooltip" style={{ zIndex: 10, pointerEvents: "none" }}>
                      <rect x={tooltipX} y={tooltipY} width="234" height="72" rx="9" />
                      {logo ? <image href={logo} x={tooltipX + 12} y={tooltipY + 17} width="38" height="38" preserveAspectRatio="xMidYMid meet" /> : null}
                      <text className="tooltip-name" x={tooltipX + 61} y={tooltipY + 20}>{row.name}</text>
                      <text x={tooltipX + 61} y={tooltipY + 39}>Score {row.score.toFixed(1)}%</text>
                      <text x={tooltipX + 61} y={tooltipY + 56}>{detail}</text>
                    </g>
                  </g>
                </a>
              );
            })}
          </svg>
        </div>
      ) : <div className="chart-empty"><span>—</span><p>{emptyText}</p></div>}
    </section>
  );
}

function TokenRange({ rows }: { rows: ChartRow[] }) {
  const width = 1100;
  const labelWidth = 210;
  const rowHeight = 54;
  const top = 42;
  const height = top + rows.length * rowHeight + 16;
  const maximum = Math.max(...rows.map((row) => row.maxTokens), 1);
  const x = (value: number) => labelWidth + (value / maximum) * (width - labelWidth - 28);
  const ticks = Array.from({ length: 6 }, (_, index) => (maximum * index) / 5);
  return (
    <section className="chart-panel chart-wide">
      <div className="chart-heading"><div><h3>Token range</h3></div></div>
      <div className="svg-chart token-range-chart">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Token range by model">
          {ticks.map((tick, index) => <g key={index}><line className="chart-tickline" x1={x(tick)} x2={x(tick)} y1={20} y2={height - 8} /><text className="chart-axis-text" x={x(tick)} y={13} textAnchor={index === 0 ? "start" : index === ticks.length - 1 ? "end" : "middle"}>{compactNumber(tick)}</text></g>)}
          {rows.map((row, index) => {
            const cy = top + index * rowHeight + rowHeight / 2;
            return <g key={row.runId}>
              <foreignObject x="0" y={cy - 17} width={labelWidth - 12} height="38"><div className="range-model"><ModelLogo model={row.model} /><span>{row.name} ({row.reasoningEffort})</span></div></foreignObject>
              <line className="range-line" x1={x(row.minTokens)} x2={x(row.maxTokens)} y1={cy} y2={cy} />
              <circle className="range-dot" cx={x(row.averageTokens)} cy={cy} r="7"><title>{`${row.name}: ${compactNumber(row.minTokens)} — ${compactNumber(row.averageTokens)} — ${compactNumber(row.maxTokens)}`}</title></circle>
            </g>;
          })}
        </svg>
      </div>
    </section>
  );
}

export function BenchmarkCharts({ runs }: { runs: BenchmarkRun[] }) {
  const rows = chartRows(runs);
  if (!rows.length) return null;
  return (
    <section className="analytics-section" aria-labelledby="analytics-title">
      <div className="section-heading analytics-heading">
        <div><h2 id="analytics-title">Compare every run</h2></div>
        <p>Overview charts use point score as a diagnostic. Exact-optimal accuracy is reserved for each model’s run detail.</p>
      </div>
      <div className="charts-grid">
        <PerformanceBars rows={rows} />
        <ScatterPlot rows={rows} xValue={(row) => row.releaseTimestamp} xLabel="Release date · hollow point uses first benchmarked date" title="Score vs. release time" formatX={(value) => new Date(value).toLocaleDateString("en", { month: "short", year: "numeric" })} emptyText="Add release_date to a run to compare model chronology." />
        <ScatterPlot rows={rows} xValue={(row) => row.averageTokens} xLabel="Average tokens per board" title="Score vs. average tokens" formatX={compactNumber} emptyText="Token usage has not been recorded yet." />
        <TokenRange rows={rows} />
        <ScatterPlot rows={rows} xValue={(row) => row.cost} xLabel="Estimated API-equivalent cost · USD" title="Price vs. score" formatX={(value) => `$${value < .01 ? value.toFixed(4) : value < 1 ? value.toFixed(2) : value.toFixed(0)}`} emptyText="No pricing metadata is available from the cli2api model catalog." />
      </div>
    </section>
  );
}
