import { CrateDatasource } from '../../../datasource/crate/index.ts';
import { crateDynamicActions } from './crate-dynamic.ts';

describe('modules/manager/github-actions/known-actions/crate-dynamic', () => {
  it('uses the crate datasource for every entry', () => {
    for (const cfg of Object.values(crateDynamicActions)) {
      expect(cfg.datasource).toBe(CrateDatasource.id);
    }
  });
});
