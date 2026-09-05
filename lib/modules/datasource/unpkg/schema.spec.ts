import { UnpkgDigestResponse } from './schema.ts';

describe('modules/datasource/unpkg/schema', () => {
  describe('UnpkgDigestResponse', () => {
    it('returns the expected shape', () => {
      expect(
        UnpkgDigestResponse.parse({
          package: 'jquery',
          version: '4.0.0',
          prefix: '/',
          files: [
            {
              path: '/dist/jquery.js',
              size: 255967,
              type: 'text/javascript',
              integrity: 'sha256-9fsHeVnKBvqh3FB2HYu7g2xseAZ5MlN6Kz/qnkASV8U=',
            },
            {
              path: '/src/jquery.js',
              size: 978,
              type: 'text/javascript',
              integrity: 'sha256-TyqGpDScWhEDKuSRMWu9to6poNxOxXo9yRRqcmsCs6k=',
            },
            {
              path: '/dist/jquery.min.js',
              size: 78748,
              type: 'text/javascript',
              integrity: 'sha256-OaVG6prZf4v69dPg6PhVattBXkcOWQB62pdZ3ORyrao=',
            },
          ],
        }),
      ).toStrictEqual({
        files: [
          {
            path: '/dist/jquery.js',
            integrity: 'sha256-9fsHeVnKBvqh3FB2HYu7g2xseAZ5MlN6Kz/qnkASV8U=',
          },
          {
            path: '/src/jquery.js',
            integrity: 'sha256-TyqGpDScWhEDKuSRMWu9to6poNxOxXo9yRRqcmsCs6k=',
          },
          {
            path: '/dist/jquery.min.js',
            integrity: 'sha256-OaVG6prZf4v69dPg6PhVattBXkcOWQB62pdZ3ORyrao=',
          },
        ],
      });
    });
  });
});
