import { Fixtures } from '../../../../test/fixtures';
import type { UpdateLockedConfig } from '../types';
import * as lockedVersion from './locked-version';
import { updateLockedDependency } from '.';

const lockFileContent = Fixtures.get('Gemfile.rubyci.lock');

describe('modules/manager/bundler/update-locked', () => {
  it('detects already updated', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'Gemfile',
      lockFile: 'Gemfile.lock',
      lockFileContent,
      depName: 'activejob',
      newVersion: '5.2.3',
      currentVersion: '5.1.0',
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });

  it('returns unsupported for empty lockfile', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'Gemfile',
      lockFile: 'Gemfile.lock',
      depName: 'activejob',
      newVersion: '5.2.3',
      currentVersion: '5.2.2',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported for empty depName', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'Gemfile',
      lockFile: 'Gemfile.lock',
      lockFileContent,
      depName: undefined as never,
      newVersion: '5.2.3',
      currentVersion: '5.2.2',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'Gemfile',
      lockFile: 'Gemfile.lock',
      lockFileContent,
      depName: 'activejob',
      newVersion: '5.2.0',
      currentVersion: '5.1.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns update-falied incase of errors', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'Gemfile',
      lockFile: 'Gemfile.lock',
      lockFileContent,
      depName: 'activejob',
      newVersion: '5.2.0',
      currentVersion: '5.1.9',
    };
    jest
      .spyOn(lockedVersion, 'extractLockFileEntries')
      .mockReturnValueOnce(new Error() as never);
    expect(updateLockedDependency(config).status).toBe('update-failed');
  });
});
