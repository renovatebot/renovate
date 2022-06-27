jest.mock('../../config/global');
jest.mock('fs-extra');
jest.mock('./common');

import fs from 'fs-extra';
import { mocked, mockedFunction } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import { rawExec } from './common';
import { findHermitCwd, getHermitEnvs, isHermit } from './hermit';
import type { ExecResult, RawExecOptions } from './types';

const globalConfigMock = mocked(GlobalConfig);
const fsMock = mocked(fs);
const rawExecMock = mockedFunction(rawExec);

describe('util/exec/hermit', () => {
  describe('isHermit', () => {
    it('should return true when binarySource is hermit', () => {
      globalConfigMock.get.mockReturnValue({ binarySource: 'docker' });
      expect(isHermit()).toBeFalsy();
      globalConfigMock.get.mockReturnValue({ binarySource: 'hermit' });
      expect(isHermit()).toBeTruthy();
    });
  });

  describe('findHermitCwd', () => {
    it('should find the closest hermit cwd to the given path', async () => {
      const root = '/usr/src/app/repository-a';
      globalConfigMock.get.mockReturnValue(root);
      const nestedCwd = 'nested/other/directory';
      fsMock.stat.mockImplementation((p) => {
        if (p === `${root}/bin/hermit` || p === `${root}/nested/bin/hermit`) {
          return Promise.resolve({} as fs.Stats);
        }

        return Promise.reject('not exists');
      });

      const nestedBin = await findHermitCwd(nestedCwd);
      const rootBin = await findHermitCwd('other/directory');

      expect(nestedBin).toBe(`${root}/nested/bin`);
      expect(rootBin).toBe(`${root}/bin`);
    });

    it('should throw error when hermit cwd is not found', async () => {
      const root = '/usr/src/app/repository-a';
      const err = new Error('hermit not found for other/directory');
      globalConfigMock.get.mockReturnValue(root);
      fsMock.stat.mockRejectedValue('not exists');

      let e: Error | undefined = undefined;

      try {
        await findHermitCwd('other/directory');
      } catch (err) {
        e = err;
      }

      expect(e).toStrictEqual(err);
    });
  });

  describe('getHermitEnvs', () => {
    it('should return hermit environment variables when hermit env returns successfully', async () => {
      const root = '/usr/src/app/repository-a';
      globalConfigMock.get.mockReturnValue(root);
      fsMock.stat.mockImplementation((p) => {
        if (p === `${root}/bin/hermit`) {
          return Promise.resolve({} as fs.Stats);
        }

        return Promise.reject('not exists');
      });
      rawExecMock.mockResolvedValue({
        stdout: `GOBIN=/usr/src/app/repository-a/.hermit/go/bin
PATH=/usr/src/app/repository-a/bin
`,
      } as ExecResult);
      const resp = await getHermitEnvs({} as RawExecOptions);

      expect(resp).toStrictEqual({
        GOBIN: '/usr/src/app/repository-a/.hermit/go/bin',
        PATH: '/usr/src/app/repository-a/bin',
      });
    });
  });
});
