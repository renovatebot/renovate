import type { PackageDescription } from './types';

/**
 * This specifies the directory where the extracted and downloaded packages files are stored relative to cacheDir.
 * The folder will be created automatically if it doesn't exist.
 */
export const cacheSubDir: string = 'deb';

export const requiredPackageKeys: Array<keyof PackageDescription> = [
  'Package',
  'Version',
];

export const packageKeys: Array<keyof PackageDescription> = [
  ...requiredPackageKeys,
  'Homepage',
];
