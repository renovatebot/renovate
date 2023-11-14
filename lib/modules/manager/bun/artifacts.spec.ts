import _fs from 'fs-extra';
import { mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { exec as _exec } from '../../../util/exec';
import { ExecError } from '../../../util/exec/exec-error';
import type { UpdateArtifact } from '../types';
import { updateArtifacts } from './artifacts';

jest.mock('../../../util/exec');
jest.mock('fs-extra');

const exec = mocked(_exec);
const fs = mocked(_fs);

const globalConfig: RepoGlobalConfig = {
  localDir: '',
};

describe('modules/manager/bun/artifacts', () => {
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
        { manager: 'bun', lockFiles: ['bun.lockb'] },
      ];
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns null if lock content unchanged', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'bun', lockFiles: ['bun.lockb'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns updated lock content', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'bun', lockFiles: ['bun.lockb'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'bun.lockb',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);
    });

    it('supports lockFileMaintenance', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'bun', lockFiles: ['bun.lockb'] },
      ];
      updateArtifact.config.updateType = 'lockFileMaintenance';
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'bun.lockb',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);
    });

    it('handles temporary error', async () => {
      const execError = new ExecError(TEMPORARY_ERROR, {
        cmd: '',
        stdout: '',
        stderr: '',
        options: { encoding: 'utf8' },
      });
      updateArtifact.updatedDeps = [
        { manager: 'bun', lockFiles: ['bun.lockb'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      exec.mockRejectedValueOnce(execError);
      await expect(updateArtifacts(updateArtifact)).rejects.toThrow(
        TEMPORARY_ERROR,
      );
    });

    it('handles full error', async () => {
      const execError = new ExecError('nope', {
        cmd: '',
        stdout: '',
        stderr: '',
        options: { encoding: 'utf8' },
      });
      updateArtifact.updatedDeps = [
        { manager: 'bun', lockFiles: ['bun.lockb'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      exec.mockRejectedValueOnce(execError);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        { artifactError: { lockFile: 'bun.lockb', stderr: 'nope' } },
      ]);
    });
  });
});
