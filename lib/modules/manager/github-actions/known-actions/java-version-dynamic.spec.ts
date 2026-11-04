import { JavaVersionDatasource } from '../../../datasource/java-version/index.ts';
import { javaVersionDynamicActions } from './java-version-dynamic.ts';

describe('modules/manager/github-actions/known-actions/java-version-dynamic', () => {
  it('uses the java-version datasource for every entry', () => {
    for (const cfg of Object.values(javaVersionDynamicActions)) {
      expect(cfg.datasource).toBe(JavaVersionDatasource.id);
    }
  });
});
