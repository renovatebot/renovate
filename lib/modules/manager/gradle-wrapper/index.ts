import type { Category } from '../../../constants';
import { GradleVersionDatasource } from '../../datasource/gradle-version';
import { id as versioning } from '../../versioning/gradle';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['(^|/)gradle/wrapper/gradle-wrapper\\.properties$'],
  versioning,
};

export const categories: Category[] = ['java'];

export const supportedDatasources = [GradleVersionDatasource.id];
