import { readFileSync } from 'fs';
import { fs } from '../../../test/util';
import { extractPackageFile } from './extract';

const helmDefaultChartInitValues = readFileSync(
  'lib/manager/helm-values/__fixtures__/default_chart_init_values.yaml',
  'utf8'
);

const helmMultiAndNestedImageValues = readFileSync(
  'lib/manager/helm-values/__fixtures__/multi_and_nested_image_values.yaml',
  'utf8'
);

describe('lib/manager/helm-values/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      fs.readLocalFile = jest.fn();
    });
    it('returns null for invalid yaml file content', async () => {
      const result = await extractPackageFile('nothing here: [');
      expect(result).toBeNull();
    });
    it('returns null for empty yaml file content', async () => {
      const result = await extractPackageFile('');
      expect(result).toBeNull();
    });
    it('returns null for no file content', async () => {
      const result = await extractPackageFile(null);
      expect(result).toBeNull();
    });
    it('extracts from values.yaml correctly with same structure as "helm create"', async () => {
      const result = await extractPackageFile(helmDefaultChartInitValues);
      expect(result).toMatchSnapshot();
    });
    it('extracts from complex values file correctly"', async () => {
      const result = await extractPackageFile(helmMultiAndNestedImageValues);
      expect(result).toMatchSnapshot();
    });
    it('returns the package file version from the sibling Chart.yaml"', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v2
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      `);
      const result = await extractPackageFile(
        helmMultiAndNestedImageValues,
        'values.yaml'
      );
      expect(result.packageFileVersion).toBe('0.1.0');
    });
    it('does not fail if the sibling Chart.yaml is invalid', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      invalidYaml: [
      `);
      const result = await extractPackageFile(
        helmMultiAndNestedImageValues,
        'values.yaml'
      );
      expect(result).not.toBeNull();
      expect(result.packageFileVersion).toBeUndefined();
    });
    it('does not fail if the sibling Chart.yaml does not contain the required fields', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v2
      name: test
      version-is: missing
      `);
      const result = await extractPackageFile(
        helmMultiAndNestedImageValues,
        'values.yaml'
      );
      expect(result).not.toBeNull();
      expect(result.packageFileVersion).toBeUndefined();
    });
  });
});
