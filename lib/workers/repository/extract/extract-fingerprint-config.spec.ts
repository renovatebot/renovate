import { mergeChildConfig } from '../../../config';
import { getConfig } from '../../../config/defaults';
import { getManagerList } from '../../../modules/manager';
import { generateFingerprintConfig } from './extract-fingerprint-config';

describe('workers/repository/extract/extract-fingerprint-config', () => {
  it('filter with enabledManagers', () => {
    const config = mergeChildConfig(getConfig(), {
      registryAliases: {
        stable: 'http://some.link',
      },
      npm: { fileMatch: ['hero.json'] },
      enabledManagers: ['npm'],
    });
    config.regexManagers = [
      {
        fileMatch: ['js', '***$}{]]['],
        matchStrings: ['^(?<depName>foo)(?<currentValue>bar)$'],
        datasourceTemplate: 'maven',
        versioningTemplate: 'gradle',
      },
    ];
    const fingerprintConfig = generateFingerprintConfig(config);

    expect(fingerprintConfig.managerList).toEqual(['npm']);
    expect(
      fingerprintConfig.managers.find((manager) => manager.manager === 'npm')
    ).toEqual({
      enabled: true,
      fileMatch: ['(^|/)package\\.json$', 'hero.json'],
      ignorePaths: [],
      includePaths: [],
      manager: 'npm',
      npmrc: null,
      npmrcMerge: false,
      registryAliases: {
        stable: 'http://some.link',
      },
      skipInstalls: null,
    });
    expect(
      fingerprintConfig.managers.find((manager) => manager.manager === 'regex')
    ).toBeUndefined();
  });

  it('filter with all managers enabled', () => {
    const config = mergeChildConfig(getConfig(), {
      npmrc: 'some-string',
      npmrcMerge: true,
      npm: { fileMatch: ['hero.json'] },
    });
    const fingerprintConfig = generateFingerprintConfig(config);
    expect(fingerprintConfig.managerList).toEqual(getManagerList());
    expect(
      fingerprintConfig.managers.find((manager) => manager.manager === 'npm')
    ).toEqual({
      enabled: true,
      fileMatch: ['(^|/)package\\.json$', 'hero.json'],
      ignorePaths: [],
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
      fileMatch: ['(^|/|\\.)Dockerfile$', '(^|/)Dockerfile[^/]*$'],
      ignorePaths: [],
      includePaths: [],
      manager: 'dockerfile',
      npmrc: 'some-string',
      npmrcMerge: true,
      registryAliases: {},
      skipInstalls: null,
    });
    expect(
      fingerprintConfig.managers.find((manager) => manager.manager === 'regex')
    ).toEqual({
      enabled: true,
      fileMatch: [],
      ignorePaths: [],
      includePaths: [],
      manager: 'regex',
      npmrc: 'some-string',
      npmrcMerge: true,
      registryAliases: {},
      skipInstalls: null,
    });
  });
});
