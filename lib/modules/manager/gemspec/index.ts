import type { Category } from '../../../constants/index.ts';
import { RubygemsDatasource } from '../../datasource/rubygems/index.ts';
import * as rubyVersioning from '../../versioning/ruby/index.ts';

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
