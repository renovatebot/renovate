import { id as versioning } from '../../versioning/semver';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)batect$'],
  versioning,
};
