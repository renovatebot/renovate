import { GithubReleasesDatasource } from '../../../datasource/github-releases/index.ts';
import { githubReleasesDynamicActions } from './github-releases-dynamic.ts';

describe('modules/manager/github-actions/known-actions/github-releases-dynamic', () => {
  it('uses the github-releases datasource for every entry', () => {
    for (const cfg of Object.values(githubReleasesDynamicActions)) {
      expect(cfg.datasource).toBe(GithubReleasesDatasource.id);
    }
  });
});
