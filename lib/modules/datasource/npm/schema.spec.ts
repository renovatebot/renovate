import { CachedPackument, NpmResponse } from './schema.ts';

describe('modules/datasource/npm/schema', () => {
  it('strips fields outside the cached packument shape', () => {
    expect(
      CachedPackument.parse({
        _id: 'vue',
        name: 'vue',
        repository: {
          type: 'git',
          url: 'https://github.com/vuejs/vue.git',
          directory: 'packages/core',
        },
        homepage: 'https://vuejs.org',
        time: {
          created: '2024-01-01T00:00:00.000Z',
          '1.0.0': '2024-01-02T00:00:00.000Z',
        },
        'dist-tags': { latest: '1.0.0' },
        versions: {
          '1.0.0': {
            repository: 'vuejs/vue',
            homepage: 'https://v1.vuejs.org',
            deprecated: 'deprecated',
            gitHead: 'abc123',
            dependencies: { foo: '^1.0.0' },
            devDependencies: { bar: '^2.0.0' },
            engines: { node: '>=18', bun: '>=1.0.0' },
            dist: {
              attestations: {
                url: 'https://example.com/attestations',
                issuer: 'ignore me',
              },
              tarball: 'https://example.com/vue.tgz',
            },
            scripts: { test: 'vitest' },
          },
        },
        readme: 'huge',
      }),
    ).toEqual({
      repository: {
        url: 'https://github.com/vuejs/vue.git',
        directory: 'packages/core',
      },
      homepage: 'https://vuejs.org',
      time: {
        created: '2024-01-01T00:00:00.000Z',
        '1.0.0': '2024-01-02T00:00:00.000Z',
      },
      'dist-tags': { latest: '1.0.0' },
      versions: {
        '1.0.0': {
          repository: 'vuejs/vue',
          homepage: 'https://v1.vuejs.org',
          deprecated: 'deprecated',
          gitHead: 'abc123',
          dependencies: { foo: '^1.0.0' },
          devDependencies: { bar: '^2.0.0' },
          engines: { node: '>=18' },
          dist: {
            attestations: {
              url: 'https://example.com/attestations',
            },
          },
        },
      },
    });
  });

  describe('NpmResponseSchema', () => {
    it('parses a full npm registry response and preserves extra version fields', () => {
      const input = {
        _id: 'mypackage',
        name: 'mypackage',
        'dist-tags': { latest: '1.0.0' },
        versions: {
          '1.0.0': {
            homepage: 'https://example.com',
            deprecated: false,
            gitHead: 'abc123',
            dependencies: { lodash: '^4.0.0' },
            devDependencies: { jest: '^29.0.0' },
            engines: { node: '>=16' },
            dist: { attestations: { url: 'https://example.com/att' } },
            'renovate-config': { default: { rangeStrategy: 'pin' } },
            scripts: { test: 'jest' }, // extra field
          },
        },
        time: { '1.0.0': '2024-01-01T00:00:00.000Z' },
        repository: { url: 'https://github.com/org/mypackage' },
        homepage: 'https://example.com',
      };
      const result = NpmResponse.parse(input);
      expect(result.name).toBe('mypackage');
      expect(result['dist-tags']?.latest).toBe('1.0.0');
      // renovate-config must be preserved in version objects (passthrough)
      expect(result.versions?.['1.0.0']?.['renovate-config']).toEqual({
        default: { rangeStrategy: 'pin' },
      });
    });

    it('parses a response with string repository shorthand', () => {
      const input = {
        name: 'mypackage',
        'dist-tags': { latest: '1.0.0' },
        versions: { '1.0.0': { repository: 'myorg/mypackage' } },
        repository: 'myorg/mypackage',
      };
      const result = NpmResponse.parse(input);
      expect(result.repository).toBe('myorg/mypackage');
      expect(result.versions?.['1.0.0']?.repository).toBe('myorg/mypackage');
    });

    it('accepts repository.url: null and preserves directory', () => {
      const input = {
        name: 'mypackage',
        'dist-tags': { latest: '1.0.0' },
        versions: {
          '1.0.0': {
            repository: { url: null, directory: 'test' },
          },
        },
        repository: { url: null, directory: 'packages/core' },
      };
      const result = NpmResponse.parse(input);
      expect(result.repository).toEqual({
        url: null,
        directory: 'packages/core',
      });
      expect(result.versions?.['1.0.0']?.repository).toEqual({
        url: null,
        directory: 'test',
      });
    });
  });
});
