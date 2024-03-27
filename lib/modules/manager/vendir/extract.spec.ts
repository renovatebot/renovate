import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const validVendirYaml = Fixtures.get('valid-vendir.yaml');
const invalidVendirYaml = Fixtures.get('invalid-vendir.yaml');

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
      const emptyDirectories = codeBlock`
        apiVersion: vendir.k14s.io/v1alpha1
        kind: Config
        directories: []
      `;
      const result = extractPackageFile(emptyDirectories, 'vendir.yml', {});
      expect(result).toBeNull();
    });

    it('returns null for nonHelmChart or nonGit key', () => {
      const result = extractPackageFile(invalidVendirYaml, 'vendir.yml', {});
      expect(result).toBeNull();
    });

    it('multiple charts - extracts helm-chart from vendir.yml correctly', () => {
      const result = extractPackageFile(validVendirYaml, 'vendir.yml', {
        registryAliases: {
          test: 'quay.example.com/organization',
        },
      });
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
            depName: 'test',
            datasource: 'helm',
            registryUrls: ['https://charts.bitnami.com/bitnami'],
          },
          {
            currentValue: '7.10.1',
            depName: 'https://github.com/test/test',
            packageName: 'https://github.com/test/test',
            datasource: 'git-refs',
          },
          {
            currentValue: '7.10.1',
            depName: 'contour',
            packageName: 'charts.bitnami.com/bitnami/contour',
            datasource: 'docker',
          },
          {
            currentDigest: undefined,
            currentValue: '7.10.1',
            depName: 'oci',
            datasource: 'docker',
            depType: 'HelmChart',
            packageName: 'quay.example.com/organization/oci',
            pinDigests: false,
          },
        ],
      });
    });
  });
});
