import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { UpdateType } from '../../../config/types';
import * as terraformLockfile from '../terraform/lockfile';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from './artifacts';

vi.mock('../terraform/lockfile');

const config = {
  constraints: {},
};

const adminConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
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
      isLockFileMaintenance: true,
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
