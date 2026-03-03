import type { Category } from '../../../constants/index.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { PackagistDatasource } from '../../datasource/packagist/index.ts';
import { updateArtifacts } from './artifacts.ts';
import { extractPackageFile } from './extract.ts';
import { getRangeStrategy } from './range.ts';
import { updateLockedDependency } from './update-locked.ts';
import { composerVersioningId } from './utils.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['composer.lock'];

export {
  extractPackageFile,
  updateArtifacts,
  getRangeStrategy,
  updateLockedDependency,
};

export const url = 'https://getcomposer.org/doc';
export const categories: Category[] = ['php'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)([\\w-]*)composer\\.json$/'],
  versioning: composerVersioningId,
};

export const supportedDatasources = [
  BitbucketTagsDatasource.id,
  GitTagsDatasource.id,
  PackagistDatasource.id,
];
