import { GradleVersionDatasource } from '../../../datasource/gradle-version/index.ts';
import { gradleVersionActions } from './gradle-version.ts';

describe('modules/manager/github-actions/known-actions/gradle-version', () => {
  it('uses the gradle-version datasource for every entry', () => {
    for (const cfg of Object.values(gradleVersionActions)) {
      expect(cfg.datasource).toBe(GradleVersionDatasource.id);
    }
  });
});
