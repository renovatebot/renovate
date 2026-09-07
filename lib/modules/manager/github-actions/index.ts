import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { ForgejoTagsDatasource } from '../../datasource/forgejo-tags/index.ts';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags/index.ts';
import { GithubDigestDatasource } from '../../datasource/github-digest/index.ts';
import { GithubReleaseAttachmentsDatasource } from '../../datasource/github-release-attachments/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubRunnersDatasource } from '../../datasource/github-runners/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
import { RustVersionDatasource } from '../../datasource/rust-version/index.ts';

export { knownDepTypes } from './dep-types.ts';
export { extractPackageFile } from './extract.ts';

export const displayName = 'GitHub Actions';
export const url = 'https://docs.github.com/en/actions';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/)(workflow-templates|\\.(?:github|gitea|forgejo)/(?:workflows|actions))/.+\\.ya?ml$/',
    '/(^|/)action\\.ya?ml$/',
  ],
};

export const supportedDatasources = [
  DockerDatasource.id,
  ForgejoTagsDatasource.id,
  GiteaTagsDatasource.id,
  GithubDigestDatasource.id,
  GithubReleaseAttachmentsDatasource.id,
  GithubReleasesDatasource.id,
  GithubRunnersDatasource.id,
  GithubTagsDatasource.id,
  NodeVersionDatasource.id,
  NpmDatasource.id,
  PypiDatasource.id,
  RubyVersionDatasource.id,
  RustVersionDatasource.id,
];
