import type { Category } from '../../../constants';
import { CpanDatasource } from '../../datasource/cpan';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { NpmDatasource } from '../../datasource/npm';
import { PackagistDatasource } from '../../datasource/packagist';
import { PypiDatasource } from '../../datasource/pypi';
import { RepologyDatasource } from '../../datasource/repology';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const displayName = 'PKGBUILD';
export const url = 'https://wiki.archlinux.org/title/PKGBUILD';
export const categories: Category[] = ['custom'];

export const defaultConfig = {
  commitMessageTopic: 'PKGBUILD package {{depName}}',
  managerFilePatterns: ['(^|/)PKGBUILD$'],
};

export const supportedDatasources = [
  CpanDatasource.id,
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  NpmDatasource.id,
  PackagistDatasource.id,
  PypiDatasource.id,
  RepologyDatasource.id,
];
