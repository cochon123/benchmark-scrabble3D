import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { BenchmarkRun, Position } from "@/lib/types";

function repositoryRoot() {
  const current = process.cwd();
  return path.basename(current) === "web" ? path.dirname(current) : current;
}

export function getPositions(): Position[] {
  const filename = path.join(repositoryRoot(), "data", "dataset", "positions.json");
  if (!fs.existsSync(filename)) return [];
  return JSON.parse(fs.readFileSync(filename, "utf8")) as Position[];
}

export function getRuns(datasetVersion?: string): BenchmarkRun[] {
  const directory = path.join(repositoryRoot(), "data", "results");
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((filename) => filename.endsWith(".json"))
    .map((filename) => enrichRunMetadata(JSON.parse(fs.readFileSync(path.join(directory, filename), "utf8")) as BenchmarkRun))
    .filter((run) => !datasetVersion || run.dataset_version === datasetVersion)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

type CatalogModel = {
  id?: string;
  created?: number;
  pricing?: { prompt?: string; completion?: string };
};

let catalogModels: CatalogModel[] | null | undefined;

function cli2apiCatalog(): CatalogModel[] | null {
  if (catalogModels !== undefined) return catalogModels;
  const cacheRoot = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  const filename = path.join(cacheRoot, "cli2api", "openrouter-models.json");
  try {
    const payload = JSON.parse(fs.readFileSync(filename, "utf8")) as { data?: CatalogModel[] };
    catalogModels = Array.isArray(payload.data) ? payload.data : null;
  } catch {
    catalogModels = null;
  }
  return catalogModels;
}

function catalogId(model: string) {
  return model
    .replace(/^codex\//, "openai/")
    .replace(/^cli2api\//, "")
    .replace(/:batch$/, "");
}

function enrichRunMetadata(run: BenchmarkRun): BenchmarkRun {
  const catalog = cli2apiCatalog();
  if (!catalog) return run;
  const expected = catalogId(run.model);
  const metadata = catalog.find((model) => model.id === expected);
  if (!metadata) return run;

  const promptPrice = Number(metadata.pricing?.prompt);
  const completionPrice = Number(metadata.pricing?.completion);
  const canEstimate = Number.isFinite(promptPrice) && Number.isFinite(completionPrice);
  const estimatedCost = canEstimate
    ? run.results.reduce((total, result) => total
      + (result.usage?.prompt_tokens ?? 0) * promptPrice
      + (result.usage?.completion_tokens ?? 0) * completionPrice, 0)
    : null;
  const results = run.results.map((result) => ({
    ...result,
    estimated_cost_usd: result.estimated_cost_usd ?? (canEstimate
      ? (result.usage?.prompt_tokens ?? 0) * promptPrice
        + (result.usage?.completion_tokens ?? 0) * completionPrice
      : undefined),
  }));

  return {
    ...run,
    release_date: run.release_date ?? (metadata.created ? new Date(metadata.created * 1000).toISOString() : null),
    release_date_source: run.release_date ? "run" : metadata.created ? "cli2api_catalog" : null,
    total_estimated_cost_usd: run.total_estimated_cost_usd ?? estimatedCost,
    cost_source: run.total_estimated_cost_usd != null ? "run" : estimatedCost != null ? "cli2api_catalog" : null,
    results,
  };
}
