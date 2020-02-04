import { readFileSync } from 'fs';

import { extractPackageFile } from '../../../lib/manager/helm-values/extract';

const helmDefaultChartInitValues = readFileSync(
  'test/manager/helm-values/_fixtures/default_chart_init_values.yaml',
  'utf8'
);

const helmMultiAndNestedImageValues = readFileSync(
  'test/manager/helm-values/_fixtures/multi_and_nested_image_values.yaml',
  'utf8'
);

describe('lib/manager/helm-values/extract', () => {
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
    it('returns null for no file content', () => {
      const result = extractPackageFile(null);
      expect(result).toBeNull();
    });
    it('extracts from values.yaml correctly with same structure as "helm create"', () => {
      const result = extractPackageFile(helmDefaultChartInitValues);
      expect(result).toMatchSnapshot();
    });
    it('extracts from complex values file correctly"', () => {
      const result = extractPackageFile(helmMultiAndNestedImageValues);
      expect(result).toMatchSnapshot();
    });
  });
});
