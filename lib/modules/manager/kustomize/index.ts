import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const url = 'https://kubectl.docs.kubernetes.io/references/kustomize';
export const categories: Category[] = ['kubernetes'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)kustomization\\.ya?ml$/'],
  pinDigests: false,
};

export const supportedDatasources: DatasourceName[] = [
  DockerDatasource.id,
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  HelmDatasource.id,
];

export { knownDepTypes } from './dep-types.ts';
