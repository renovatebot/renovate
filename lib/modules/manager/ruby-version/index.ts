import type { Category } from '../../../constants';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import * as rubyVersioning from '../../versioning/ruby';

export { extractPackageFile } from './extract';

export const displayName = '.ruby-version';
export const categories: Category[] = ['ruby'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.ruby-version$/'],
  versioning: rubyVersioning.id,
};

export const supportedDatasources = [RubyVersionDatasource.id];
