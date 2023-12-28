import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

const helmDefaultChartInitValues = Fixtures.get(
  'default_chart_init_values.yaml',
);

const helmMultiAndNestedImageValues = Fixtures.get(
  'multi_and_nested_image_values.yaml',
);

describe('modules/manager/helm-values/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid yaml file content', async () => {
      const result = await extractPackageFile('nothing here: [', 'some file');
      expect(result).toBeNull();
    });

    it('returns null for empty yaml file content', async () => {
      const result = await extractPackageFile('', 'some file');
      expect(result).toBeNull();
    });

    it('extracts from values.yaml correctly with same structure as "helm create"', async () => {
      const result = await extractPackageFile(
        helmDefaultChartInitValues,
        'some file',
      );
      expect(result).toMatchSnapshot({
        deps: [
          {
            currentValue: '1.16.1',
            depName: 'nginx',
          },
        ],
      });
    });

    it('extracts from complex values file correctly"', async () => {
      const result = await extractPackageFile(
        helmMultiAndNestedImageValues,
        'some file',
      );
      expect(result).toMatchSnapshot();
      expect(result?.deps).toHaveLength(5);
    });

    it('extract data from file with multiple documents', async () => {
      const multiDocumentFile = Fixtures.get(
        'single_file_with_multiple_documents.yaml',
      );
      const result = await extractPackageFile(multiDocumentFile, 'some file');
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: 'v0.13.10',
            depName: 'quay.io/metallb/controller',
            datasource: 'docker',
            versioning: 'docker',
          },
          {
            currentValue: 'v0.13.10',
            depName: 'quay.io/metallb/speaker',
            datasource: 'docker',
            versioning: 'docker',
          },
        ],
      });
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
        'values.yaml',
      );
      expect(result).not.toBeNull();
      expect(result?.packageFileVersion).toBe('0.1.0');
    });

    it('does not fail if the sibling Chart.yaml is invalid', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      invalidYaml: [
      `);
      const result = await extractPackageFile(
        helmMultiAndNestedImageValues,
        'values.yaml',
      );
      expect(result).not.toBeNull();
      expect(result?.packageFileVersion).toBeUndefined();
    });

    it('does not fail if the sibling Chart.yaml does not contain the required fields', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v2
      name: test
      version-is: missing
      `);
      const result = await extractPackageFile(
        helmMultiAndNestedImageValues,
        'values.yaml',
      );
      expect(result).not.toBeNull();
      expect(result?.packageFileVersion).toBeUndefined();
    });
  });
});
