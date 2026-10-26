import { hostRules } from '~test/host-rules.ts';
import { getSourceUrl, isPublicGoPackage } from './common.ts';

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

    describe('host rules', () => {
      beforeEach(() => {
        vi.stubEnv('GOPROXY', undefined);
        vi.stubEnv('GONOPROXY', undefined);
        vi.stubEnv('GOPRIVATE', undefined);
      });

      it.each`
        rule
        ${{ token: 'some-token' }}
        ${{ username: 'some-user', password: 'some-password' }}
        ${{ httpsPrivateKey: 'some-key' }}
      `(
        'treats modules with go host rule credentials as private: $rule',
        ({ rule }) => {
          hostRules.add({ hostType: 'go', matchHost: 'example.com', ...rule });

          expect(isPublicGoPackage('example.com/foo/bar')).toBe(false);
          expect(isPublicGoPackage('sub.example.com/foo/bar')).toBe(false);
          expect(isPublicGoPackage('github.com/foo/bar')).toBe(true);
        },
      );

      it('treats all modules as private with a go host rule without matchHost', () => {
        hostRules.add({ hostType: 'go', token: 'some-token' });

        expect(isPublicGoPackage('github.com/foo/bar')).toBe(false);
      });

      it('matches host rules with a URL matchHost', () => {
        hostRules.add({
          hostType: 'go',
          matchHost: 'https://example.com/private/',
          token: 'some-token',
        });

        expect(isPublicGoPackage('example.com/private/foo')).toBe(false);
        expect(isPublicGoPackage('example.com/public/foo')).toBe(true);
      });

      it('ignores go host rules without credentials', () => {
        hostRules.add({ hostType: 'go', matchHost: 'example.com' });

        expect(isPublicGoPackage('example.com/foo/bar')).toBe(true);
      });

      it('ignores credentials from other host types', () => {
        hostRules.add({ matchHost: 'example.com', token: 'some-token' });
        hostRules.add({
          hostType: 'github',
          matchHost: 'example.com',
          token: 'some-token',
        });

        expect(isPublicGoPackage('example.com/foo/bar')).toBe(true);
      });
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
