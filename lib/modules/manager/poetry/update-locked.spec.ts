import { loadFixture } from '../../../../test/util';
import type { UpdateLockedConfig } from '../types';
import { updateLockedDependency } from '.';

const lockFileContent = loadFixture('pyproject.11.toml.lock');

describe('modules/manager/poetry/update-locked', () => {
  it('detects already updated', () => {
    const config: UpdateLockedConfig = {
      lockFileContent,
      depName: 'urllib3',
      newVersion: '1.26.3',
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });
  it('returns unsupported', () => {
    const config: UpdateLockedConfig = {
      lockFileContent,
      depName: 'urllib3',
      newVersion: '1.26.4',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });
});
