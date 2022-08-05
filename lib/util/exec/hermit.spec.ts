import tmp, { DirectoryResult } from 'tmp-promise';
import { mockExecAll } from '../../../test/exec-util';
import { GlobalConfig } from '../../config/global';
import { writeLocalFile } from '../fs';
import { findHermitCwd, getHermitEnvs, isHermit } from './hermit';
import type { RawExecOptions } from './types';

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
    let localDirResult: DirectoryResult;
    let localDir: string;

    beforeEach(async () => {
      localDirResult = await tmp.dir({ unsafeCleanup: true });
      localDir = localDirResult.path;

      GlobalConfig.set({ localDir });
    });

    afterEach(async () => {
      await localDirResult?.cleanup();
    });

    it('should find the closest hermit cwd to the given path', async () => {
      await writeLocalFile('nested/bin/hermit', 'foo');
      await writeLocalFile('bin/hermit', 'bar');

      const nestedCwd = 'nested/other/directory';

      expect(await findHermitCwd(nestedCwd)).toBe(`${localDir}/nested/bin`);
      expect(await findHermitCwd('nested')).toBe(`${localDir}/nested/bin`);
      expect(await findHermitCwd('')).toBe(`${localDir}/bin`);
      expect(await findHermitCwd('other/directory')).toBe(`${localDir}/bin`);
    });

    it('should throw error when hermit cwd is not found', async () => {
      const err = new Error('hermit not found for other/directory');

      await expect(findHermitCwd('other/directory')).rejects.toThrow(err);
    });
  });

  describe('getHermitEnvs', () => {
    it('should return hermit environment variables when hermit env returns successfully', async () => {
      await writeLocalFile('bin/hermit', 'bar');
      mockExecAll({
        stdout: `GOBIN=/usr/src/app/repository-a/.hermit/go/bin
PATH=/usr/src/app/repository-a/bin
`,
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
