import { RustVersionDatasource } from '../../../datasource/rust-version/index.ts';
import { rustVersionDynamicActions } from './rust-version-dynamic.ts';

describe('modules/manager/github-actions/known-actions/rust-version-dynamic', () => {
  it('uses the rust-version datasource for every entry', () => {
    for (const cfg of Object.values(rustVersionDynamicActions)) {
      expect(cfg.datasource).toBe(RustVersionDatasource.id);
    }
  });
});
