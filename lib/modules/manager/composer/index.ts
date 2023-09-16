import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { PackagistDatasource } from '../../datasource/packagist';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
import { getRangeStrategy } from './range';
import { updateLockedDependency } from './update-locked';
import { composerVersioningId } from './utils';

export const supportsLockFileMaintenance = true;

export {
  extractPackageFile,
  updateArtifacts,
  getRangeStrategy,
  updateLockedDependency,
};

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)composer\\.json$'],
  versioning: composerVersioningId,
};

export const categories: Category[] = ['php'];

export const supportedDatasources = [
  GitTagsDatasource.id,
  PackagistDatasource.id,
];
