import * as gradleVersioning from '../../versioning/gradle';

export { extractAllPackageFiles } from '../gradle/shallow/extract';
export { updateDependency } from '../gradle/shallow/update';

export const defaultConfig = {
  fileMatch: ['(^|/)gradle.properties$', '\\.gradle(\\.kts)?$'],
  versioning: gradleVersioning.id,
  enabled: false,
};
