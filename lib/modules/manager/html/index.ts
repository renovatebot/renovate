import type { Category } from '../../../constants/index.ts';
import { CdnjsDatasource } from '../../datasource/cdnjs/index.ts';
import * as semverVersioning from '../../versioning/semver/index.ts';
import { extractPackageFile } from './extract.ts';

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
