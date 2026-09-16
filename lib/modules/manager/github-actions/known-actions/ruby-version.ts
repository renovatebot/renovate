import { RubyVersionDatasource } from '../../../datasource/ruby-version/index.ts';
import type { KnownActionConfig } from '../types.ts';
import { valSchema } from './utils.ts';

export const rubyVersionActions: Record<string, KnownActionConfig> = {
  'ruby/setup-ruby': {
    datasource: RubyVersionDatasource.id,
    packageName: 'ruby',
    withSchema: valSchema('ruby-version'),
  },
};
