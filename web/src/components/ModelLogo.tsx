"use client";

import { modelMeta } from "@/lib/modelMeta";

export function ModelLogo({ model, large = false }: { model: string; large?: boolean }) {
  const meta = modelMeta(model);
  return (
    <span className={`model-logo provider-${meta.key}${large ? " large" : ""}`} title={meta.name} aria-label={`${meta.name} logo`}>
      <span aria-hidden="true">{meta.initials}</span>
      {meta.logoUrl ? (
        // The benchmark's original, curated provider marks are served from its public repository.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meta.logoUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
      ) : null}
    </span>
  );
}
