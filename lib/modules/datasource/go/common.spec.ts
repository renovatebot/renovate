import { getSourceUrl, isPseudoVersion, isPublicGoPackage } from './common.ts';

describe('modules/datasource/go/common', () => {
  describe('isPublicGoPackage', () => {
    it.each`
      goproxy                                                       | goprivate             | packageName               | expected
      ${undefined}                                                  | ${undefined}          | ${'github.com/foo/bar'}   | ${true}
      ${'https://proxy.golang.org,direct'}                          | ${undefined}          | ${'github.com/foo/bar'}   | ${true}
      ${'https://proxy.golang.org/'}                                | ${undefined}          | ${'github.com/foo/bar'}   | ${true}
      ${'off'}                                                      | ${undefined}          | ${'github.com/foo/bar'}   | ${true}
      ${'direct'}                                                   | ${undefined}          | ${'github.com/foo/bar'}   | ${false}
      ${'https://artifactory.example.com,direct'}                   | ${undefined}          | ${'github.com/foo/bar'}   | ${false}
      ${'https://artifactory.example.com/api/go/go'}                | ${undefined}          | ${'github.com/foo/bar'}   | ${false}
      ${'https://artifactory.example.com|https://proxy.golang.org'} | ${undefined}          | ${'github.com/foo/bar'}   | ${false}
      ${'https://proxy.golang.org,direct'}                          | ${'github.com/foo/*'} | ${'github.com/foo/bar'}   | ${false}
      ${'https://proxy.golang.org,direct'}                          | ${'github.com/foo/*'} | ${'github.com/other/bar'} | ${true}
      ${'https://proxy.golang.org,direct'}                          | ${'example.com'}      | ${'example.com/foo'}      | ${false}
    `(
      'GOPROXY=$goproxy GOPRIVATE=$goprivate $packageName => $expected',
      ({ goproxy, goprivate, packageName, expected }) => {
        vi.stubEnv('GOPROXY', goproxy);
        vi.stubEnv('GONOPROXY', undefined);
        vi.stubEnv('GOPRIVATE', goprivate);

        expect(isPublicGoPackage(packageName)).toBe(expected);
      },
    );

    it('honors GONOPROXY over GOPRIVATE', () => {
      vi.stubEnv('GOPROXY', 'https://proxy.golang.org,direct');
      vi.stubEnv('GONOPROXY', 'github.com/other/*');
      vi.stubEnv('GOPRIVATE', 'github.com/foo/*');

      expect(isPublicGoPackage('github.com/foo/bar')).toBe(true);
      expect(isPublicGoPackage('github.com/other/bar')).toBe(false);
    });
  });

  describe('isPseudoVersion', () => {
    it.each`
      version                                         | expected
      ${'v0.0.0-20240506185236-b8a5c65736ae'}         | ${true}
      ${'v0.0.0-alpha.0.20240506185236-b8a5c65736ae'} | ${true}
      ${'v1.2.3-0.20240506185236-b8a5c65736ae'}       | ${false}
      ${'v0.0.0'}                                     | ${false}
      ${'v1.2.3'}                                     | ${false}
    `('$version => $expected', ({ version, expected }) => {
      expect(isPseudoVersion(version)).toBe(expected);
    });
  });

  describe('getSourceUrl', () => {
    it.each`
      expected                                   | datasource          | packageName
      ${'https://bitbucket.org/foo/bar'}         | ${'bitbucket-tags'} | ${'foo/bar'}
      ${'https://code.forgejo.org/go-chi/cache'} | ${'forgejo-tags'}   | ${'go-chi/cache'}
      ${'https://gitea.com/go-chi/cache'}        | ${'gitea-tags'}     | ${'go-chi/cache'}
      ${'https://github.com/go-foo/foo'}         | ${'github-tags'}    | ${'go-foo/foo'}
      ${'https://gitlab.com/foo/bar'}            | ${'gitlab-tags'}    | ${'foo/bar'}
      ${undefined}                               | ${'git-tags'}       | ${'https://dev.azure.com/foo/bar/_git/baz'}
    `(
      '($datasource, $packageName) => $expected',
      ({ expected, datasource, packageName }) => {
        const res = getSourceUrl({ datasource, packageName });
        expect(res).toEqual(expected);
      },
    );
  });
});
