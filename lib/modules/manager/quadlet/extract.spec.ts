import { codeBlock } from 'common-tags';
import { DockerDatasource } from '../../datasource/docker';
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
      const simple = codeBlock`
      [Container]
      Image=docker.io/library/alpine:3.22
      `;

      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '3.22',
            depName: 'docker.io/library/alpine',
            datasource: DockerDatasource.id,
          },
        ],
      });
    });

    it('extracts from quadlet image unit', () => {
      const simple = codeBlock`
      [Image]
      Image=docker.io/library/alpine:3.22
      `;

      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '3.22',
            depName: 'docker.io/library/alpine',
            datasource: DockerDatasource.id,
          },
        ],
      });
    });

    it('extracts from quadlet volume unit', () => {
      const simple = codeBlock`
      [Volume]
      Image=docker.io/library/alpine:3.22
      `;

      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '3.22',
            depName: 'docker.io/library/alpine',
            datasource: DockerDatasource.id,
          },
        ],
      });
    });

    it('handles docker prefix', () => {
      const simple = codeBlock`
      [Volume]
      Image=docker://docker.io/library/alpine:3.22
      `;

      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '3.22',
            depName: 'docker.io/library/alpine',
            datasource: DockerDatasource.id,
          },
        ],
      });
    });

    it('handles docker-daemon prefix', () => {
      const simple = codeBlock`
      [Volume]
      Image=docker-daemon:docker.io/library/alpine:3.22
      `;

      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '3.22',
            depName: 'docker.io/library/alpine',
            datasource: DockerDatasource.id,
          },
        ],
      });
    });

    it('does not extract an image file reference', () => {
      const simple = codeBlock`
      [Container]
      Image=foo.image
      `;

      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toBeNull();
    });

    it('does not extract an build file reference', () => {
      const simple = codeBlock`
      [Container]
      Image=foo.build
      `;

      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toBeNull();
    });

    it('extract data from file with registry aliases', () => {
      const aliasFile = codeBlock`
      [Container]
      Image=quay.io/metallb/controller:v0.13.10
      `;

      const result = extractPackageFile(aliasFile, packageFile, configAliases);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: 'v0.13.10',
            depName: 'quay.io/metallb/controller',
            packageName: 'registry.internal/mirror/quay.io/metallb/controller',
            datasource: DockerDatasource.id,
          },
        ],
      });
    });

    it('handles an unsuccessful parse', () => {
      const simple = codeBlock`
      [Container]
      `;

      const result = extractPackageFile(simple, packageFile, config);
      expect(result).toBeNull();
    });
  });
});
