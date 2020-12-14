import * as gradleVersioning from '../../versioning/gradle';

export { extractAllPackageFiles } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  fileMatch: ['(^|/)gradle.properties$', '\\.gradle(\\.kts)?$'],
  versioning: gradleVersioning.id,
  enabled: false,
};
