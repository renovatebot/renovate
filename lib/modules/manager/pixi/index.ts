import type { Category } from '../../../constants';

export { bumpPackageVersion } from '../pep621/update';
export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = true;

export const url = 'https://github.com/prefix-dev/pixi/';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  fileMatch: [
    '(^|/)pyproject\\.toml$', // `tool.pixi` section
    '(^|/)pixi\\.toml$', // root object
  ],
};

export const supportedDatasources = [];
