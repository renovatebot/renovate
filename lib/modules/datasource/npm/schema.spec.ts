import { CachedPackument } from './schema.ts';

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
});
