import {
  categories,
  defaultConfig,
  displayName,
  knownDepTypes,
  lockFileMaintenanceIsDelegatedToPackageManager,
  lockFileNames,
  supportedDatasources,
  supportsLockFileMaintenance,
  url,
} from './index.ts';

describe('modules/manager/nimble/index', () => {
  it('exports manager configuration and metadata', () => {
    expect(displayName).toBe('nimble');
    expect(url).toBe('https://github.com/nim-lang/nimble');
    expect(categories).toEqual(['nim']);
    expect(defaultConfig).toEqual({
      managerFilePatterns: ['/(^|/)[^/]+\\.nimble$/'],
      versioning: 'nimble',
    });
    expect(supportsLockFileMaintenance).toBeTrue();
    expect(lockFileNames).toEqual(['nimble.lock', 'atlas.lock']);
    expect(lockFileMaintenanceIsDelegatedToPackageManager).toBeTrue();
    expect(supportedDatasources).toEqual(['git-tags']);
    expect(knownDepTypes).toHaveLength(3);
  });
});
