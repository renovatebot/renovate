import { mergeChildConfig } from '../../../config';
import { getConfig } from '../../../config/defaults';
import { getManagerList, hashMap } from '../../../modules/manager';
import { generateFingerprintConfig } from './extract-fingerprint-config';

describe('workers/repository/extract/extract-fingerprint-config', () => {
  it('filter with enabledManagers', () => {
    const config = mergeChildConfig(getConfig(), {
      registryAliases: {
        stable: 'http://some.link', // intentionally placing the field incorrectly
      },
      ignorePaths: ['ignore-path-1'],
      includePaths: ['include-path-1'],
      npm: {
        fileMatch: ['hero.json'],
        ignorePaths: ['ignore-path-2'],
        includePaths: ['include-path-2'],
        registryAliases: {
          notStable: 'http://some.link.2',
        },
      },
      enabledManagers: ['npm', 'regex'],
      regexManagers: [
        {
          fileMatch: ['js', '***$}{]]['],
          matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
          datasourceTemplate: 'maven',
          versioningTemplate: 'gradle',
        },
      ],
    });

    const fingerprintConfig = generateFingerprintConfig(config);
    const managerFingerprints = new Set([
      hashMap.get('npm'),
      hashMap.get('regex'),
    ]);
    expect(fingerprintConfig.managerFingerprints).toEqual(managerFingerprints);
    expect(
      fingerprintConfig.managers.find((manager) => manager.manager === 'npm')
    ).toEqual({
      enabled: true,
      fileList: [],
      fileMatch: ['(^|/)package\\.json$', 'hero.json'],
      ignorePaths: ['ignore-path-2'],
      includePaths: ['include-path-2'],
      manager: 'npm',
      npmrc: null,
      npmrcMerge: false,
      registryAliases: {
        notStable: 'http://some.link.2',
      },
      skipInstalls: null,
    });
    expect(
      fingerprintConfig.managers.find((manager) => manager.manager === 'regex')
    ).toEqual({
      fileMatch: ['js', '***$}{]]['],
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
      npm: { fileMatch: ['hero.json'] },
    });
    const fingerprintConfig = generateFingerprintConfig(config);
    const managers = getManagerList();
    const managerFingerprints = new Set(
      managers.map((manager) => hashMap.get(manager))
    );
    expect(fingerprintConfig.managerFingerprints).toEqual(managerFingerprints);
    expect(
      fingerprintConfig.managers.find((manager) => manager.manager === 'npm')
    ).toEqual({
      enabled: true,
      fileList: [],
      fileMatch: ['(^|/)package\\.json$', 'hero.json'],
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
        (manager) => manager.manager === 'dockerfile'
      )
    ).toEqual({
      enabled: true,
      fileList: [],
      fileMatch: ['(^|/|\\.)Dockerfile$', '(^|/)Dockerfile[^/]*$'],
      ignorePaths: ['**/node_modules/**', '**/bower_components/**'],
      includePaths: [],
      manager: 'dockerfile',
      npmrc: 'some-string',
      npmrcMerge: true,
      registryAliases: {},
      skipInstalls: null,
    });
    expect(
      fingerprintConfig.managers.find((manager) => manager.manager === 'regex')
    ).toBeUndefined();
  });
});
