import { GithubReleasesDatasource } from '../../../datasource/github-releases/index.ts';
import { githubReleasesActions } from './github-releases.ts';

describe('modules/manager/github-actions/known-actions/github-releases', () => {
  it('uses the github-releases datasource for every entry', () => {
    for (const cfg of Object.values(githubReleasesActions)) {
      expect(cfg.datasource).toBe(GithubReleasesDatasource.id);
    }
  });
});
