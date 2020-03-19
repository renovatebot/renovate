import * as gitVersioning from '../../versioning/git';

export { default as extractPackageFile } from './extract';
export { default as updateDependency } from './update';
export { default as updateArtifacts } from './artifacts';

export const defaultConfig = {
  enabled: false,
  versioning: gitVersioning.id,
  fileMatch: ['(^|/).gitmodules$'],
};
