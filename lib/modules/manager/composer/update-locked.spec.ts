import { Fixtures } from '../../../../test/fixtures';
import type { UpdateLockedConfig } from '../types';
import { updateLockedDependency } from '.';

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
