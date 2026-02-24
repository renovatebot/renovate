import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import {
  extractGitSource,
  extractGithubReleaseSource,
  extractHelmChart,
  extractHttpReleaseSource,
} from './extract.ts';
import { extractPackageFile } from './index.ts';

const validContents = Fixtures.get('valid-contents.yaml');
const invalidContents = Fixtures.get('invalid-contents.yaml');
const httpContents = Fixtures.get('http-vendir.yaml');

describe('modules/manager/vendir/extract', () => {
  describe('extractHelmChart()', () => {
    it('extracts a non-OCI helm chart', () => {
      const result = extractHelmChart({
        name: 'my-chart',
        version: '1.2.3',
        repository: { url: 'https://charts.example.com' },
      });
      expect(result).toEqual({
        depName: 'my-chart',
        currentValue: '1.2.3',
        depType: 'HelmChart',
        registryUrls: ['https://charts.example.com'],
        datasource: 'helm',
      });
    });

    it('extracts an OCI helm chart', () => {
      const result = extractHelmChart({
        name: 'my-chart',
        version: '1.2.3',
        repository: { url: 'oci://registry.example.com/charts' },
      });
      expect(result).toMatchObject({
        depName: 'my-chart',
        currentValue: '1.2.3',
        depType: 'HelmChart',
        packageName: 'registry.example.com/charts/my-chart',
        datasource: 'docker',
        pinDigests: false,
      });
    });
  });

  describe('extractGitSource()', () => {
    it('extracts a git source', () => {
      const result = extractGitSource({
        url: 'https://github.com/example/repo',
        ref: 'v1.0.0',
      });
      expect(result).toEqual({
        depName: 'https://github.com/example/repo',
        depType: 'GitSource',
        currentValue: 'v1.0.0',
        datasource: 'git-refs',
      });
    });
  });

  describe('extractGithubReleaseSource()', () => {
    it('extracts a github release source', () => {
      const result = extractGithubReleaseSource({
        slug: 'example/repo',
        tag: 'v2.0.0',
      });
      expect(result).toEqual({
        depName: 'example/repo',
        packageName: 'example/repo',
        depType: 'GithubRelease',
        currentValue: 'v2.0.0',
        datasource: 'github-releases',
      });
    });
  });

  describe('extractHttpReleaseSource()', () => {
    it('extracts an http source with unsupported-datasource skip reason', () => {
      const result = extractHttpReleaseSource({
        url: 'https://example.com/file.yaml',
      });
      expect(result).toEqual({
        packageName: 'https://example.com/file.yaml',
        currentValue: 'latest',
        depType: 'HttpSource',
        skipReason: 'unsupported-datasource',
      });
    });
  });

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
            depType: 'GitSource',
            datasource: 'git-refs',
          },
          {
            currentValue: '7.10.1',
            depName: 'test/test',
            packageName: 'test/test',
            datasource: 'github-releases',
          },
          {
            currentValue: 'latest',
            packageName:
              'https://raw.githubusercontent.com/mend/renovate-ce-ee/refs/tags/14.0.0/docs/openapi-community.yaml',
            depType: 'HttpSource',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
      // git-refs datasource does not support custom registries
      expect(result?.deps[4].registryUrls).toBeUndefined();
    });

    it('extracts http sources from vendir.yml correctly', () => {
      const result = extractPackageFile(httpContents, 'vendir.yml', {});
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: 'latest',
            packageName:
              'https://raw.githubusercontent.com/mend/renovate-ce-ee/refs/tags/14.0.0/docs/openapi-community.yaml',
            depType: 'HttpSource',
            skipReason: 'unsupported-datasource',
          },
          {
            currentValue: 'latest',
            packageName: 'https://example.com/schema.json',
            depType: 'HttpSource',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });
  });
});
