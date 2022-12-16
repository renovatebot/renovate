import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const helmChart = Fixtures.get('helm-chart.yml');

describe('modules/manager/vendir/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('returns null for invalid yaml file content', () => {
      const result = extractPackageFile('nothing here: [');
      expect(result).toBeNull();
    });

    it('returns null for empty yaml file content', () => {
      const result = extractPackageFile('');
      expect(result).toBeNull();
    });

    it('extracts helm-chart from vendir.yml correctly', () => {
      const result = extractPackageFile(helmChart);
      expect(result).toMatchSnapshot({
        deps: [
          {
            currentValue: '7.10.1',
            depName: 'contour',
            datasource: 'helm',
            registryUrls: ['https://charts.bitnami.com/bitnami'],
          },
        ],
      });
    });
  });
});
