import type { Category } from '../../../constants/index.ts';
import { CondaDatasource } from '../../datasource/conda/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['pixi.lock'];

export const url = 'https://github.com/prefix-dev/pixi/';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/)pyproject\\.toml$/', // `tool.pixi` section
    '/(^|/)pixi\\.toml$/', // root object
  ],
};

export const supportedDatasources = [PypiDatasource.id, CondaDatasource.id];
