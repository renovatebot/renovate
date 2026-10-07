import * as datasources from '../index.ts';
import {
  getPlatformTagsDatasource,
  resolvePlatformTagsLookup,
} from './platforms.ts';

describe('modules/datasource/git-tags/platforms', () => {
  describe('getPlatformTagsDatasource', () => {
    it.each`
      id                  | packageName  | registryUrl                  | expected
      ${'bitbucket-tags'} | ${'foo/bar'} | ${undefined}                 | ${'https://bitbucket.org/foo/bar'}
      ${'forgejo-tags'}   | ${'foo/bar'} | ${undefined}                 | ${'https://code.forgejo.org/foo/bar'}
      ${'gitea-tags'}     | ${'foo/bar'} | ${undefined}                 | ${'https://gitea.com/foo/bar'}
      ${'github-tags'}    | ${'foo/bar'} | ${'https://ghe.example.com'} | ${'https://ghe.example.com/foo/bar'}
      ${'gitlab-tags'}    | ${'g/s/r'}   | ${undefined}                 | ${'https://gitlab.com/g/s/r'}
    `(
      '$id builds the source URL of $packageName',
      async ({ id, packageName, registryUrl, expected }) => {
        const datasource = await getPlatformTagsDatasource(id);

        expect(datasource?.id).toBe(id);
        expect(datasource?.getSourceUrl(packageName, registryUrl)).toBe(
          expected,
        );
      },
    );

    it.each`
      id              | reason
      ${'unknown'}    | ${'is not registered'}
      ${'azure-tags'} | ${'resolves no digests'}
      ${'git-tags'}   | ${'reads the tags with git'}
    `('returns null for $id, which $reason', async ({ id }) => {
      await expect(getPlatformTagsDatasource(id)).resolves.toBeNull();
    });
  });

  describe('resolvePlatformTagsLookup', () => {
    it.each`
      url                              | id                  | registryUrl                | packageName
      ${'https://github.com/o/r.git'}  | ${'github-tags'}    | ${'https://github.com'}    | ${'o/r'}
      ${'git@gitlab.com:g/s/r.git'}    | ${'gitlab-tags'}    | ${'https://gitlab.com'}    | ${'g/s/r'}
      ${'ssh://git@bitbucket.org/o/r'} | ${'bitbucket-tags'} | ${'https://bitbucket.org'} | ${'o/r'}
      ${'https://codeberg.org/o/r/'}   | ${'forgejo-tags'}   | ${'https://codeberg.org'}  | ${'o/r'}
      ${'https://gitea.com/o/r'}       | ${'gitea-tags'}     | ${'https://gitea.com'}     | ${'o/r'}
    `('resolves $url to $id', async ({ url, id, registryUrl, packageName }) => {
      await expect(resolvePlatformTagsLookup(url)).resolves.toMatchObject({
        id,
        registryUrl,
        packageName,
      });
    });

    it.each([
      'https://git.example.com/o/r',
      'https://dev.azure.com/org/project/_git/repo',
      'https://bitbucket.example.com/scm/proj/repo.git',
      'https://github.com/o',
      'not a url',
    ])('returns null for %s', async (url) => {
      await expect(resolvePlatformTagsLookup(url)).resolves.toBeNull();
    });

    it('returns null when the platform datasource is not registered', async () => {
      vi.spyOn(datasources, 'getDatasources').mockReturnValueOnce(new Map());

      await expect(
        resolvePlatformTagsLookup('https://github.com/o/r'),
      ).resolves.toBeNull();
    });
  });
});
