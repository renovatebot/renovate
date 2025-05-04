import { mergeChildConfig } from '../../../config';
import { getConfig } from '../../../config/defaults';
import { allManagersList } from '../../../modules/manager';
import { generateFingerprintConfig } from './extract-fingerprint-config';

describe('workers/repository/extract/extract-fingerprint-config', () => {
  it('filter with enabledManagers', () => {
    const config = mergeChildConfig(getConfig(), {
      registryAliases: {
        stable: 'http://some.link',
      },
      ignorePaths: ['ignore-path-1'],
      includePaths: ['include-path-1'],
      npm: {
        managerFilePatterns: ['/hero.json/'],
        ignorePaths: ['ignore-path-2'],
        includePaths: ['include-path-2'],
        registryAliases: {
          notStable: 'http://some.link.2',
        },
      },
      enabledManagers: ['npm', 'custom.regex'],
      customManagers: [
        {
          customType: 'regex',
          managerFilePatterns: ['/js/', '/***$}{]][/'],
          matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
          datasourceTemplate: 'maven',
          versioningTemplate: 'gradle',
        },
      ],
    });

    const fingerprintConfig = generateFingerprintConfig(config);

    expect(fingerprintConfig.managerList).toEqual(new Set(['npm', 'regex']));
    expect(
      fingerprintConfig.managers.find((manager) => manager.manager === 'npm'),
    ).toEqual({
      enabled: true,
      fileList: [],
      managerFilePatterns: [
        '/(^|/)package\\.json$/',
        '/(^|/)pnpm-workspace\\.yaml$/',
        '/hero.json/',
      ],
      ignorePaths: ['ignore-path-2'],
      includePaths: ['include-path-2'],
      manager: 'npm',
      npmrc: null,
      npmrcMerge: false,
      registryAliases: {
        notStable: 'http://some.link.2',
        stable: 'http://some.link',
      },
      skipInstalls: null,
    });
    expect(
      fingerprintConfig.managers.find((manager) => manager.manager === 'regex'),
    ).toEqual({
      managerFilePatterns: ['/js/', '/***$}{]][/'],
      ignorePaths: ['ignore-path-1'],
      includePaths: ['include-path-1'],
      fileList: [],
      matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
      datasourceTemplate: 'maven',
      versioningTemplate: 'gradle',
      enabled: true,
      manager: 'regex',
      npmrc: null,
      npmrcMerge: false,
      registryAliases: {
        stable: 'http://some.link',
      },
      skipInstalls: null,
    });
  });

  it('filter with all managers enabled', () => {
    const config = mergeChildConfig(getConfig(), {
      npmrc: 'some-string',
      npmrcMerge: true,
      npm: { managerFilePatterns: ['/hero.json/'] },
    });
    const fingerprintConfig = generateFingerprintConfig(config);
    expect(fingerprintConfig.managerList).toEqual(new Set(allManagersList));
    expect(
      fingerprintConfig.managers.find((manager) => manager.manager === 'npm'),
    ).toEqual({
      enabled: true,
      fileList: [],
      managerFilePatterns: [
        '/(^|/)package\\.json$/',
        '/(^|/)pnpm-workspace\\.yaml$/',
        '/hero.json/',
      ],
      ignorePaths: ['**/node_modules/**', '**/bower_components/**'],
      includePaths: [],
      manager: 'npm',
      npmrc: 'some-string',
      npmrcMerge: true,
      registryAliases: {},
      skipInstalls: null,
    });
    expect(
      fingerprintConfig.managers.find(
        (manager) => manager.manager === 'dockerfile',
      ),
    ).toEqual({
      enabled: true,
      fileList: [],
      managerFilePatterns: [
        '/(^|/|\\.)([Dd]ocker|[Cc]ontainer)file$/',
        '/(^|/)([Dd]ocker|[Cc]ontainer)file[^/]*$/',
      ],
      ignorePaths: ['**/node_modules/**', '**/bower_components/**'],
      includePaths: [],
      manager: 'dockerfile',
      npmrc: 'some-string',
      npmrcMerge: true,
      registryAliases: {},
      skipInstalls: null,
    });
    expect(
      fingerprintConfig.managers.find((manager) => manager.manager === 'regex'),
    ).toBeUndefined();
  });
});
