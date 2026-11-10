import type { Category } from '../../../constants/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';

export { extractPackageFile } from './extract.ts';

export const url =
  'https://scalameta.org/scalafmt/docs/configuration.html#version';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.scalafmt.conf$/'],
};

export const supportedDatasources = [GithubReleasesDatasource.id];
