import type { ExtractConfig } from '../types';
import { extractPackageFile } from '.';
import { partial } from '~test/util';

const config = partial<ExtractConfig>({});

const configAliases = partial<ExtractConfig>({
  registryAliases: {
    'quay.io': 'registry.internal/mirror/quay.io',
  },
});

const packageFile = 'values.yaml';

describe('modules/manager/quadlet/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid quadlet file content', () => {
      const result = extractPackageFile('nothing here: [', packageFile, config);
      expect(result).toBeNull();
    });

    it('returns null for empty yaml file content', () => {
      const result = extractPackageFile('', packageFile, config);
      expect(result).toBeNull();
    });

    it('extracts from quadlet container unit', () => {
      const simple = `[Container]
Image=docker.io/library/alpine:3.22`;

      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '3.22',
            depName: 'docker.io/library/alpine',
          },
        ],
      });
    });

    it('extracts from quadlet image unit', () => {
      const simple = `[Image]
Image=docker.io/library/alpine:3.22`;

      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '3.22',
            depName: 'docker.io/library/alpine',
          },
        ],
      });
    });

    it('extracts from quadlet volume unit', () => {
      const simple = `[Volume]
Image=docker.io/library/alpine:3.22`;

      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '3.22',
            depName: 'docker.io/library/alpine',
          },
        ],
      });
    });

    it('extract data from file with registry aliases', () => {
      const aliasFile = `[Container]
Image=quay.io/metallb/controller:v0.13.10`;

      const result = extractPackageFile(aliasFile, packageFile, configAliases);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: 'v0.13.10',
            depName: 'quay.io/metallb/controller',
            packageName: 'registry.internal/mirror/quay.io/metallb/controller',
            datasource: 'docker',
          },
        ],
      });
    });
  });
});
