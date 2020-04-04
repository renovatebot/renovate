export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
export { updateDependency } from './update';

export const defaultConfig = {
  fileMatch: ['(^|/)gradle/wrapper/gradle-wrapper.properties$'],
};
