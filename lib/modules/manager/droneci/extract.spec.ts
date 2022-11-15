import { Fixtures } from '../../../../test/fixtures';

import { extractPackageFile } from '.';

const droneciRegistryAlias = Fixtures.get('.drone2.yml');

describe('modules/manager/droneci/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', '', {})).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile(Fixtures.get('.drone.yml'), '', {});
      expect(res?.deps).toMatchSnapshot();
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
          depName: 'my-quay-mirror.registry.com/elixir',
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
          depName: 'my-quay-mirror.registry.com/elixir',
          replaceString: 'quay.io/elixir:1.8.1-alpine',
          depType: 'docker',
        },
      ],
    });
  });
});
