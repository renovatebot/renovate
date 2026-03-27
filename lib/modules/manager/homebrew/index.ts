import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';

export { extractPackageFile } from './extract.ts';
export { updateDependency } from './update.ts';

export const url = 'https://brew.sh';

export const defaultConfig = {
  commitMessageTopic: 'Homebrew Formula {{depName}}',
  managerFilePatterns: ['/^Formula/[^/]+[.]rb$/'],
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GithubReleasesDatasource.id,
  NpmDatasource.id,
];
