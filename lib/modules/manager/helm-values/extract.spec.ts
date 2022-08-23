import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const helmDefaultChartInitValues = Fixtures.get(
  'default_chart_init_values.yaml'
);

const helmMultiAndNestedImageValues = Fixtures.get(
  'multi_and_nested_image_values.yaml'
);

describe('modules/manager/helm-values/extract', () => {
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

    it('extracts from values.yaml correctly with same structure as "helm create"', () => {
      const result = extractPackageFile(helmDefaultChartInitValues);
      expect(result).toMatchSnapshot({
        deps: [
          {
            currentValue: '1.16.1',
            depName: 'nginx',
          },
        ],
      });
    });

    it('extracts from complex values file correctly"', () => {
      const result = extractPackageFile(helmMultiAndNestedImageValues);
      expect(result).toMatchSnapshot();
      expect(result?.deps).toHaveLength(5);
    });
  });
});
