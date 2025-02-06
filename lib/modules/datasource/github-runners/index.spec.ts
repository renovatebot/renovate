import { getPkgReleases } from '..';
import { GithubRunnersDatasource } from '.';

describe('modules/datasource/github-runners/index', () => {
  describe('getReleases', () => {
    it('returns releases for Ubuntu', async () => {
      const res = await getPkgReleases({
        datasource: GithubRunnersDatasource.id,
        packageName: 'ubuntu',
      });

      expect(res).toMatchObject({
        releases: [
          { version: '16.04', isDeprecated: true },
          { version: '18.04', isDeprecated: true },
          { version: '20.04', isDeprecated: true },
          { version: '22.04-arm', isStable: false },
          { version: '22.04' },
          { version: '24.04-arm', isStable: false },
          { version: '24.04' },
        ],
        sourceUrl: 'https://github.com/actions/runner-images',
      });
    });

    it('returns releases for macOS', async () => {
      const res = await getPkgReleases({
        datasource: GithubRunnersDatasource.id,
        packageName: 'macos',
      });

      expect(res).toMatchObject({
        releases: [
          { version: '10.15', isDeprecated: true },
          { version: '11', isDeprecated: true },
          { version: '12-large' },
          { version: '12' },
          { version: '13-xlarge' },
          { version: '13-large' },
          { version: '13' },
          { version: '14-xlarge' },
          { version: '14-large' },
          { version: '14' },
          { version: '15-xlarge', isStable: false },
          { version: '15-large', isStable: false },
          { version: '15', isStable: false },
        ],
        sourceUrl: 'https://github.com/actions/runner-images',
      });
    });

    it('returns releases for Windows', async () => {
      const res = await getPkgReleases({
        datasource: GithubRunnersDatasource.id,
        packageName: 'windows',
      });

      expect(res).toMatchObject({
        releases: [
          { version: '2016', isDeprecated: true },
          { version: '2019' },
          { version: '2022' },
          { version: '2025', isStable: false },
        ],
        sourceUrl: 'https://github.com/actions/runner-images',
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
