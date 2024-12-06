import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';

export { extractPackageFile } from './extract';

export const url =
  'https://scalameta.org/scalafmt/docs/configuration.html#version';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  fileMatch: ['(^|/)\\.scalafmt.conf$'],
};

export const supportedDatasources = [GithubReleasesDatasource.id];
