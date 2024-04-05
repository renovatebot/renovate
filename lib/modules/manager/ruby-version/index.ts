import type { Category } from '../../../constants';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import * as rubyVersioning from '../../versioning/ruby';

export { extractPackageFile } from './extract';

export const supportedDatasources = [RubyVersionDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)\\.ruby-version$'],
  versioning: rubyVersioning.id,
};

export const categories: Category[] = ['ruby'];
