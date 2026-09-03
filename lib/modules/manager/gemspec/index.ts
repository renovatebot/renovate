import type { Category } from '../../../constants/index.ts';
import { RubygemsDatasource } from '../../datasource/rubygems/index.ts';
import * as rubyVersioning from '../../versioning/ruby/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { knownDepTypes } from './dep-types.ts';
export { extractPackageFile } from './extract.ts';

export const displayName = 'gemspec';
export const url = 'https://guides.rubygems.org/specification-reference/';
export const categories: Category[] = ['ruby'];

export const defaultConfig = {
  managerFilePatterns: ['/\\.gemspec$/'],
  versioning: rubyVersioning.id,
};

export const supportedDatasources = [RubygemsDatasource.id];

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['Gemfile.lock'];
export const lockFileMaintenanceIsDelegatedToPackageManager =
  'Delegated to the `bundler` CLI, but only when a sibling `Gemfile` pulls the gemspec in via the `gemspec` directive. Without it the `Gemfile.lock` cannot reflect the gemspec constraints, so Renovate leaves it unchanged.';
