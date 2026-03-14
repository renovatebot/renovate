import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import * as swiftVersioning from '../../versioning/swift/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'XcodeGen';
export const url = 'https://github.com/yonaskolb/XcodeGen';
export const categories: Category[] = ['swift'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)project\\.yml$/'],
  versioning: swiftVersioning.id,
  pinDigests: false,
};

export const supportedDatasources = [
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
];
