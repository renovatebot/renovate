import { join } from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { UpdateType } from '../../../config/types';
import * as terraformLockfile from '../terraform/lockfile';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from './artifacts';

jest.mock('../terraform/lockfile');

const config = {
  constraints: {},
};

const adminConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};

describe('modules/manager/terragrunt/artifacts', () => {
  const updateTypes: UpdateType[] = [
    'digest',
    'pin',
    'rollback',
    'patch',
    'minor',
    'major',
    'replacement',
    'pinDigest',
    'lockfileUpdate',
    'bump',
  ];

  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  it('calls terraform updateArtifacts if the update type is lockfileMaintenance', async () => {
    const localConfig: UpdateArtifactsConfig = {
      updateType: 'lockFileMaintenance',
      ...config,
    };

    await updateArtifacts({
      packageFileName: '',
      updatedDeps: [],
      newPackageFileContent: '',
      config: localConfig,
    });
    expect(terraformLockfile.updateArtifacts).toHaveBeenCalledOnce();
  });

  it.each(updateTypes)(
    'does not call terraform updateArtifacts if the update type is %s',
    async (updateType) => {
      const localConfig: UpdateArtifactsConfig = {
        updateType,
        ...config,
      };

      await updateArtifacts({
        packageFileName: '',
        updatedDeps: [],
        newPackageFileContent: '',
        config: localConfig,
      });
      expect(terraformLockfile.updateArtifacts).not.toHaveBeenCalled();
    },
  );
});
