import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';

export const supportsLockFileMaintenance = true;
export { extractPackageFile, updateArtifacts };

export const defaultConfig = {
  fileMatch: ['(^|/)jsonnetfile.json$'],
};
