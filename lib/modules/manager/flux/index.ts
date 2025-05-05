import type { Category } from '../../../constants';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { DockerDatasource } from '../../datasource/docker';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { HelmDatasource } from '../../datasource/helm';
import { systemManifestFileNameRegex } from './common';

export { extractAllPackageFiles, extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

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
