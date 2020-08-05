import { spawn as _spawn } from 'child_process';
import is from '@sindresorhus/is';
import traverse from 'traverse';
import { toUnix } from 'upath';
import {
  CallOptions,
  ExecResult,
  ExecSnapshot,
  ExecSnapshots,
  SpawnMock,
} from './common';
import { ChildProcessMock } from './mocks/child-process';

export * from './common';
export * from './mocks/child-process';
export * from './mocks/output-stream';

export const spawn: SpawnMock = _spawn as any;

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
  spawnFn: SpawnMock,
  execResult: ExecResult = defaultExecResult
): ExecSnapshots {
  const snapshots: ExecSnapshots = [];
  spawnFn.mockImplementation(((cmd, _args, options) => {
    snapshots.push(execSnapshot(cmd, options));
    return new ChildProcessMock(execResult);
  }) as any);
  return snapshots;
}

export function mockExecSequence(
  spawnFn: SpawnMock,
  execResults: ExecResult[]
): ExecSnapshots {
  const snapshots: ExecSnapshots = [];
  execResults.forEach((execResult) => {
    spawnFn.mockImplementationOnce(((cmd, _args, options) => {
      snapshots.push(execSnapshot(cmd, options));
      return new ChildProcessMock(execResult);
    }) as any);
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
