import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

const krakenPy = Fixtures.get('.kraken.py');

describe('modules/manager/kraken/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts dependencies and versions', () => {
      const res = extractPackageFile(krakenPy, '.kraken.py', {});
      expect(res).toMatchSnapshot();
    });

    it('extracts index url', () => {
      const res = extractPackageFile(krakenPy, '.kraken.py', {});
      expect(res?.registryUrls).toEqual([
        'https://artifactory.company.com/artifactory/api/pypi/python/simple',
      ]);
    });
  });
});
