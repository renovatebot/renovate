import { exec as _exec } from 'child_process';
import { ExecOptions } from '../lib/util/exec';

type CallOptions = ExecOptions | null | undefined;

export type ExecResult = { stdout: string; stderr: string } | Error;

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

  const str = JSON.stringify(snapshot, (k, v) => (v === undefined ? null : v));

  const cwd = process.cwd().replace(/\\(\w)/g, '/$1');
  return JSON.parse(
    str
      .replace(/\\(\w)/g, '/$1')
      .split(cwd)
      .join('/root/project')
  );
}

const defaultExecResult = { stdout: '', stderr: '' };

export function mockExecAll(
  execFn: jest.Mock<typeof _exec>,
  execResult: ExecResult = defaultExecResult
): ExecSnapshots {
  const snapshots = [];
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
  execFn: jest.Mock<typeof _exec>,
  execResults: ExecResult[]
): ExecSnapshots {
  const snapshots = [];
  execResults.forEach(execResult => {
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
