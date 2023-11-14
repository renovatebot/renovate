import upath from 'upath';

import { getParentDir, localPathExists } from '../../../util/fs';
import * as hostRules from '../../../util/host-rules';
import { DockerDatasource } from '../../datasource/docker';
import { generateLoginCmd } from '../helmv3/common';
import type { RepositoryRule } from '../helmv3/types';

import type { HelmRelease, HelmRepository } from './schema';

/** Returns true if a helmfile release contains kustomize specific keys **/
export function kustomizationsKeysUsed(release: HelmRelease): boolean {
  return (
    release.strategicMergePatches !== undefined ||
    release.jsonPatches !== undefined ||
    release.transformers !== undefined
  );
}

/** Returns true if a helmfile release uses a local chart with a kustomization.yaml file **/
// eslint-disable-next-line require-await
export async function localChartHasKustomizationsYaml(
  release: HelmRelease,
  helmFileYamlFileName: string,
): Promise<boolean> {
  const helmfileYamlParentDir = getParentDir(helmFileYamlFileName) || '';
  return localPathExists(
    upath.join(helmfileYamlParentDir, release.chart, 'kustomization.yaml'),
  );
}

export function isOCIRegistry(repository: HelmRepository): boolean {
  return repository.oci === true;
}

export async function generateRegistryLoginCmd(
  repositoryName: string,
  repositoryBaseURL: string,
  repositoryHost: string,
): Promise<string | null> {
  const repositoryRule: RepositoryRule = {
    name: repositoryName,
    repository: repositoryHost,
    hostRule: hostRules.find({
      url: repositoryBaseURL,
      hostType: DockerDatasource.id,
    }),
  };

  return await generateLoginCmd(repositoryRule, 'helm registry login');
}
