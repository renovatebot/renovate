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

  it('drops non-string `time` entries (e.g. Artifactory `unpublished: null`)', () => {
    const result = NpmResponse.parse({
      name: 'mypackage',
      'dist-tags': { latest: '1.1.0' },
      versions: { '1.0.0': {}, '1.1.0': {} },
      time: {
        unpublished: null,
        created: '2026-01-22T23:58:45.285Z',
        modified: '2026-06-02T00:59:50.138Z',
        '1.0.0': '2026-01-23T01:23:37.982Z',
        '1.1.0': '2026-04-15T18:50:36.431Z',
      },
    });
    expect(result.time).toEqual({
      created: '2026-01-22T23:58:45.285Z',
      modified: '2026-06-02T00:59:50.138Z',
      '1.0.0': '2026-01-23T01:23:37.982Z',
      '1.1.0': '2026-04-15T18:50:36.431Z',
    });
  });

  it('drops non-string `time` entries for the cached packument', () => {
    const result = CachedPackument.parse({
      time: {
        unpublished: null,
        '1.0.0': '2026-01-23T01:23:37.982Z',
      },
      versions: { '1.0.0': {} },
    });
    expect(result.time).toEqual({ '1.0.0': '2026-01-23T01:23:37.982Z' });
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

    describe('parses a response with an array of objects for the `repository`, and returns the first element', () => {
      // https://registry.npmjs.org/tmp
      it('as a package response', () => {
        const input = {
          name: 'tmp',
          versions: {
            '0.0.4': {
              repository: [
                {
                  url: 'git://github.com/raszi/tmp.git',
                  type: 'git',
                },
              ],
            },
          },
          repository: {
            url: 'git://github.com/raszi/tmp.git',
            type: 'git',
          },
        };
        const result = NpmResponse.parse(input);
        expect(result.repository).toEqual({
          url: 'git://github.com/raszi/tmp.git',
        });
        expect(result.versions?.['0.0.4'].repository).toEqual({
          url: 'git://github.com/raszi/tmp.git',
        });
      });

      // https://registry.npmjs.org/tmp/0.0.4
      it('as a version response', () => {
        const input = {
          name: 'tmp',
          version: '0.0.4',
          repository: [
            {
              url: 'git://github.com/raszi/tmp.git',
              type: 'git',
            },
          ],
        };
        const result = NpmResponse.parse(input);
        expect(result.repository).toEqual({
          url: 'git://github.com/raszi/tmp.git',
        });
      });
    });
  });
});
