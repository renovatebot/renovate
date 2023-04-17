import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

const krakenLock1 = Fixtures.get('.kraken.1.lock');
const krakenLock2 = Fixtures.get('.kraken.2.lock');

describe('modules/manager/kraken/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts dependencies and versions', () => {
      const res = extractPackageFile(krakenLock1, '.kraken.lock', {});
      expect(res).toMatchSnapshot();
    });

    it('extracts index url and interpreter constraints', () => {
      const res = extractPackageFile(krakenLock2, '.kraken.lock', {});
      expect(res?.registryUrls).toEqual([
        'https://artifactory.company.com/artifactory/api/pypi/python/simple',
      ]);
      expect(res?.extractedConstraints).toEqual({
        python: '>=3.7',
      });
    });
  });
});
