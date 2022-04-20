import { loadFixture } from '../../../../test/util';
import type { UpdateLockedConfig } from '../types';
import { updateLockedDependency } from '.';

const lockFile = 'compose.lock';

const lockFileContent = loadFixture('composer5.lock');

describe('modules/manager/composer/update-locked', () => {
  it('detects already updated', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'composer.json',
      lockFile,
      lockFileContent,
      depName: 'awesome/git',
      newVersion: '1.2.0',
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
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });
});
