import { Fixtures } from '~test/fixtures.ts';
import type { UpdateLockedConfig } from '../types.ts';
import { updateLockedDependency } from './index.ts';

const lockFile = 'compose.lock';

const lockFileContent = Fixtures.get('composer5.lock');

describe('modules/manager/composer/update-locked', () => {
  it('detects already updated', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'composer.json',
      lockFile,
      lockFileContent,
      depName: 'awesome/git',
      newVersion: '1.2.0',
      currentVersion: '0.9.0',
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });

  it('detects already updated dev dependency', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'composer.json',
      lockFile,
      lockFileContent,
      depName: 'awesome/dev-tool',
      newVersion: '2.1.0',
      currentVersion: '2.0.0',
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });

  it('returns unsupported', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'composer.json',
      lockFile,
      lockFileContent,
      depName: 'awesome/git',
      newVersion: '1.0.0',
      currentVersion: '0.9.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });
});
