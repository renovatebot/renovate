import type { Category } from '../../../constants/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
import { RubygemsDatasource } from '../../datasource/rubygems/index.ts';
import * as rubyVersioning from '../../versioning/ruby/index.ts';
import { updateArtifacts } from './artifacts.ts';
import { extractPackageFile } from './extract.ts';
import { updateLockedDependency } from './update-locked.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['Gemfile.lock'];

/*
 * Each of the below functions contain some explanations within their own files.
 * The best way to understand them in more detail is to look at the existing managers and find one that matches most closely what you need to do.
 */

export {
  extractPackageFile, // Mandatory unless extractAllPackageFiles is used instead
  updateArtifacts, // Optional
  updateLockedDependency,
};

export const url = 'https://bundler.io/docs.html';
export const categories: Category[] = ['ruby'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)Gemfile$/'],
  versioning: rubyVersioning.id,
};

export const supportedDatasources = [
  RubygemsDatasource.id,
  RubyVersionDatasource.id,
];
