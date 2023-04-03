import type { Release } from './types';

/** Returns true if kustomize specific keys exist in a helmfile release */
export function areKustomizationsUsed(release: Release): boolean {
  return (
    release.strategicMergePatches !== undefined ||
    release.jsonPatches !== undefined ||
    release.transformers !== undefined
  );
}
