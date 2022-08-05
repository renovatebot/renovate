import os from 'os';
import _findUp from 'find-up';
import upath from 'upath';
import { mockExecAll } from '../../../test/exec-util';
import { mockedFunction } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import { findHermitCwd, getHermitEnvs, isHermit } from './hermit';
import type { RawExecOptions } from './types';

jest.mock('find-up');
const findUp = mockedFunction(_findUp);
const localDir = '/tmp/renovate/repository/project-a';

describe('util/exec/hermit', () => {
  describe('isHermit', () => {
    it('should return true when binarySource is hermit', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(isHermit()).toBeFalse();
      GlobalConfig.set({ binarySource: 'hermit' });
      expect(isHermit()).toBeTruthy();
    });
  });

  describe('findHermitCwd', () => {
    beforeEach(() => {
      GlobalConfig.set({ localDir });
    });

    it('should find the closest hermit cwd to the given path', async () => {
      findUp.mockResolvedValueOnce(upath.join(localDir, 'nested/bin/hermit'));
      const nestedCwd = 'nested/other/directory';

      expect(await findHermitCwd(nestedCwd)).toBe(`${localDir}/nested/bin`);
      findUp.mockResolvedValueOnce(upath.join(localDir, 'nested/bin/hermit'));
      expect(await findHermitCwd('nested')).toBe(`${localDir}/nested/bin`);

      findUp.mockResolvedValueOnce(upath.join(localDir, 'bin/hermit'));
      expect(await findHermitCwd('')).toBe(`${localDir}/bin`);
      findUp.mockResolvedValueOnce(upath.join(localDir, 'bin/hermit'));
      expect(await findHermitCwd('other/directory')).toBe(`${localDir}/bin`);
    });

    it('should throw error when hermit cwd is not found', async () => {
      const err = new Error('hermit not found for other/directory');

      await expect(findHermitCwd('other/directory')).rejects.toThrow(err);
    });
  });

  describe('getHermitEnvs', () => {
    beforeEach(() => {
      GlobalConfig.set({ localDir });
    });

    it('should return hermit environment variables when hermit env returns successfully', async () => {
      findUp.mockResolvedValueOnce(upath.join(localDir, 'bin/hermit'));
      mockExecAll({
        stdout:
          [
            'GOBIN=/usr/src/app/repository-a/.hermit/go/bin',
            'PATH=/usr/src/app/repository-a/bin',
          ].join(os.EOL) + os.EOL,
        stderr: '',
      });

      const resp = await getHermitEnvs({} as RawExecOptions);

      expect(resp).toStrictEqual({
        GOBIN: '/usr/src/app/repository-a/.hermit/go/bin',
        PATH: '/usr/src/app/repository-a/bin',
      });
    });
  });
});
