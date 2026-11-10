import { NpmDatasource } from '../../../datasource/npm/index.ts';
import { npmActions } from './npm.ts';

describe('modules/manager/github-actions/known-actions/npm', () => {
  it('uses the npm datasource for every entry', () => {
    for (const cfg of Object.values(npmActions)) {
      expect(cfg.datasource).toBe(NpmDatasource.id);
    }
  });
});
