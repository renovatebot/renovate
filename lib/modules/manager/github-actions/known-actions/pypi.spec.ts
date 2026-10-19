import { PypiDatasource } from '../../../datasource/pypi/index.ts';
import { pypiActions } from './pypi.ts';

describe('modules/manager/github-actions/known-actions/pypi', () => {
  it('uses the pypi datasource for every entry', () => {
    for (const cfg of Object.values(pypiActions)) {
      expect(cfg.datasource).toBe(PypiDatasource.id);
    }
  });
});
