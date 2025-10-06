import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';
import { fs } from '~test/util';

const validContents = Fixtures.get('valid-contents.yaml');
const invalidContents = Fixtures.get('invalid-contents.yaml');
const vendirYml = Fixtures.get('vendir.yml');
const vendirLock1 = Fixtures.get('vendir_1.lock');

vi.mock('../../../util/fs');

describe('modules/manager/vendir/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid yaml file content', async () => {
      const result = await extractPackageFile('nothing here: [', 'vendir.yml', {});
      expect(result).toBeNull();
    });

    it('returns null for empty yaml file content', async () => {
      const result = await extractPackageFile('', 'vendir.yml', {});
      expect(result).toBeNull();
    });

    it('returns null for empty directories key', async () => {
      const emptyDirectories = codeBlock`
        apiVersion: vendir.k14s.io/v1alpha1
        kind: Config
        directories: []
      `;
      const result = await extractPackageFile(emptyDirectories, 'vendir.yml', {});
      expect(result).toBeNull();
    });

    it('returns null for nonHelmChart key', async () => {
      const result = await extractPackageFile(invalidContents, 'vendir.yml', {});
      expect(result).toBeNull();
    });

    it('multiple charts - extracts helm-chart from vendir.yml correctly', async () => {
      const result = await extractPackageFile(validContents, 'vendir.yml', {
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

    it('extracts locked versions from vendir.lock.yml', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('vendir.lock.yml');
      fs.readLocalFile.mockResolvedValueOnce(vendirLock1);

      const result = await extractPackageFile(vendirYml, 'vendir.yml', {});

      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '36.109.4',
            lockedVersion: '36.109.4',
            depName: 'renovate',
            datasource: 'helm',
            depType: 'HelmChart',
            registryUrls: ['https://docs.renovatebot.com/helm-charts'],
          },
        ],
        lockFiles: ['vendir.lock.yml'],
      });
    });

    it('extracts without lockfile when vendir.lock.yml is missing', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce(null);

      const result = await extractPackageFile(vendirYml, 'vendir.yml', {});

      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '36.109.4',
            lockedVersion: undefined,
            depName: 'renovate',
            datasource: 'helm',
            depType: 'HelmChart',
            registryUrls: ['https://docs.renovatebot.com/helm-charts'],
          },
        ],
      });
      expect(result?.lockFiles).toBeUndefined();
    });
  });
});
