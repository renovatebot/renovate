import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

const droneciRegistryAlias = Fixtures.get('.drone2.yml');

describe('modules/manager/droneci/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', '', {})).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile(Fixtures.get('.drone.yml'), '', {});
      expect(res?.deps).toMatchInlineSnapshot(`
        [
          {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "1.8.1-alpine",
            "datasource": "docker",
            "depName": "elixir",
            "depType": "docker",
            "packageName": "elixir",
            "replaceString": "elixir:1.8.1-alpine",
          },
          {
            "autoReplaceStringTemplate": "{{packageName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:36adc17e9cceab32179d3314da9cb9c737ffb11f0de4e688f407ad6d9ca32201",
            "currentValue": "10.0.0",
            "datasource": "docker",
            "depName": "node",
            "depType": "docker",
            "packageName": "amd64/node",
            "replaceString": "amd64/node:10.0.0@sha256:36adc17e9cceab32179d3314da9cb9c737ffb11f0de4e688f407ad6d9ca32201",
          },
          {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "5.7.24",
            "datasource": "docker",
            "depName": "mysql",
            "depType": "docker",
            "packageName": "mysql",
            "replaceString": "mysql:5.7.24",
          },
          {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "alpine",
            "datasource": "docker",
            "depName": "redis",
            "depType": "docker",
            "packageName": "redis",
            "replaceString": "redis:alpine",
          },
          {
            "autoReplaceStringTemplate": ""{{packageName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}\\
                    @{{newDigest}}{{/if}}"",
            "currentDigest": "sha256:36adc17e9cceab32179d3314da9cb9c737ffb11f0de4e688f407ad6d9ca32201",
            "currentValue": "10.0.0",
            "datasource": "docker",
            "depName": "node",
            "depType": "docker",
            "packageName": "amd64/node",
            "replaceString": ""amd64/node:10.0.0\\
                    @sha256:36adc17e9cceab32179d3314da9cb9c737ffb11f0de4e688f407ad6d9ca32201"",
          },
          {
            "autoReplaceStringTemplate": ""{{packageName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}\\
                    @{{newDigest}}{{/if}}"",
            "currentDigest": "sha256:36adc17e9cceab32179d3314da9cb9c737ffb11f0de4e688f407ad6d9ca32201",
            "currentValue": "10.0.0",
            "datasource": "docker",
            "depName": "node",
            "depType": "docker",
            "packageName": "amd64/node",
            "replaceString": "'amd64/node\\
                    :10.0.0\\
                    @sha256:36adc17e9cceab32179d3314da9cb9c737ffb11f0de4e688f407ad6d9ca32201'",
          },
        ]
      `);
      expect(res?.deps).toHaveLength(6);
    });
  });

  it('extracts image and replaces registry', () => {
    const res = extractPackageFile(droneciRegistryAlias, '', {
      registryAliases: {
        'quay.io': 'my-quay-mirror.registry.com',
      },
    });
    expect(res).toEqual({
      deps: [
        {
          autoReplaceStringTemplate:
            'quay.io/elixir:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.8.1-alpine',
          datasource: 'docker',
          depName: 'quay.io/elixir',
          packageName: 'my-quay-mirror.registry.com/elixir',
          replaceString: 'quay.io/elixir:1.8.1-alpine',
          depType: 'docker',
        },
      ],
    });
  });

  it('extracts image but no replacement', () => {
    const res = extractPackageFile(droneciRegistryAlias, '', {
      registryAliases: {
        'index.docker.io': 'my-docker-mirror.registry.com',
      },
    });
    expect(res).toEqual({
      deps: [
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.8.1-alpine',
          datasource: 'docker',
          depName: 'quay.io/elixir',
          packageName: 'quay.io/elixir',
          replaceString: 'quay.io/elixir:1.8.1-alpine',
          depType: 'docker',
        },
      ],
    });
  });

  it('extracts image and no double replacement', () => {
    const res = extractPackageFile(droneciRegistryAlias, '', {
      registryAliases: {
        'quay.io': 'my-quay-mirror.registry.com',
        'my-quay-mirror.registry.com': 'quay.io',
      },
    });
    expect(res).toEqual({
      deps: [
        {
          autoReplaceStringTemplate:
            'quay.io/elixir:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.8.1-alpine',
          datasource: 'docker',
          depName: 'quay.io/elixir',
          packageName: 'my-quay-mirror.registry.com/elixir',
          replaceString: 'quay.io/elixir:1.8.1-alpine',
          depType: 'docker',
        },
      ],
    });
  });
});
