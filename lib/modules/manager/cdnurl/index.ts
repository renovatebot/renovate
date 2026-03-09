import type { Category } from '../../../constants/index.ts';
import { CdnjsDatasource } from '../../datasource/cdnjs/index.ts';
import * as semverVersioning from '../../versioning/semver/index.ts';
import { extractPackageFile } from './extract.ts';

export { extractPackageFile };

export const displayName = 'CDN URL';
export const categories: Category[] = ['cd'];

export const defaultConfig = {
  managerFilePatterns: [],
  versioning: semverVersioning.id,
};

export const supportedDatasources = [CdnjsDatasource.id];
