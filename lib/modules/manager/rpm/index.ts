import type { Category } from '../../../constants';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const supportsLockFileMaintenance = true;

export const supportedDatasources = [];

export const defaultConfig = {
  fileMatch: ['(^|/)rpms\\.in\\.ya?ml$'],
};

export const categories: Category[] = ['rpm'];
