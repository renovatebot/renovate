import type { Release } from './types';

/** Looks for kustomize specific keys in a helmfile and returns true if found */
export function areKustomizationsUsed(release: Release): boolean {
  return Boolean(
    release.strategicMergePatches || release.jsonPatches || release.transformers
  );
}
