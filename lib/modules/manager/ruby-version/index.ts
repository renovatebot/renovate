import type { Category } from '../../../constants/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
import * as rubyVersioning from '../../versioning/ruby/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = '.ruby-version';
export const categories: Category[] = ['ruby'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.ruby-version$/'],
  versioning: rubyVersioning.id,
};

export const supportedDatasources = [RubyVersionDatasource.id];
