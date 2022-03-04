import { MavenDatasource } from '../../datasource/maven';
import { id as versioningId } from '../../versioning/maven';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['(^|/).mvn/wrapper/maven-wrapper.properties$'],
  versioningId,
};

export const supportedDatasources = [MavenDatasource.id];
