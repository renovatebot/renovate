import { Fixtures } from '../../../../test/fixtures';
import { partial } from '../../../../test/util';
import type { ExtractConfig } from '../types';
import { extractPackageFile } from '.';

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
      const result = extractPackageFile(
        helmMultiAndNestedImageValues,
        packageFile,
        config,
      );
      expect(result).toMatchSnapshot();
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
            depName: 'registry.internal/mirror/quay.io/metallb/controller',
            datasource: 'docker',
            versioning: 'docker',
          },
          {
            currentValue: 'v0.13.10',
            depName: 'registry.internal/mirror/quay.io/metallb/speaker',
            datasource: 'docker',
            versioning: 'docker',
          },
        ],
      });
    });
  });
});
