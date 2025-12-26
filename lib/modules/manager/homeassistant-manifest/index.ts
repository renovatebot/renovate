import type { Category } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';

export { extractPackageFile } from './extract';

export const displayName = 'Home Assistant';
export const url =
  'https://developers.home-assistant.io/docs/creating_integration_manifest/#requirements';

export const defaultConfig = {
  fileMatch: ['(^|/)manifest\\.json$'],
};

export const categories: Category[] = ['python'];

export const supportedDatasources = [PypiDatasource.id];
