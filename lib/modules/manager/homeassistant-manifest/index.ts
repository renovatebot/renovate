import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'Home Assistant Manifest';
export const url =
  'https://developers.home-assistant.io/docs/creating_integration_manifest/#requirements';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)manifest\\.json$/'],
};

export const categories: Category[] = ['python'];

export const supportedDatasources = [PypiDatasource.id, GitTagsDatasource.id];
