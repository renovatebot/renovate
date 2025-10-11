import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import * as swiftVersioning from '../../versioning/swift';

export { extractPackageFile } from './extract';
export { getRangeStrategy } from './range';

export const displayName = 'Swift Package Manager';
export const url = 'https://www.swift.org/package-manager';
export const categories: Category[] = ['swift'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)Package\\.swift/'],
  versioning: swiftVersioning.id,
  pinDigests: false,
};

export const supportedDatasources = [
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
];
