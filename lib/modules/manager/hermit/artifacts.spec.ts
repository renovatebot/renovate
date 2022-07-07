import type { StatusResult } from 'simple-git/promise';
import { mockedFunction } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { exec } from '../../../util/exec';
import {
  localPathIsSymbolicLink,
  readLocalFile,
  readLocalSymlink,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { UpdateArtifact } from '../types';
import { updateArtifacts } from '.';

jest.mock('../../../util/exec');
jest.mock('../../../util/git');
jest.mock('../../../util/fs');

const execMock = mockedFunction(exec);
const getRepoStatusMock = mockedFunction(getRepoStatus);

const lstatsMock = mockedFunction(localPathIsSymbolicLink);
const readlinkMock = mockedFunction(readLocalSymlink);
const readFileMock = mockedFunction(readLocalFile);

describe('modules/manager/hermit/artifacts', () => {
  beforeEach(() => {
    execMock.mockClear();
    getRepoStatusMock.mockClear();
  });

  describe('updateArtifacts', () => {
    it('should run hermit install for packages and return updated files', async () => {
      lstatsMock.mockResolvedValue(true);

      readlinkMock.mockResolvedValue('hermit');
      readFileMock.mockResolvedValue('hermit');
      GlobalConfig.set({ localDir: '' });

      execMock.mockResolvedValue({
        stdout: '',
        stderr: '',
      });
      getRepoStatusMock.mockResolvedValue({
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
      } as StatusResult);

      const res = await updateArtifacts({
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
      } as UpdateArtifact);

      expect(execMock.mock.calls[0][0]).toBe(`./hermit install go-1.17.1`);
      expect(execMock.mock.calls[0][1]).toStrictEqual({
        cwdFile: 'go/bin/hermit',
        docker: {
          image: 'sidecar',
        },
      });

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

    it('should return error on installation error', async () => {
      execMock.mockRejectedValue({ stderr: 'error executing hermit install' });
      const res = await updateArtifacts({
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
      } as UpdateArtifact);

      expect(res).toStrictEqual([
        {
          artifactError: {
            lockFile: 'bin/.go-1.17.pkg',
            stderr: 'error executing hermit install',
          },
        },
        {
          artifactError: {
            lockFile: 'bin/.go-1.17.1.pkg',
            stderr: 'error executing hermit install',
          },
        },
      ]);
    });

    it('should return error on invalid update information', async () => {
      const invalidPackageErrorResp = [
        {
          artifactError: {
            lockFile: undefined,
            stderr: `invalid package to update`,
          },
        },
        {
          artifactError: {
            lockFile: undefined,
            stderr: `invalid package to update`,
          },
        },
      ];
      let res = await updateArtifacts({
        updatedDeps: [
          {
            currentVersion: '1.17',
            newValue: '1.17.1',
          },
        ],
        packageFileName: 'go/bin/hermit',
      } as UpdateArtifact);

      expect(res).toStrictEqual(invalidPackageErrorResp);

      res = await updateArtifacts({
        updatedDeps: [
          {
            depName: 'go',
            newValue: '1.17.1',
          },
        ],
        packageFileName: 'go/bin/hermit',
      } as UpdateArtifact);

      expect(res).toStrictEqual(invalidPackageErrorResp);

      res = await updateArtifacts({
        updatedDeps: [
          {
            depName: 'go',
            currentVersion: '1.17',
          },
        ],
        packageFileName: 'go/bin/hermit',
      } as UpdateArtifact);

      expect(res).toStrictEqual(invalidPackageErrorResp);
    });
  });
});
