import type { Category } from '../../../constants/index.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
import { systemManifestFileNameRegex } from './common.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractAllPackageFiles, extractPackageFile } from './extract.ts';

export const url = 'https://fluxcd.io/flux';
export const categories: Category[] = ['cd', 'kubernetes'];

export const defaultConfig = {
  managerFilePatterns: [`/${systemManifestFileNameRegex}/`],
};

export const supportedDatasources = [
  GithubReleasesDatasource.id,
  GitRefsDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  GitTagsDatasource.id,
  BitbucketTagsDatasource.id,
  HelmDatasource.id,
  DockerDatasource.id,
];
