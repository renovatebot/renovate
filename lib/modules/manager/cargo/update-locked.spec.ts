import type { UpdateLockedConfig } from '../types';
import * as lockedVersion from './locked-version';
import { updateLockedDependency } from '.';
import { Fixtures } from '~test/fixtures';

const lockFileContent = Fixtures.get('lockfile-parsing/Cargo.v1.lock');

describe('modules/manager/cargo/update-locked', () => {
  it('detects already updated', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'Cargo.toml',
      lockFile: 'Cargo.lock',
      lockFileContent,
      depName: 'foo',
      newVersion: '1.0.4',
      currentVersion: '1.0.4',
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });

  it('returns unsupported for empty lockfile', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'Cargo.toml',
      lockFile: 'Cargo.lock',
      depName: 'foo',
      newVersion: '1.0.4',
      currentVersion: '1.0.4',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported for empty depName', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'Cargo.toml',
      lockFile: 'Cargo.lock',
      lockFileContent,
      depName: undefined as never,
      newVersion: '1.0.4',
      currentVersion: '1.0.4',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'Cargo.toml',
      lockFile: 'Cargo.lock',
      lockFileContent,
      depName: 'foo',
      newVersion: '1.0.3',
      currentVersion: '1.0.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns update-failed in case of errors', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'Cargo.toml',
      lockFile: 'Cargo.lock',
      lockFileContent,
      depName: 'foo',
      newVersion: '1.0.3',
      currentVersion: '1.0.0',
    };
    vi.spyOn(
      lockedVersion,
      'extractLockFileContentVersions',
    ).mockReturnValueOnce(new Error() as never);
    expect(updateLockedDependency(config).status).toBe('update-failed');
  });
});
