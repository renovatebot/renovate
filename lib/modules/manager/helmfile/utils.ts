import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import upath from 'upath';

import { getParentDir, localPathExists } from '../../../util/fs';
import * as hostRules from '../../../util/host-rules';
import { DockerDatasource } from '../../datasource/docker';
import { generateLoginCmd } from '../helmv3/common';
import type { RepositoryRule } from '../helmv3/types';

import { DocSchema } from './schema';
import type { Doc, Release, Repository } from './types';

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

export function getRepositories(doc: Doc): Repository[] {
  if (is.nullOrUndefined(doc.repositories)) {
    return [];
  }

  return doc.repositories;
}

export function isOCIRegistry(repository: Repository): boolean {
  return repository.oci === true;
}

export function generateRegistryLoginCmd(
  repositoryName: string,
  repositoryURL: string,
  repositoryHost: string
): string | null {
  const repositoryRule: RepositoryRule = {
    name: repositoryName,
    repository: repositoryHost,
    hostRule: hostRules.find({
      url: repositoryURL,
      hostType: DockerDatasource.id,
    }),
  };

  return generateLoginCmd(repositoryRule, 'helm registry login');
}
