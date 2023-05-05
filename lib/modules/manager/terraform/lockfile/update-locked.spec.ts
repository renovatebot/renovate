import { updateLockedDependency } from '..';
import { Fixtures } from '../../../../../test/fixtures';
import type { UpdateLockedConfig } from '../../types';
import * as utilFns from './util';

const lockFile = 'terraform.hcl';

const lockFileContent = Fixtures.get('validLockfile.hcl');

describe('modules/manager/terraform/lockfile/update-locked', () => {
  it('detects already updated', async () => {
    const config: UpdateLockedConfig = {
      packageFile: 'main.tf',
      lockFile,
      lockFileContent,
      depName: 'hashicorp/aws',
      newVersion: '3.0.0',
      currentVersion: '3.0.0',
    };
    expect((await updateLockedDependency(config)).status).toBe(
      'already-updated'
    );
  });

  it('returns unsupported if dependency is undefined', async () => {
    const config: UpdateLockedConfig = {
      packageFile: 'main.tf',
      lockFile,
      lockFileContent,
      depName: undefined as never,
      newVersion: '3.1.0',
      currentVersion: '3.0.0',
    };
    expect((await updateLockedDependency(config)).status).toBe('unsupported');
  });

  it('returns unsupported if lockfileContent is undefined', async () => {
    const config: UpdateLockedConfig = {
      packageFile: 'main.tf',
      lockFile,
      depName: 'hashicorp/not-there',
      newVersion: '3.1.0',
      currentVersion: '3.0.0',
    };
    expect((await updateLockedDependency(config)).status).toBe('unsupported');
  });

  it('returns unsupported', async () => {
    const config: UpdateLockedConfig = {
      packageFile: 'main.tf',
      lockFile,
      lockFileContent,
      depName: 'hashicorp/aws',
      newVersion: '3.1.0',
      currentVersion: '3.0.0',
    };
    expect((await updateLockedDependency(config)).status).toBe('unsupported');
  });

  it('returns update-failed for errors', async () => {
    const config: UpdateLockedConfig = {
      packageFile: 'main.tf',
      lockFile,
      lockFileContent,
      depName: 'hashicorp/aws',
      newVersion: '3.1.0',
      currentVersion: '3.0.0',
    };
    jest
      .spyOn(utilFns, 'extractLocks')
      .mockReturnValueOnce(new Error() as never);
    expect((await updateLockedDependency(config)).status).toBe('update-failed');
  });
});
