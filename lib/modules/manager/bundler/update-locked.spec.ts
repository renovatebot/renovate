import { Fixtures } from '../../../../test/fixtures';
import type { UpdateLockedConfig } from '../types';
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
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });

  it('returns unsupported', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'Gemfile',
      lockFile: 'Gemfile.lock',
      lockFileContent,
      depName: 'activejob',
      newVersion: '5.2.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });
});
