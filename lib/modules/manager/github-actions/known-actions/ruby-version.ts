import { RubyVersionDatasource } from '../../../datasource/ruby-version/index.ts';
import type { KnownActionConfig } from '../types.ts';
import { partialValSchema } from './utils.ts';

export const rubyVersionActions: Record<string, KnownActionConfig> = {
  // https://github.com/ruby/setup-ruby
  'ruby/setup-ruby': {
    datasource: RubyVersionDatasource.id,
    packageName: 'ruby',
    // a short `ruby-version` such as `3.3` means the latest release matching
    // it, rather than a pinned version
    withSchema: partialValSchema('ruby-version'),
  },
};
