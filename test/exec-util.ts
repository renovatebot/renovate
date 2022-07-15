import { spawn as _spawn } from 'child_process';
import is from '@sindresorhus/is';
import traverse from 'traverse';
import upath from 'upath';
import { rawExec as _exec } from '../lib/util/exec/common';
import type { ExecOptions } from '../lib/util/exec/types';
import { regEx } from '../lib/util/regex';

type CallOptions = ExecOptions | null | undefined;

// TODO: rename
export type ExecResult = { stdout: string; stderr: string } | Error;

// TODO: fix type #7154
export type ExecMock = jest.Mock<typeof _exec>;
export const exec: ExecMock = _exec as any;

export type SpawnMock = jest.MockedFunction<typeof _spawn>;
export const spawn = _spawn as SpawnMock;

// TODO: rename
interface ExecSnapshot {
  cmd: string;
  options?: ExecOptions | null | undefined;
}

// TODO: rename
export type ExecSnapshots = ExecSnapshot[];

// TODO: rename
export function execSnapshot(cmd: string, options?: CallOptions): ExecSnapshot {
  const snapshot = {
    cmd,
    options,
  };

  const cwd = upath.toUnix(process.cwd());

  return traverse(snapshot).map(function fixup(v) {
    if (is.string(v)) {
      const val = v
        .replace(regEx(/\\(\w)/g), '/$1')
        .replace(cwd, '/root/project');
      this.update(val);
    }
  });
}

const defaultExecResult = { stdout: '', stderr: '' };

// TODO: rename
export function mockExecAll(
  execFn: ExecMock,
  execResult: ExecResult = defaultExecResult
): ExecSnapshots {
  const snapshots: ExecSnapshots = [];
  execFn.mockImplementation((cmd, options) => {
    snapshots.push(execSnapshot(cmd, options));
    if (execResult instanceof Error) {
      throw execResult;
    }
    return execResult as never;
  });
  return snapshots;
}

// TODO: rename
export function mockExecSequence(
  execFn: ExecMock,
  execResults: ExecResult[]
): ExecSnapshots {
  const snapshots: ExecSnapshots = [];
  execResults.forEach((execResult) => {
    execFn.mockImplementationOnce((cmd, options) => {
      snapshots.push(execSnapshot(cmd, options));
      if (execResult instanceof Error) {
        throw execResult;
      }
      return execResult as never;
    });
  });
  return snapshots;
}

const basicEnvMock = {
  HTTP_PROXY: 'http://example.com',
  HTTPS_PROXY: 'https://example.com',
  NO_PROXY: 'localhost',
  HOME: '/home/user',
  PATH: '/tmp/path',
  LANG: 'en_US.UTF-8',
  LC_ALL: 'en_US',
};

const fullEnvMock = {
  ...basicEnvMock,
  SELECTED_ENV_VAR: 'Can be selected',
  FILTERED_ENV_VAR: 'Should be filtered',
};

const filteredEnvMock = {
  ...basicEnvMock,
  SELECTED_ENV_VAR: fullEnvMock.SELECTED_ENV_VAR,
};

export const envMock = {
  basic: basicEnvMock,
  full: fullEnvMock,
  filtered: filteredEnvMock,
};

// reset exec mock, otherwise there can be some left over from previous test
beforeEach(() => {
  // maybe not mocked
  exec.mockReset?.();
});
