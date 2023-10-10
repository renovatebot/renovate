import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const oneContents = Fixtures.get('one-contents.yaml');
const multipleContents = Fixtures.get('multiple-contents.yaml');
const emptyDirectories = Fixtures.get('empty-directory.yaml');

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

    it('returns null for empty directories key', () => {
      const result = extractPackageFile(emptyDirectories);
      expect(result).toBeNull();
    });

    it('single chart - extracts helm-chart from vendir.yml correctly', () => {
      const result = extractPackageFile(oneContents);
      expect(result).toMatchObject({
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

    it('multiple charts - extracts helm-chart from vendir.yml correctly', () => {
      const result = extractPackageFile(multipleContents);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '7.10.1',
            depName: 'contour',
            datasource: 'helm',
            registryUrls: ['https://charts.bitnami.com/bitnami'],
          },
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
