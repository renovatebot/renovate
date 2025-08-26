import type { Category } from '../../../constants';
import { DevboxVersionDatasource } from '../../datasource/devbox-version';
import * as semverVersioning from '../../versioning/semver';

export { extractPackageFile } from './extract';

export const displayName = '.devbox-version';
export const categories: Category[] = ['custom'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.devbox-version$/'],
  versioning: semverVersioning.id,
};

export const supportedDatasources = [DevboxVersionDatasource.id];
