import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

const input01Content = Fixtures.get('package-1.js');

describe('modules/manager/meteor/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n');
      expect(res).toBeNull();
    });

    it('returns results', () => {
      const res = extractPackageFile(input01Content);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '0.2.0',
            datasource: 'npm',
            depName: 'xml2js',
          },
          {
            currentValue: '0.6.0',
            datasource: 'npm',
            depName: 'xml-crypto',
          },
          {
            currentValue: '0.1.19',
            datasource: 'npm',
            depName: 'xmldom',
          },
          {
            currentValue: '2.7.10',
            datasource: 'npm',
            depName: 'connect',
          },
          {
            currentValue: '2.6.4',
            datasource: 'npm',
            depName: 'xmlbuilder',
          },
          {
            currentValue: '0.2.0',
            datasource: 'npm',
            depName: 'querystring',
          },
        ],
      });
      expect(res?.deps).toHaveLength(6);
    });
  });
});
