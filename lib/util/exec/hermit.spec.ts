import { GlobalConfig } from '../../config/global';
import * as fs from '../fs';
import * as common from './common';
import { findHermitCwd, getHermitEnvs, isHermit } from './hermit';
import type { ExecResult, RawExecOptions } from './types';

describe('util/exec/hermit', () => {
  let localPathExistsMock: jest.SpyInstance;
  let rawExecMock: jest.SpyInstance;
  let globalGetMock: jest.SpyInstance;

  beforeEach(() => {
    localPathExistsMock = jest.spyOn(fs, 'localPathExists');
    rawExecMock = jest.spyOn(common, 'rawExec');
    globalGetMock = jest.spyOn(GlobalConfig, 'get');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isHermit', () => {
    it('should return true when binarySource is hermit', () => {
      globalGetMock.mockReturnValue({ binarySource: 'docker' });
      expect(isHermit()).toBeFalsy();
      globalGetMock.mockReturnValue({ binarySource: 'hermit' });
      expect(isHermit()).toBeTruthy();
    });
  });

  describe('findHermitCwd', () => {
    it('should find the closest hermit cwd to the given path', async () => {
      const root = '/usr/src/app/repository-a';
      globalGetMock.mockReturnValue(root);
      const nestedCwd = 'nested/other/directory';

      localPathExistsMock.mockImplementation((p) => {
        if (p === `bin/hermit` || p === `nested/bin/hermit`) {
          return Promise.resolve(true);
        }

        return Promise.resolve(false);
      });

      expect(await findHermitCwd(nestedCwd)).toBe(`${root}/nested/bin`);
      expect(await findHermitCwd('nested')).toBe(`${root}/nested/bin`);
      expect(await findHermitCwd('')).toBe(`${root}/bin`);
      expect(await findHermitCwd('other/directory')).toBe(`${root}/bin`);
    });

    it('should throw error when hermit cwd is not found', async () => {
      const root = '/usr/src/app/repository-a';
      const err = new Error('hermit not found for other/directory');
      globalGetMock.mockReturnValue(root);
      localPathExistsMock.mockResolvedValue(false);

      await expect(findHermitCwd('other/directory')).rejects.toThrow(err);
    });
  });

  describe('getHermitEnvs', () => {
    it('should return hermit environment variables when hermit env returns successfully', async () => {
      const root = '/usr/src/app/repository-a';
      globalGetMock.mockReturnValue(root);
      localPathExistsMock.mockImplementation((p) => {
        if (p === `bin/hermit`) {
          return Promise.resolve(true);
        }

        return Promise.resolve(false);
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
