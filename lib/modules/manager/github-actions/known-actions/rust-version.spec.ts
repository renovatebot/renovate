import { RustVersionDatasource } from '../../../datasource/rust-version/index.ts';
import { rustVersionActions } from './rust-version.ts';

describe('modules/manager/github-actions/known-actions/rust-version', () => {
  it('uses the rust-version datasource for every entry', () => {
    for (const cfg of Object.values(rustVersionActions)) {
      expect(cfg.datasource).toBe(RustVersionDatasource.id);
    }
  });
});
