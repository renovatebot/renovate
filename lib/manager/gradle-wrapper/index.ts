import { id as versioning } from '../../versioning/gradle';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['(^|/)gradle/wrapper/gradle-wrapper.properties$'],
  versioning,
};
