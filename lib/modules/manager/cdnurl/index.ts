import type { Category } from '../../../constants';
import { CdnjsDatasource } from '../../datasource/cdnjs';
import * as semverVersioning from '../../versioning/semver';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const displayName = 'CDN URL';
export const categories: Category[] = ['cd'];

export const defaultConfig = {
  managerFilePatterns: [],
  versioning: semverVersioning.id,
};

export const supportedDatasources = [CdnjsDatasource.id];
