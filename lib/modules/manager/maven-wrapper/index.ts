import type { Category } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import { id as versioning } from '../../versioning/maven';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['(^|\\/).mvn/wrapper/maven-wrapper.properties$'],
  versioning,
};

export const categories: Category[] = ['java'];

export const supportedDatasources = [MavenDatasource.id];
