import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { extractPackageFile } from './extract.ts';

export { knownDepTypes } from './dep-types.ts';

export { extractPackageFile };

export const url = 'https://tekton.dev/docs';
export const categories: Category[] = ['ci', 'cd'];

export const defaultConfig = {
  managerFilePatterns: [],
};

export const supportedDatasources: DatasourceName[] = [
  DockerDatasource.id,
  GithubReleasesDatasource.id,
  GitTagsDatasource.id,
];
