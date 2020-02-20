import * as rubyVersioning from '../../versioning/ruby';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  enabled: false,
  fileMatch: ['(^|/)Podfile$'],
  versionScheme: rubyVersioning.id,
};
