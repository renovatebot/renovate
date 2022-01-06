import { loadFixture } from '../../../test/util';
import type { UpdateLockedConfig } from '../types';
import { updateLockedDependency } from '.';

const lockFileContent = loadFixture('composer5.lock');

describe('manager/composer/update-locked', () => {
  it('detects already updated', () => {
    const config: UpdateLockedConfig = {
      lockFileContent,
      depName: 'awesome/git',
      newVersion: '1.2.0',
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });
  it('returns unsupported', () => {
    const config: UpdateLockedConfig = {
      lockFileContent,
      depName: 'awesome/git',
      newVersion: '1.0.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });
});
