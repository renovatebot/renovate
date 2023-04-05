import { join } from 'upath';
import { mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { UpdateType } from '../../../config/types';
import * as TerraformLockfile from '../terraform/lockfile';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from './artifacts';

jest.mock('../terraform/lockfile');
const mockTFUpdateArtifacts = mocked(TerraformLockfile).updateArtifacts;

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
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
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
    expect(mockTFUpdateArtifacts.mock.calls).toBeArrayOfSize(1);
  });

  it('does not call terraform updateArtifacts if the update type is not lockfileMaintenance', async () => {
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

    for (const t of updateTypes) {
      const localConfig: UpdateArtifactsConfig = {
        updateType: t,
        ...config,
      };

      await updateArtifacts({
        packageFileName: '',
        updatedDeps: [],
        newPackageFileContent: '',
        config: localConfig,
      });
    }
    expect(mockTFUpdateArtifacts.mock.calls).toBeArrayOfSize(0);
  });
});
