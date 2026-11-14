import { DartVersionDatasource } from '../../../datasource/dart-version/index.ts';
import { dartVersionActions } from './dart-version.ts';

describe('modules/manager/github-actions/known-actions/dart-version', () => {
  it('uses the dart-version datasource for every entry', () => {
    for (const cfg of Object.values(dartVersionActions)) {
      expect(cfg.datasource).toBe(DartVersionDatasource.id);
    }
  });
});
