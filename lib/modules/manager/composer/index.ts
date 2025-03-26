import type { Category } from '../../../constants';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags';
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
