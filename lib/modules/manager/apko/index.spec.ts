import { regEx } from '../../../util/regex.ts';
import {
  defaultConfig,
  lockFileMaintenanceIsDelegatedToPackageManager,
  lockFileNames,
  supportedDatasources,
  supportsLockFileMaintenance,
} from './index.ts';

describe('modules/manager/apko/index', () => {
  it('matches apko.yaml and apko.yml', () => {
    expect(defaultConfig.managerFilePatterns).toEqual(['/(^|/)apko\\.ya?ml$/']);
    const pattern = regEx(defaultConfig.managerFilePatterns[0].slice(1, -1));
    expect(pattern.test('apko.yaml')).toBe(true);
    expect(pattern.test('apko.yml')).toBe(true);
    expect(pattern.test('config/apko.yaml')).toBe(true);
    expect(pattern.test('config/apko.yml')).toBe(true);
    expect(pattern.test('apko.txt')).toBe(false);
    expect(pattern.test('Dockerfile')).toBe(false);
    expect(pattern.test('image.yaml')).toBe(false);
  });

  it('uses the apk datasource', () => {
    expect(supportedDatasources).toEqual(['apk']);
  });

  it('delegates lock file maintenance for apko.lock.json', () => {
    expect(supportsLockFileMaintenance).toBe(true);
    expect(lockFileNames).toEqual(['apko.lock.json']);
    expect(lockFileMaintenanceIsDelegatedToPackageManager).toBe(true);
  });
});
