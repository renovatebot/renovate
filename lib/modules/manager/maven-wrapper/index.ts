import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const url = 'https://maven.apache.org/tools/wrapper';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|\\/).mvn/wrapper/maven-wrapper.properties$/',
    '/(^|\\/)mvnw(.cmd)?$/',
  ],
};

export const supportedDatasources: DatasourceName[] = [MavenDatasource.id];
