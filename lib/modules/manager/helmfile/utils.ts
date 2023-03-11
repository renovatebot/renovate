import type { Release } from './types';

/** Returns true if kustomize specific keys exist in a helmfile release */
export function areKustomizationsUsed(release: Release): boolean {
  return Boolean(
    release.strategicMergePatches || release.jsonPatches || release.transformers
  );
}
