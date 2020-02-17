import { VERSION_SCHEME_GIT } from '../../constants/version-schemes';

export { default as extractPackageFile } from './extract';
export { default as updateDependency } from './update';
export { default as updateArtifacts } from './artifacts';

export const defaultConfig = {
  enabled: false,
  versioning: VERSION_SCHEME_GIT,
  fileMatch: ['(^|/).gitmodules$'],
};
