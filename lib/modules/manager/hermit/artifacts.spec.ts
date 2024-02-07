import { mockExecAll } from '../../../../test/exec-util';
import { mockedFunction, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { ExecError } from '../../../util/exec/exec-error';
import { localPathIsSymbolicLink, readLocalSymlink } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { StatusResult } from '../../../util/git/types';
import type { UpdateArtifact } from '../types';
import { updateArtifacts } from '.';

jest.mock('../../../util/git');
jest.mock('../../../util/fs');

const getRepoStatusMock = mockedFunction(getRepoStatus);

const lstatsMock = mockedFunction(localPathIsSymbolicLink);
const readlinkMock = mockedFunction(readLocalSymlink);

describe('modules/manager/hermit/artifacts', () => {
  describe('updateArtifacts', () => {
    it('should run hermit install for packages and return updated files', async () => {
      lstatsMock.mockResolvedValue(true);

      readlinkMock.mockResolvedValue('hermit');
      GlobalConfig.set({ localDir: '' });

      const execSnapshots = mockExecAll();
      getRepoStatusMock.mockResolvedValue(
        partial<StatusResult>({
          not_added: ['bin/go-1.17.1'],
          deleted: ['bin/go-1.17'],
          modified: ['bin/go', 'bin/jq'],
          created: ['bin/jq-extra'],
          renamed: [
            {
              from: 'bin/jq-1.5',
              to: 'bin/jq-1.6',
            },
          ],
        }),
      );

      const res = await updateArtifacts(
        partial<UpdateArtifact>({
          updatedDeps: [
            {
              depName: 'go',
              currentVersion: '1.17',
              newValue: '1.17.1',
            },
            {
              depName: 'jq',
              currentVersion: '1.5',
              newValue: '1.6',
            },
          ],
          packageFileName: 'go/bin/hermit',
        }),
      );

      expect(execSnapshots).toMatchObject([
        { cmd: './hermit install go-1.17.1 jq-1.6' },
      ]);

      expect(res).toStrictEqual([
        {
          file: {
            path: 'bin/jq-1.5',
            type: 'deletion',
          },
        },
        {
          file: {
            contents: 'hermit',
            isSymlink: true,
            isExecutable: undefined,
            path: 'bin/jq-1.6',
            type: 'addition',
          },
        },
        {
          file: {
            path: 'bin/go',
            type: 'deletion',
          },
        },
        {
          file: {
            contents: 'hermit',
            isSymlink: true,
            isExecutable: undefined,
            path: 'bin/go',
            type: 'addition',
          },
        },
        {
          file: {
            path: 'bin/jq',
            type: 'deletion',
          },
        },
        {
          file: {
            contents: 'hermit',
            isSymlink: true,
            isExecutable: undefined,
            path: 'bin/jq',
            type: 'addition',
          },
        },
        {
          file: {
            contents: 'hermit',
            isSymlink: true,
            isExecutable: undefined,
            path: 'bin/jq-extra',
            type: 'addition',
          },
        },
        {
          file: {
            contents: 'hermit',
            isSymlink: true,
            isExecutable: undefined,
            path: 'bin/go-1.17.1',
            type: 'addition',
          },
        },
        {
          file: {
            path: 'bin/go-1.17',
            type: 'deletion',
          },
        },
      ]);
    });

    it('should fail on error getting link content', async () => {
      lstatsMock.mockResolvedValue(true);

      readlinkMock.mockResolvedValue(null);
      GlobalConfig.set({ localDir: '' });

      mockExecAll();

      getRepoStatusMock.mockResolvedValue(
        partial<StatusResult>({
          not_added: [],
          deleted: [],
          modified: [],
          created: [],
          renamed: [
            {
              from: 'bin/jq-1.5',
              to: 'bin/jq-1.6',
            },
          ],
        }),
      );

      const res = await updateArtifacts(
        partial<UpdateArtifact>({
          updatedDeps: [
            {
              depName: 'go',
              currentVersion: '1.17',
              newValue: '1.17.1',
            },
            {
              depName: 'jq',
              currentVersion: '1.5',
              newValue: '1.6',
            },
          ],
          packageFileName: 'go/bin/hermit',
        }),
      );

      expect(res).toEqual([
        {
          artifactError: {
            stderr: 'error getting content for bin/jq-1.6',
          },
        },
      ]);
    });

    it('should return error on installation error', async () => {
      mockExecAll(
        new ExecError('', {
          stdout: '',
          stderr: 'error executing hermit install',
          cmd: '',
          options: {
            encoding: 'utf-8',
          },
        }),
      );

      const res = await updateArtifacts(
        partial<UpdateArtifact>({
          updatedDeps: [
            {
              depName: 'go',
              currentVersion: '1.17',
              newValue: '1.17.1',
            },
            {
              depName: 'jq',
              currentVersion: '1.5',
              newValue: '1.6',
            },
          ],
          packageFileName: 'go/bin/hermit',
        }),
      );

      expect(res).toStrictEqual([
        {
          artifactError: {
            lockFile: 'from: go-1.17 jq-1.5, to: go-1.17.1 jq-1.6',
            stderr: 'error executing hermit install',
          },
        },
      ]);
    });

    it('should return error on invalid update information', async () => {
      let res = await updateArtifacts(
        partial<UpdateArtifact>({
          updatedDeps: [
            {
              currentVersion: '1.17',
              newValue: '1.17.1',
            },
          ],
          packageFileName: 'go/bin/hermit',
        }),
      );

      expect(res).toStrictEqual([
        {
          artifactError: {
            lockFile: 'from: -1.17, to: -1.17.1',
            stderr: `invalid package to update`,
          },
        },
      ]);

      res = await updateArtifacts(
        partial<UpdateArtifact>({
          updatedDeps: [
            {
              depName: 'go',
              newValue: '1.17.1',
            },
          ],
          packageFileName: 'go/bin/hermit',
        }),
      );

      expect(res).toStrictEqual([
        {
          artifactError: {
            lockFile: 'from: go-, to: go-1.17.1',
            stderr: `invalid package to update`,
          },
        },
      ]);

      res = await updateArtifacts(
        partial<UpdateArtifact>({
          updatedDeps: [
            {
              depName: 'go',
              currentVersion: '1.17',
            },
          ],
          packageFileName: 'go/bin/hermit',
        }),
      );

      expect(res).toStrictEqual([
        {
          artifactError: {
            lockFile: 'from: go-1.17, to: go-',
            stderr: `invalid package to update`,
          },
        },
      ]);
    });
  });
});
