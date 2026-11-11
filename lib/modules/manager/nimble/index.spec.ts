import {
  categories,
  defaultConfig,
  displayName,
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
    expect(supportsLockFileMaintenance).toBeTrue();
    expect(lockFileMaintenanceIsDelegatedToPackageManager).toBeFalse();
    expect(lockFileNames).toEqual(['nimble.lock', 'atlas.lock']);
    expect(defaultConfig.managerFilePatterns).toEqual([
      '/(^|/)[^/]+\\.nimble$/',
    ]);
    expect(supportedDatasources).toEqual(['git-tags']);
  });
});
