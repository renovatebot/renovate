import { loadFixture } from '../../../../test/util';
import { extractPackageFile } from './extract';

const helmDefaultChartInitValues = loadFixture(
  'default_chart_init_values.yaml'
);

const helmMultiAndNestedImageValues = loadFixture(
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

    it('returns null for no file content', () => {
      const result = extractPackageFile(null);
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
      expect(result.deps).toHaveLength(5);
    });

    it('extracts from values.yaml image tag"', () => {
      const input = `
      replicaCount: 1
      firstImage:
        registry: docker.io
        repository: mjnagel/postgresql12
        tag: 12.10
      secondImage:
        registry: docker.io
        repository: bitnami/postgres-exporter
        tag: "10.70"`;
      const result = extractPackageFile(input);
      expect(result).toMatchObject({
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
        ],
      });
    });
  });
});
