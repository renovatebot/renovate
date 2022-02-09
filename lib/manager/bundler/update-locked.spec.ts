import { loadFixture } from '../../../test/util';
import type { UpdateLockedConfig } from '../types';
import { updateLockedDependency } from '.';

const lockFileContent = loadFixture('Gemfile.rubyci.lock');

describe('manager/bundler/update-locked', () => {
  it('detects already updated', () => {
    const config: UpdateLockedConfig = {
      lockFileContent,
      depName: 'activejob',
      newVersion: '5.2.3',
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });
  it('returns unsupported', () => {
    const config: UpdateLockedConfig = {
      lockFileContent,
      depName: 'activejob',
      newVersion: '5.2.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });
});
