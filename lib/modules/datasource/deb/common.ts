import type { PackageDescription } from './types';

/**
 * This specifies the directory where the extracted and downloaded packages files are stored relative to cacheDir.
 * The folder will be created automatically if it doesn't exist.
 */
export const cacheSubDir = 'deb';

export const requiredPackageKeys: (keyof PackageDescription)[] = [
  'Package',
  'Version',
];

export const packageKeys: (keyof PackageDescription)[] = [
  ...requiredPackageKeys,
  'Homepage',
];
