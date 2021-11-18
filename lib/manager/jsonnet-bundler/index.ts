export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)jsonnetfile.json$'],
};
