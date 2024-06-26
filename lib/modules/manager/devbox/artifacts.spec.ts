import _fs from 'fs-extra';
import { mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { exec as _exec } from '../../../util/exec';
import type { UpdateArtifact } from '../types';
import { updateArtifacts } from './artifacts';

jest.mock('../../../util/exec');
jest.mock('fs-extra');

const exec = mocked(_exec);
const fs = mocked(_fs);

const globalConfig: RepoGlobalConfig = {
  localDir: '',
};

describe('modules/manager/devbox/artifacts', () => {
  describe('updateArtifacts()', () => {
    let updateArtifact: UpdateArtifact;

    beforeEach(() => {
      GlobalConfig.set(globalConfig);
      updateArtifact = {
        config: {},
        newPackageFileContent: '',
        packageFileName: '',
        updatedDeps: [],
      };
    });

    it('skips if no updatedDeps and no lockFileMaintenance', async () => {
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('skips if no lock file in config', async () => {
      updateArtifact.updatedDeps = [{}];
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('skips if cannot read lock file', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'devbox', lockFiles: ['devbox.lock'] },
      ];
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns null if lock content unchanged', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'devbox', lockFiles: ['devbox.lock'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });
  });
});
