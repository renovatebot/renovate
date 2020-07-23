import { exec as _exec } from 'child_process';
import is from '@sindresorhus/is';
import traverse from 'traverse';
import { toUnix } from 'upath';
import { ExecOptions } from '../lib/util/exec';

type CallOptions = ExecOptions | null | undefined;

export type ExecResult = { stdout: string; stderr: string } | Error;

export type ExecMock = jest.Mock<typeof _exec>;
export const exec: ExecMock = _exec as any;

interface ExecSnapshot {
  cmd: string;
  options?: ExecOptions | null | undefined;
}

export type ExecSnapshots = ExecSnapshot[];

export function execSnapshot(cmd: string, options?: CallOptions): ExecSnapshot {
  const snapshot = {
    cmd,
    options,
  };

  const cwd = toUnix(process.cwd());

  // eslint-disable-next-line array-callback-return
  return traverse(snapshot).map(function fixup(v) {
    if (is.string(v)) {
      const val = v.replace(/\\(\w)/g, '/$1').replace(cwd, '/root/project');
      this.update(val);
    }
  });
}

const defaultExecResult = { stdout: '', stderr: '' };

export function mockExecAll(
  execFn: ExecMock,
  execResult: ExecResult = defaultExecResult
): ExecSnapshots {
  const snapshots: ExecSnapshots = [];
  execFn.mockImplementation((cmd, options, callback) => {
    snapshots.push(execSnapshot(cmd, options));
    if (execResult instanceof Error) {
      throw execResult;
    }
    callback(null, execResult);
    return undefined;
  });
  return snapshots;
}

export function mockExecSequence(
  execFn: ExecMock,
  execResults: ExecResult[]
): ExecSnapshots {
  const snapshots: ExecSnapshots = [];
  execResults.forEach((execResult) => {
    execFn.mockImplementationOnce((cmd, options, callback) => {
      snapshots.push(execSnapshot(cmd, options));
      if (execResult instanceof Error) {
        throw execResult;
      }
      callback(null, execResult);
      return undefined;
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
