import type { ExtractConfig } from '../types';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';
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
      const simple = Fixtures.get('simple.container');
      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toMatchSnapshot({
        deps: [
          {
            currentValue: '1.21',
            depName: 'docker.io/alpine',
          },
        ],
      });
    });

    it('extracts from quadlet image unit', () => {
      const simple = Fixtures.get('simple.image');
      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toMatchSnapshot({
        deps: [
          {
            currentValue: '1.21',
            depName: 'docker.io/alpine',
          },
        ],
      });
    });

    it('extracts from quadlet volume unit', () => {
      const simple = Fixtures.get('simple.volume');
      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toMatchSnapshot({
        deps: [
          {
            currentValue: '1.21',
            depName: 'docker.io/alpine',
          },
        ],
      });
    });

    it('extract data from file with registry aliases', () => {
      const aliasFile = Fixtures.get('registry-alias.container');
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
