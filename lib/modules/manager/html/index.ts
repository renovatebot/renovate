import type { Category } from '../../../constants';
import { CdnjsDatasource } from '../../datasource/cdnjs';
import * as semverVersioning from '../../versioning/semver';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const displayName = 'HTML';
export const categories: Category[] = ['cd'];

export const defaultConfig = {
  managerFilePatterns: ['/\\.html?$/'],
  versioning: semverVersioning.id,
  digest: {
    enabled: false,
  },
  pinDigests: false,
};

export const supportedDatasources = [CdnjsDatasource.id];
