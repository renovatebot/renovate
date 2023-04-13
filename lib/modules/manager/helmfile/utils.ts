import upath from 'upath';

import { localPathExists } from '../../../util/fs';
import type { Release } from './types';

/** Returns true if a helmfile release contains kustomize specific keys **/
export function kustomizationsKeysUsed(release: Release): boolean {
  return (
    release.strategicMergePatches !== undefined ||
    release.jsonPatches !== undefined ||
    release.transformers !== undefined
  );
}

/** Returns true if a helmfile release uses a local chart with a kustomization.yaml file **/
// eslint-disable-next-line require-await
export async function localChartHasKustomizationsYaml(
  release: Release
): Promise<boolean> {
  return localPathExists(upath.join(release.chart, 'kustomization.yaml'));
}
