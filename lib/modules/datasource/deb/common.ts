import type { PackageDescription } from './types';

/**
 * This is just an internal list of compressions that are supported and tried to be downloaded from the remote
 */
export const supportedPackageCompressions = ['gz'];

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
