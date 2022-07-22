import is from '@sindresorhus/is';
import traverse from 'traverse';
import upath from 'upath';
import { rawExec as _exec } from '../lib/util/exec/common';
import type { RawExecOptions } from '../lib/util/exec/types';
import { regEx } from '../lib/util/regex';
import { mockedFunction } from './util';

jest.mock('../lib/util/exec/common');

export type ExecResult = { stdout: string; stderr: string } | Error;

export const exec = mockedFunction(_exec);

export interface ExecSnapshot {
  cmd: string;
  options?: RawExecOptions | null | undefined;
}

export type ExecSnapshots = ExecSnapshot[];

function execSnapshot(cmd: string, options?: RawExecOptions): ExecSnapshot {
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

export function mockExecAll(
  execResult: ExecResult = defaultExecResult
): ExecSnapshots {
  const snapshots: ExecSnapshots = [];
  exec.mockImplementation((cmd, options) => {
    snapshots.push(execSnapshot(cmd, options));
    if (execResult instanceof Error) {
      throw execResult;
    }
    return execResult as never;
  });
  return snapshots;
}

export function mockExecSequence(execResults: ExecResult[]): ExecSnapshots {
  const snapshots: ExecSnapshots = [];
  execResults.forEach((execResult) => {
    exec.mockImplementationOnce((cmd, options) => {
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
