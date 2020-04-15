import * as rubyVersioning from '../../versioning/ruby';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['(^|/)Podfile$'],
  versioning: rubyVersioning.id,
};
