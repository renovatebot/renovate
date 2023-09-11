import type { ProgrammingLanguage } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import * as mavenVersioning from '../../versioning/maven';

export { updateArtifacts } from './lockfile';
export { extractAllPackageFiles } from './extract';
export { bumpPackageVersion, updateDependency } from './update';

export const language: ProgrammingLanguage = 'java';

export const defaultConfig = {
  fileMatch: ['(^|/|\\.)pom\\.xml$', '^(((\\.mvn)|(\\.m2))/)?settings\\.xml$'],
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

export const supportsLockFileMaintenance = true;
