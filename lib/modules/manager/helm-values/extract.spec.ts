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

    it('extracts from values.yaml image tag', () => {
      const input = `
      replicaCount: 1
      firstImage:
        registry: docker.io
        repository: mjnagel/postgresql12
        tag: 12.10
      secondImage:
        registry: docker.io
        repository: bitnami/postgres-exporter
        tag: "10.70"
      thirdImage:
        registry: docker.io
        repository: bitnami/postgres-exporter1
        tag: 10.20.30
      fourthImage:
        registry: docker.io
        repository: bitnami/postgres-exporter2
        tag: 7.0.100-preview.1.22110.4
      sixthImage:
        registry: docker.io
        repository: bitnami/postgres-exporter3
        tag: 1.2.2@sha256:xxxxxx
      seventhImage:
        registry: docker.io
        repository: bitnami/postgres-exporter4
        tag: '10.90'`;
      const result = extractPackageFile(input);
      expect(result).toEqual({
        deps: [
          {
            depName: 'docker.io/mjnagel/postgresql12',
            currentValue: '12.10',
            datasource: 'docker',
            replaceString: '12.10',
            versioning: 'docker',
            currentDigest: undefined,
            autoReplaceStringTemplate:
              '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          },
          {
            depName: 'docker.io/bitnami/postgres-exporter',
            currentValue: '10.70',
            datasource: 'docker',
            replaceString: '10.70',
            versioning: 'docker',
            currentDigest: undefined,
            autoReplaceStringTemplate:
              '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          },
          {
            depName: 'docker.io/bitnami/postgres-exporter1',
            currentValue: '10.20.30',
            datasource: 'docker',
            replaceString: '10.20.30',
            versioning: 'docker',
            currentDigest: undefined,
            autoReplaceStringTemplate:
              '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          },
          {
            depName: 'docker.io/bitnami/postgres-exporter2',
            currentValue: '7.0.100-preview.1.22110.4',
            datasource: 'docker',
            replaceString: '7.0.100-preview.1.22110.4',
            versioning: 'docker',
            currentDigest: undefined,
            autoReplaceStringTemplate:
              '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          },
          {
            depName: 'docker.io/bitnami/postgres-exporter3',
            currentValue: '1.2.2',
            datasource: 'docker',
            replaceString: '1.2.2@sha256:xxxxxx',
            versioning: 'docker',
            currentDigest: 'sha256:xxxxxx',
            autoReplaceStringTemplate:
              '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          },
          {
            depName: 'docker.io/bitnami/postgres-exporter4',
            currentValue: '10.90',
            datasource: 'docker',
            replaceString: '10.90',
            versioning: 'docker',
            currentDigest: undefined,
            autoReplaceStringTemplate:
              '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          },
        ],
      });
    });
  });
});
