import { ZodError } from 'zod/v4';
import { mockExecSequence } from '~test/exec-util.ts';
import { GlobalConfig } from '../../config/global.ts';
import * as hostRules from '../host-rules.ts';
import {
  getMiseEnvs,
  isMise,
  parseMiseVersion,
  supportsSafeMode,
} from './mise.ts';
import type { RawExecOptions } from './types.ts';

const localDir = '/tmp/renovate/repository/project-a';
const rawOptions: RawExecOptions = {
  cwd: `${localDir}/nested`,
  env: { PATH: '/usr/bin' },
  maxBuffer: 10485760,
  timeout: 900000,
  stdin: 'pipe',
  stdout: 'pipe',
  stderr: 'pipe',
};
const miseEnvStdout = JSON.stringify({
  PATH: '/home/user/.local/share/mise/installs/go/1.25.0/bin:/usr/bin',
});

describe('util/exec/mise', () => {
  describe('isMise', () => {
    it('returns true only when binarySource is mise', () => {
      GlobalConfig.set({ binarySource: 'hermit' });
      expect(isMise()).toBeFalse();
      GlobalConfig.set({ binarySource: 'mise' });
      expect(isMise()).toBeTrue();
    });
  });

  describe('parseMiseVersion', () => {
    it.each`
      stdout                                       | expected
      ${'2026.7.12 macos-arm64 (2026-07-21)'}      | ${'2026.7.12'}
      ${'mise 2026.10.6 linux-x64 (2026-10-09)\n'} | ${'2026.10.6'}
      ${'not a version'}                           | ${null}
      ${''}                                        | ${null}
    `('parseMiseVersion("$stdout") === $expected', ({ stdout, expected }) => {
      expect(parseMiseVersion(stdout)).toBe(expected);
    });
  });

  describe('supportsSafeMode', () => {
    it.each`
      version        | expected
      ${'2026.7.11'} | ${false}
      ${'2026.7.12'} | ${true}
      ${'2026.10.6'} | ${true}
      ${null}        | ${false}
    `('supportsSafeMode($version) === $expected', ({ version, expected }) => {
      expect(supportsSafeMode(version)).toBe(expected);
    });
  });

  describe('getMiseEnvs', () => {
    beforeEach(() => {
      GlobalConfig.set({ localDir, binarySource: 'mise' });
      hostRules.clear();
    });

    it('installs tools and returns the environment in safe mode', async () => {
      const execSnapshots = mockExecSequence([
        { stdout: '2026.10.6 linux-x64 (2026-10-09)', stderr: '' },
        { stdout: '', stderr: '' },
        { stdout: miseEnvStdout, stderr: '' },
      ]);

      await expect(getMiseEnvs(rawOptions)).resolves.toStrictEqual({
        PATH: '/home/user/.local/share/mise/installs/go/1.25.0/bin:/usr/bin',
      });

      expect(execSnapshots).toMatchObject([
        { cmd: 'mise version', options: rawOptions },
        {
          cmd: 'mise install',
          options: {
            cwd: `${localDir}/nested`,
            env: { PATH: '/usr/bin', MISE_SAFE: '1' },
          },
        },
        {
          cmd: 'mise env --json',
          options: {
            cwd: `${localDir}/nested`,
            env: { PATH: '/usr/bin', MISE_SAFE: '1' },
          },
        },
      ]);
    });

    it('throws when the mise version does not support safe mode', async () => {
      const execSnapshots = mockExecSequence([
        { stdout: '2026.7.11 linux-x64 (2026-07-18)', stderr: '' },
      ]);

      await expect(getMiseEnvs(rawOptions)).rejects.toThrow(
        'binarySource=mise requires mise >= 2026.7.12 (found 2026.7.11), or `mise` in `allowedUnsafeExecutions`',
      );
      expect(execSnapshots).toHaveLength(1);
    });

    it('throws when the mise version cannot be determined', async () => {
      mockExecSequence([{ stdout: 'garbage', stderr: '' }]);

      await expect(getMiseEnvs(rawOptions)).rejects.toThrow(
        'binarySource=mise requires mise >= 2026.7.12 (found unknown), or `mise` in `allowedUnsafeExecutions`',
      );
    });

    it('trusts the repository config when mise is in allowedUnsafeExecutions', async () => {
      GlobalConfig.set({
        localDir,
        binarySource: 'mise',
        allowedUnsafeExecutions: ['mise'],
      });
      const execSnapshots = mockExecSequence([
        { stdout: '', stderr: '' },
        { stdout: miseEnvStdout, stderr: '' },
      ]);

      await expect(getMiseEnvs(rawOptions)).resolves.toStrictEqual({
        PATH: '/home/user/.local/share/mise/installs/go/1.25.0/bin:/usr/bin',
      });

      const expectedEnv = {
        PATH: '/usr/bin',
        MISE_TRUSTED_CONFIG_PATHS: localDir,
        MISE_YES: '1',
      };
      expect(execSnapshots).toMatchObject([
        { cmd: 'mise install', options: { env: expectedEnv } },
        { cmd: 'mise env --json', options: { env: expectedEnv } },
      ]);
      expect(execSnapshots[0].options?.env).not.toHaveProperty('MISE_SAFE');
    });

    it('throws when mise install fails', async () => {
      mockExecSequence([
        { stdout: '2026.10.6 linux-x64 (2026-10-09)', stderr: '' },
        new Error('installing plugins is disabled in safe mode'),
      ]);

      await expect(getMiseEnvs(rawOptions)).rejects.toThrow(
        'installing plugins is disabled in safe mode',
      );
    });

    it('throws when mise env returns invalid output', async () => {
      mockExecSequence([
        { stdout: '2026.10.6 linux-x64 (2026-10-09)', stderr: '' },
        { stdout: '', stderr: '' },
        { stdout: 'not json', stderr: '' },
      ]);

      await expect(getMiseEnvs(rawOptions)).rejects.toThrow(ZodError);
    });

    it('passes the GitHub token to mise', async () => {
      hostRules.add({
        hostType: 'github',
        matchHost: 'api.github.com',
        token: 'x-access-token:ghs_token',
      });
      const execSnapshots = mockExecSequence([
        { stdout: '2026.10.6 linux-x64 (2026-10-09)', stderr: '' },
        { stdout: '', stderr: '' },
        { stdout: miseEnvStdout, stderr: '' },
      ]);

      await expect(getMiseEnvs(rawOptions)).resolves.toStrictEqual({
        PATH: '/home/user/.local/share/mise/installs/go/1.25.0/bin:/usr/bin',
      });

      const expectedEnv = {
        MISE_GITHUB_TOKEN: 'ghs_token',
        PATH: '/usr/bin',
        MISE_SAFE: '1',
      };
      expect(execSnapshots).toMatchObject([
        { cmd: 'mise version' },
        { cmd: 'mise install', options: { env: expectedEnv } },
        { cmd: 'mise env --json', options: { env: expectedEnv } },
      ]);
    });

    it('prefers a configured MISE_GITHUB_TOKEN over the host rule token', async () => {
      hostRules.add({
        hostType: 'github',
        matchHost: 'api.github.com',
        token: 'ghs_token',
      });
      const execSnapshots = mockExecSequence([
        { stdout: '2026.10.6 linux-x64 (2026-10-09)', stderr: '' },
        { stdout: '', stderr: '' },
        { stdout: miseEnvStdout, stderr: '' },
      ]);

      await getMiseEnvs({
        ...rawOptions,
        env: { ...rawOptions.env, MISE_GITHUB_TOKEN: 'custom_token' },
      });

      expect(execSnapshots[1].options?.env).toMatchObject({
        MISE_GITHUB_TOKEN: 'custom_token',
      });
    });
  });
});
