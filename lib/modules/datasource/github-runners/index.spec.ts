import { getPkgReleases } from '..';
import { GithubRunnersDatasource } from '.';

describe('modules/datasource/github-runners/index', () => {
  describe('getReleases', () => {
    it('returns releases if package is known', async () => {
      const res = await getPkgReleases({
        datasource: GithubRunnersDatasource.id,
        packageName: 'ubuntu',
      });

      expect(res).toMatchObject({
        releases: [
          { version: '18.04' },
          { version: '20.04' },
          { version: '22.04' },
        ],
      });
    });

    it('returns null if package is unknown', async () => {
      const res = await getPkgReleases({
        datasource: GithubRunnersDatasource.id,
        packageName: 'unknown',
      });

      expect(res).toBeNull();
    });
  });
});
