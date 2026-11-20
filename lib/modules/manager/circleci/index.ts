import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { OrbDatasource } from '../../datasource/orb/index.ts';
import { extractPackageFile } from './extract.ts';

export { getRangeStrategy } from './range.ts';

export { extractPackageFile };

export const displayName = 'CircleCI';
export const url = 'https://circleci.com/docs/configuration-reference';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.circleci/.+\\.ya?ml$/'],
};

export const supportedDatasources = [
  DockerDatasource.id,
  GithubReleasesDatasource.id,
  OrbDatasource.id,
];

export { knownDepTypes } from './dep-types.ts';
