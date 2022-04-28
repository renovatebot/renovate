import { loadFixture } from '../../../../test/util';
import type { UpdateLockedConfig } from '../types';
import { updateLockedDependency } from '.';

const lockFile = 'pyproject.11.toml.lock';
const packageFile = 'pyproject.11.toml';

const lockFileContent = loadFixture(lockFile);

describe('modules/manager/poetry/update-locked', () => {
  it('detects already updated', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile,
      lockFileContent,
      depName: 'urllib3',
      newVersion: '1.26.3',
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });

  it('returns unsupported', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile,
      lockFileContent,
      depName: 'urllib3',
      newVersion: '1.26.4',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });
});
