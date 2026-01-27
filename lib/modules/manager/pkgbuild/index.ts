import type { Category } from '../../../constants/index.ts';
import { CpanDatasource } from '../../datasource/cpan/index.ts';
import { ForgejoTagsDatasource } from '../../datasource/forgejo-tags/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PackagistDatasource } from '../../datasource/packagist/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { RepologyDatasource } from '../../datasource/repology/index.ts';

export { extractPackageFile } from './extract.ts';
export { updateDependency } from './update.ts';

export const displayName = 'PKGBUILD';
export const url = 'https://wiki.archlinux.org/title/PKGBUILD';
export const categories: Category[] = ['custom'];

export const defaultConfig = {
  commitMessageTopic: 'PKGBUILD package {{depName}}',
  managerFilePatterns: ['**/PKGBUILD'],
};

export const supportedDatasources = [
  CpanDatasource.id,
  ForgejoTagsDatasource.id,
  GitTagsDatasource.id,
  GiteaTagsDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  NpmDatasource.id,
  PackagistDatasource.id,
  PypiDatasource.id,
  RepologyDatasource.id,
];
