import { Fixtures } from '~test/fixtures.ts';
import type { UpdateLockedConfig } from '../types.ts';
import { updateLockedDependency } from './index.ts';

const lockFile = 'pyproject.11.toml.lock';
const packageFile = 'pyproject.11.toml';

const lockFileContent = Fixtures.get(lockFile);

describe('modules/manager/poetry/update-locked', () => {
  it('detects already updated', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile,
      lockFileContent,
      depName: 'urllib3',
      newVersion: '1.26.3',
      currentVersion: '1.26.2',
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
      currentVersion: '1.26.2',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported for missing dependency', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile,
      lockFileContent,
      depName: 'missing',
      newVersion: '1.0.0',
      currentVersion: '0.9.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported for missing locked content', () => {
    const config: UpdateLockedConfig = {
      packageFile,
      lockFile,
      depName: 'urllib3',
      newVersion: '1.26.4',
      currentVersion: '1.26.2',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });
});
