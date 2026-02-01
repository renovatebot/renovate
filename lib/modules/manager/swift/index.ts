import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import * as swiftVersioning from '../../versioning/swift/index.ts';

export { extractPackageFile } from './extract.ts';
export { getRangeStrategy } from './range.ts';

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
