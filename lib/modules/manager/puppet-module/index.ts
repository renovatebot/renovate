import type { Category } from '../../../constants';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge';
import type { PackageFileContent } from '../types';
import { extractPackageFile, updateDependency } from './metadata';

export { extractPackageFile, updateDependency };

export const url =
  'https://www.puppet.com/docs/puppet/latest/modules_metadata.html';
export const categories: Category[] = ['iac', 'ruby'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)metadata.json$'],
};

export const supportedDatasources = [PuppetForgeDatasource.id];

// re-export types if needed by tests (not mandatory)
export type { PackageFileContent };
