import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const validContents = Fixtures.get('valid-contents.yaml');
const invalidContents = Fixtures.get('invalid-contents.yaml');

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

    it('returns null for nonHelmChart key', () => {
      const result = extractPackageFile(invalidContents, 'vendir.yml', {});
      expect(result).toBeNull();
    });

    it('multiple charts - extracts helm-chart from vendir.yml correctly', () => {
      const result = extractPackageFile(validContents, 'vendir.yml', {
        registryAliases: {
          test: 'quay.example.com/organization',
        },
      });
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '7.10.1',
            depName: 'valid-helmchart-1',
            datasource: 'helm',
            depType: 'HelmChart',
            registryUrls: ['https://charts.bitnami.com/bitnami'],
          },
          {
            currentValue: '7.10.1',
            depName: 'valid-helmchart-2',
            datasource: 'helm',
            depType: 'HelmChart',
            registryUrls: ['https://charts.bitnami.com/bitnami'],
          },
          {
            currentDigest: undefined,
            currentValue: '7.10.1',
            depName: 'oci-chart',
            datasource: 'docker',
            depType: 'HelmChart',
            packageName: 'charts.bitnami.com/bitnami/oci-chart',
            pinDigests: false,
          },
          {
            currentDigest: undefined,
            currentValue: '7.10.1',
            depName: 'aliased-oci-chart',
            datasource: 'docker',
            depType: 'HelmChart',
            packageName: 'quay.example.com/organization/aliased-oci-chart',
            pinDigests: false,
          },
          {
            currentValue: '7.10.1',
            depName: 'https://github.com/test/test',
            packageName: 'https://github.com/test/test',
            datasource: 'git-refs',
          },
          {
            currentValue: '7.10.1',
            depName: 'test/test',
            packageName: 'test/test',
            datasource: 'github-releases',
          },
        ],
      });
    });
  });
});
