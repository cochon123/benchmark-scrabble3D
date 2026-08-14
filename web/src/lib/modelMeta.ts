const LOGO_ROOT = "https://raw.githubusercontent.com/cochon123/benchmark_scrabble/master/web/public/logos";

const providers = {
  openai: { name: "OpenAI", initials: "OA", logo: "openai_logo.png" },
  anthropic: { name: "Anthropic", initials: "AN", logo: "claude_logo.png" },
  google: { name: "Google", initials: "GO", logo: "gemini_logo.png" },
  xai: { name: "xAI", initials: "xAI", logo: "grok_logo.png" },
  deepseek: { name: "DeepSeek", initials: "DS", logo: "deepseek_logo.png" },
  moonshot: { name: "Moonshot AI", initials: "KI", logo: "kimi_logo.png" },
  qwen: { name: "Qwen", initials: "QW", logo: "qwen_logo.png" },
  meta: { name: "Meta", initials: "ME", logo: "meta_logo.png" },
  nvidia: { name: "NVIDIA", initials: "NV", logo: "nvidia_logo.png" },
  minimax: { name: "MiniMax", initials: "MM", logo: "minimax_logo.png" },
  xiaomi: { name: "Xiaomi", initials: "MI", logo: "xiaomi_mimo_logo.png" },
  zai: { name: "Z.AI", initials: "ZA", logo: "z_ai_logo.png" },
  mistral: { name: "Mistral AI", initials: "MS", logo: null },
  microsoft: { name: "Microsoft", initials: "MS", logo: null },
  unknown: { name: "Model", initials: "AI", logo: null },
} as const;

export type ProviderKey = keyof typeof providers;

export function modelName(model: string) {
  return model.replace(/^codex\//, "").replace(/^cli2api\//, "").replace(/^openrouter\//, "");
}

export function providerForModel(model: string): ProviderKey {
  const value = model.toLowerCase();
  if (/claude|anthropic/.test(value)) return "anthropic";
  if (/gemini|google/.test(value)) return "google";
  if (/deepseek/.test(value)) return "deepseek";
  if (/grok|xai|x-ai/.test(value)) return "xai";
  if (/qwen/.test(value)) return "qwen";
  if (/glm|z-ai|zai/.test(value)) return "zai";
  if (/llama|meta/.test(value)) return "meta";
  if (/mistral|mixtral/.test(value)) return "mistral";
  if (/kimi|moonshot/.test(value)) return "moonshot";
  if (/minimax/.test(value)) return "minimax";
  if (/mimo|xiaomi/.test(value)) return "xiaomi";
  if (/nvidia|nemotron/.test(value)) return "nvidia";
  if (/phi|microsoft/.test(value)) return "microsoft";
  if (/codex|gpt|openai|o[134](?:\b|-)/.test(value)) return "openai";
  return "unknown";
}

export function modelMeta(model: string) {
  const key = providerForModel(model);
  const provider = providers[key];
  return {
    ...provider,
    key,
    logoUrl: provider.logo ? `${LOGO_ROOT}/${provider.logo}` : null,
  };
}
