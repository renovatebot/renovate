import { Fixtures } from '~test/fixtures.ts';
import { UnpkgDigestResponse } from './schema.ts';

describe('modules/datasource/unpkg/schema', () => {
  describe('UnpkgDigestResponse', () => {
    it('returns the expected shape', () => {
      const rawResponse = Fixtures.get('unscoped_jquery.json');
      const response = JSON.parse(rawResponse);
      expect(UnpkgDigestResponse.parse(response)).toStrictEqual({
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
