export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const supportsLockFileMaintenance = false;

export const lockFileNames: string[] = [];

export const lockFileMaintenanceIsDelegatedToPackageManager = false;

export const supportedDatasources: string[] = [];

export const defaultConfig = {
  managerFilePatterns: [] as string[],
};
