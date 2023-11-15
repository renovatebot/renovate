import { codeBlock } from 'common-tags';
import _findUp from 'find-up';
import upath from 'upath';
import { mockExecAll } from '../../../test/exec-util';
import { mockedFunction, partial } from '../../../test/util';
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
      findUp.mockClear();
    });

    it.each`
      dir                         | hermitLocation         | expected
      ${'nested/other/directory'} | ${'nested/bin/hermit'} | ${'nested/bin'}
      ${'nested'}                 | ${'nested/bin/hermit'} | ${'nested/bin'}
      ${'other/directory'}        | ${'bin/hermit'}        | ${'bin'}
      ${''}                       | ${'bin/hermit'}        | ${'bin'}
    `(
      '("$dir") === $expected (hermit: $hermitLocation)',
      async ({ dir, hermitLocation, expected }) => {
        const cwd = upath.join(localDir, dir);

        findUp.mockResolvedValueOnce(upath.join(localDir, hermitLocation));

        expect(await findHermitCwd(cwd)).toBe(upath.join(localDir, expected));

        expect(findUp.mock.calls[0][1]?.cwd).toBe(cwd);
      },
    );

    it('should throw error when hermit cwd is not found', async () => {
      const err = new Error('hermit not found for other/directory');

      await expect(findHermitCwd('other/directory')).rejects.toThrow(err);
    });
  });

  describe('getHermitEnvs', () => {
    beforeEach(() => {
      GlobalConfig.set({ localDir });
      findUp.mockClear();
    });

    it('should return hermit environment variables when hermit env returns successfully', async () => {
      findUp.mockResolvedValueOnce(upath.join(localDir, 'bin/hermit'));
      mockExecAll({
        stdout: codeBlock`
          GOBIN=/usr/src/app/repository-a/.hermit/go/bin
          PATH=/usr/src/app/repository-a/bin
        `,
        stderr: '',
      });

      const relativeCwd = 'nested/other/bin';
      const fullCwd = upath.join(localDir, relativeCwd);

      const resp = await getHermitEnvs(
        partial<RawExecOptions>({
          cwd: fullCwd,
        }),
      );

      expect(findUp.mock.calls[0][1]?.cwd).toEqual(fullCwd);

      expect(resp).toStrictEqual({
        GOBIN: '/usr/src/app/repository-a/.hermit/go/bin',
        PATH: '/usr/src/app/repository-a/bin',
      });
    });
  });
});
