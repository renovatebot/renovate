import type { Category } from '../../../constants';
import { HelmDatasource } from '../../datasource/helm';
import { FILE_MATCH_REGEX } from './matcher';
import type { PluralConfig } from './types';

export { extractAllPackageFiles, extractPackageFile } from './extract';

export const defaultConfig: Partial<PluralConfig> = {
  fileMatch: [FILE_MATCH_REGEX],
};

export const categories: Category[] = ['plural', 'helm', 'kubernetes'];

export const supportedDatasources = [HelmDatasource.id];
