import { RubyVersionDatasource } from '../../../datasource/ruby-version/index.ts';
import { rubyVersionActions } from './ruby-version.ts';

describe('modules/manager/github-actions/known-actions/ruby-version', () => {
  it('uses the ruby-version datasource for every entry', () => {
    for (const cfg of Object.values(rubyVersionActions)) {
      expect(cfg.datasource).toBe(RubyVersionDatasource.id);
    }
  });
});
