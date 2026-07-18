import { Fixtures } from '~test/fixtures.ts';
import { partial } from '~test/util.ts';
import type { ExtractConfig } from '../types.ts';
import { extractPackageFile } from './index.ts';

const helmDefaultChartInitValues = Fixtures.get(
  'default_chart_init_values.yaml',
);

const helmMultiAndNestedImageValues = Fixtures.get(
  'multi_and_nested_image_values.yaml',
);

const config = partial<ExtractConfig>({});

const configAliases = partial<ExtractConfig>({
  registryAliases: {
    'quay.io': 'registry.internal/mirror/quay.io',
  },
});

const packageFile = 'values.yaml';

describe('modules/manager/helm-values/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid yaml file content', () => {
      const result = extractPackageFile('nothing here: [', packageFile, config);
      expect(result).toBeNull();
    });

    it('returns null for empty yaml file content', () => {
      const result = extractPackageFile('', packageFile, config);
      expect(result).toBeNull();
    });

    it('extracts from values.yaml correctly with same structure as "helm create"', () => {
      const result = extractPackageFile(
        helmDefaultChartInitValues,
        packageFile,
        config,
      );
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '1.16.1',
            datasource: 'docker',
            depName: 'nginx',
            packageName: 'nginx',
            replaceString: '1.16.1',
            versioning: 'docker',
          },
        ],
      });
    });

    it('extracts from complex values file correctly"', () => {
      const result = extractPackageFile(
        helmMultiAndNestedImageValues,
        packageFile,
        config,
      );
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '1.18-alpine',
            datasource: 'docker',
            depName: 'docker.io/library/nginx',
            packageName: 'docker.io/library/nginx',
            replaceString: 'docker.io/library/nginx:1.18-alpine',
          },
          {
            autoReplaceStringTemplate:
              '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '11.6.0-debian-9-r0',
            datasource: 'docker',
            depName: 'bitnami/postgresql',
            packageName: 'bitnami/postgresql',
            replaceString: '11.6.0-debian-9-r0',
            versioning: 'docker',
          },
          {
            autoReplaceStringTemplate:
              '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.7.0-debian-9-r12',
            datasource: 'docker',
            depName: 'docker.io/bitnami/postgres-exporter',
            packageName: 'docker.io/bitnami/postgres-exporter',
            replaceString: '0.7.0-debian-9-r12',
            versioning: 'docker',
          },
          {
            autoReplaceStringTemplate:
              '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest:
              'sha256:4762726f1471ef048dd807afdc0e19265e95ffdcc7cb4a34891f680290022809',
            currentValue: '11.5.0-debian-9-r0',
            datasource: 'docker',
            depName: 'docker.io/bitnami/postgresql',
            packageName: 'docker.io/bitnami/postgresql',
            replaceString:
              '11.5.0-debian-9-r0@sha256:4762726f1471ef048dd807afdc0e19265e95ffdcc7cb4a34891f680290022809',
            versioning: 'docker',
          },
          {
            autoReplaceStringTemplate:
              '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '2.1.3-debian-10-r38',
            datasource: 'docker',
            depName: 'docker.io/bitnami/harbor-core',
            packageName: 'docker.io/bitnami/harbor-core',
            replaceString: '2.1.3-debian-10-r38',
            versioning: 'docker',
          },
        ],
      });
      expect(result?.deps).toHaveLength(5);
    });

    it('extract data from file with multiple documents', () => {
      const multiDocumentFile = Fixtures.get(
        'single_file_with_multiple_documents.yaml',
      );
      const result = extractPackageFile(multiDocumentFile, packageFile, config);
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

    it('extract data from file with registry aliases', () => {
      const multiDocumentFile = Fixtures.get(
        'single_file_with_multiple_documents.yaml',
      );
      const result = extractPackageFile(
        multiDocumentFile,
        packageFile,
        configAliases,
      );
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: 'v0.13.10',
            depName: 'quay.io/metallb/controller',
            packageName: 'registry.internal/mirror/quay.io/metallb/controller',
            datasource: 'docker',
            versioning: 'docker',
          },
          {
            currentValue: 'v0.13.10',
            depName: 'quay.io/metallb/speaker',
            packageName: 'registry.internal/mirror/quay.io/metallb/speaker',
            datasource: 'docker',
            versioning: 'docker',
          },
        ],
      });
    });
  });
});
