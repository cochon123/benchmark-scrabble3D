export type Placement = {
  x: number;
  y: number;
  z: number;
  letter: string;
  is_blank?: boolean;
};

export type Move = {
  placements: Placement[];
  score: number;
  words: string[];
  axis: "x" | "y" | "z" | null;
};

export type Position = {
  id: string;
  density: string;
  dataset_version: string;
  board_size: number;
  board: Placement[];
  rack: string;
  optimal_score: number;
  optimal_moves: Move[];
  canonical_optimal_move: Move;
};

export type RunResult = {
  position_id: string;
  score: number;
  optimal_score: number;
  score_pct: number;
  is_legal: boolean;
  is_optimal: boolean;
  move: Move | null;
  error: string | null;
  latency_ms: number;
  raw_response?: string;
  reasoning?: string | null;
  reasoning_content?: string | null;
  thinking?: string | null;
  canonical_optimal_move?: Move;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    estimated_cost_usd?: number;
  };
  estimated_cost_usd?: number;
};

export type BenchmarkRun = {
  run_id: string;
  dataset_version?: string;
  board_size?: number;
  created_at: string;
  model: string;
  reasoning_effort: string;
  preset: string;
  boards: number;
  status: string;
  release_date?: string | null;
  release_date_source?: "run" | "cli2api_catalog" | null;
  total_estimated_cost_usd?: number | null;
  cost_source?: "run" | "cli2api_catalog" | null;
  summary: {
    legal: number;
    legal_pct: number;
    exact_optimal: number;
    exact_optimal_pct: number;
    points: number;
    optimal_points: number;
    score_pct: number;
    latency_ms: number;
    total_tokens: number;
    avg_total_tokens?: number;
    min_total_tokens?: number;
    max_total_tokens?: number;
    total_estimated_cost_usd?: number | null;
    total_cost_usd?: number | null;
  };
  results: RunResult[];
};
