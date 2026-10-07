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
      ({ id, packageName, registryUrl, expected }) => {
        const datasource = getPlatformTagsDatasource(id);

        expect(datasource?.id).toBe(id);
        expect(datasource?.getSourceUrl(packageName, registryUrl)).toBe(
          expected,
        );
      },
    );

    it('returns undefined for a datasource of no platform', () => {
      expect(getPlatformTagsDatasource('git-tags')).toBeUndefined();
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
    `('resolves $url to $id', ({ url, id, registryUrl, packageName }) => {
      expect(resolvePlatformTagsLookup(url)).toMatchObject({
        id,
        registryUrl,
        packageName,
      });
    });

    it.each([
      'https://git.example.com/o/r',
      'https://dev.azure.com/org/project/_git/repo',
      'https://github.com/o',
      'not a url',
    ])('returns null for %s', (url) => {
      expect(resolvePlatformTagsLookup(url)).toBeNull();
    });
  });
});
