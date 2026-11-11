import upath from 'upath';

import { logger } from '../../../logger/index.ts';
import {
  getParentDir,
  isValidLocalPath,
  localPathExists,
} from '../../../util/fs/index.ts';

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
export async function localChartHasKustomizationsYaml(
  release: HelmRelease,
  helmFileYamlFileName: string,
): Promise<boolean> {
  const helmfileYamlParentDir = getParentDir(helmFileYamlFileName) || '';
  const kustomizationYaml = upath.join(
    helmfileYamlParentDir,
    release.chart,
    'kustomization.yaml',
  );
  // Charts outside the repository (e.g. `../../other-repo/chart`, or a templated
  // `{{ .Values.repo }}/chart` that becomes `/chart` once templates are removed)
  // cannot be inspected.
  if (!isValidLocalPath(kustomizationYaml)) {
    logger.debug(
      { chart: release.chart, packageFile: helmFileYamlFileName },
      'helmfile: local chart is outside the repository, skipping kustomization.yaml check',
    );
    return false;
  }
  return await localPathExists(kustomizationYaml);
}

export function isOciRepositoryFlagSet(repository: HelmRepository): boolean {
  return repository.oci === true;
}
