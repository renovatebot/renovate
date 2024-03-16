import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const oneContents = Fixtures.get('one-contents.yaml');
const ociContents = Fixtures.get('oci-contents.yaml');
const aliasContents = Fixtures.get('alias-contents.yaml');
const multipleContents = Fixtures.get('multiple-contents.yaml');
const nonHelmChartContents = Fixtures.get('non-helmchart.yaml');
const emptyDirectories = Fixtures.mock(
  { apiVersion: 'vendir.k14s.io/v1alpha1', kind: 'Config', directories: [] },
  'vendir.yml',
);

describe('modules/manager/vendir/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid yaml file content', () => {
      const result = extractPackageFile('nothing here: [', 'vendir.yml', {});
      expect(result).toBeNull();
    });

    it('returns null for empty yaml file content', () => {
      const result = extractPackageFile('', 'vendir.yml', {});
      expect(result).toBeNull();
    });

    it('returns null for empty directories key', () => {
      const result = extractPackageFile(emptyDirectories, 'vendir.yml', {});
      expect(result).toBeNull();
    });

    it('returns null for nonHelmChart key', () => {
      const result = extractPackageFile(nonHelmChartContents, 'vendir.yml', {});
      expect(result).toBeNull();
    });

    it('single chart - extracts helm-chart from vendir.yml correctly', () => {
      const result = extractPackageFile(oneContents, 'vendir.yml', {});
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

    it('single chart - extracts oci helm-chart from vendir.yml correctly', () => {
      const result = extractPackageFile(ociContents, 'vendir.yml', {});
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '7.10.1',
            depName: 'contour',
            datasource: 'docker',
          },
        ],
      });
    });

    it('multiple charts - extracts helm-chart from vendir.yml correctly', () => {
      const result = extractPackageFile(multipleContents, 'vendir.yml', {});
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

    it('resolves aliased registry urls', async () => {
      const ociresult = extractPackageFile(aliasContents, 'vendir.yml', {
        registryAliases: {
          placeholder: 'https://my-registry.gcr.io/',
          longAlias: 'https://registry.example.com/',
          ociRegistry: 'oci://quay.example.com/organization',
        },
      });

      expect(ociresult).toMatchObject({
        deps: [
          {
            currentValue: '7.10.1',
            depName: 'oci-contour',
            datasource: 'helm',
            registryUrls: ['oci://quay.example.com/organization'],
          },
          {
            currentValue: '7.10.1',
            depName: 'normal-contour',
            datasource: 'helm',
            registryUrls: ['https://registry.example.com/'],
          },
          {
            currentValue: '7.10.1',
            depName: 'placeholder-contour',
            datasource: 'helm',
            registryUrls: ['https://my-registry.gcr.io/'],
          },
          {
            currentValue: '7.10.1',
            depName: 'broken-contour',
            datasource: 'helm',
            skipReason: 'placeholder-url',
          },
        ],
      });
    });
  });
});
