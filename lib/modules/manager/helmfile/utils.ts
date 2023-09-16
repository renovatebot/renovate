import yaml from 'js-yaml';
import upath from 'upath';

import { getParentDir, localPathExists } from '../../../util/fs';
import * as hostRules from '../../../util/host-rules';
import { DockerDatasource } from '../../datasource/docker';
import { generateLoginCmd } from '../helmv3/common';
import type { RepositoryRule } from '../helmv3/types';

import { DocSchema, LockSchema } from './schema';
import type { Doc, Lock, Release, Repository } from './types';

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
  release: Release,
  helmFileYamlFileName: string
): Promise<boolean> {
  const helmfileYamlParentDir = getParentDir(helmFileYamlFileName) || '';
  return localPathExists(
    upath.join(helmfileYamlParentDir, release.chart, 'kustomization.yaml')
  );
}

export function parseDoc(packageFileContent: string): Doc {
  const doc = yaml.load(packageFileContent);
  return DocSchema.parse(doc);
}

export function parseLock(lockFileContent: string): Lock {
  const lock = yaml.load(lockFileContent);
  return LockSchema.parse(lock);
}

export function isOCIRegistry(repository: Repository): boolean {
  return repository.oci === true;
}

export function generateRegistryLoginCmd(
  repositoryName: string,
  repositoryBaseURL: string,
  repositoryHost: string
): string | null {
  const repositoryRule: RepositoryRule = {
    name: repositoryName,
    repository: repositoryHost,
    hostRule: hostRules.find({
      url: repositoryBaseURL,
      hostType: DockerDatasource.id,
    }),
  };

  return generateLoginCmd(repositoryRule, 'helm registry login');
}
