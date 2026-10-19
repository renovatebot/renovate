import upath from 'upath';

import { getParentDir, localPathExists } from '../../../util/fs/index.ts';

import type { HelmRelease, HelmRepository } from './schema.ts';

/** Returns true if a helmfile release contains kustomize specific keys **/
export function kustomizationsKeysUsed(release: HelmRelease): boolean {
  return (
    release.strategicMergePatches !== undefined ||
    release.jsonPatches !== undefined ||
    release.transformers !== undefined
  );
}

/** Returns true if a helmfile release uses a local chart with a kustomization.yaml file **/
export function localChartHasKustomizationsYaml(
  release: HelmRelease,
  helmFileYamlFileName: string,
): Promise<boolean> {
  const helmfileYamlParentDir = getParentDir(helmFileYamlFileName) || '';
  return localPathExists(
    upath.join(helmfileYamlParentDir, release.chart, 'kustomization.yaml'),
  );
}

export function isOciRepositoryFlagSet(repository: HelmRepository): boolean {
  return repository.oci === true;
}
