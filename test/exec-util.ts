import is from '@sindresorhus/is';
import traverse from 'traverse';
import upath from 'upath';
import { promisifiedSpawn as _promisifiedSpawn } from '../lib/util/exec/common';
import type { SpawnOptions } from '../lib/util/exec/types';
import { regEx } from '../lib/util/regex';

type CallOptions = SpawnOptions | null | undefined;

export type SpawnResult = { stdout: string; stderr: string } | Error;

// TODO: fix type #7154
export type SpawnMock = jest.Mock<typeof _promisifiedSpawn>;
export const promisifiedSpawn: SpawnMock = _promisifiedSpawn as any;

interface SpawnSnapshot {
  cmd: string;
  options?: SpawnOptions | null | undefined;
}

export type SpawnSnapshots = SpawnSnapshot[];

export function spawnSnapshot(
  cmd: string,
  options?: CallOptions
): SpawnSnapshot {
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

const defaultSpawnResult = { stdout: '', stderr: '' };

export function mockSpawnAll(
  spawnFn: SpawnMock,
  spawnResult: SpawnResult = defaultSpawnResult
): SpawnSnapshots {
  const snapshots: SpawnSnapshots = [];
  spawnFn.mockImplementation((cmd, options) => {
    snapshots.push(spawnSnapshot(cmd, options));
    if (spawnResult instanceof Error) {
      throw spawnResult;
    }
    return spawnResult as never;
  });
  return snapshots;
}

export function mockSpawnSequence(
  spawnFn: SpawnMock,
  spawnResults: SpawnResult[]
): SpawnSnapshots {
  const snapshots: SpawnSnapshots = [];
  spawnResults.forEach((spawnResult) => {
    spawnFn.mockImplementationOnce((cmd, options) => {
      snapshots.push(spawnSnapshot(cmd, options));
      if (spawnResult instanceof Error) {
        throw spawnResult;
      }
      return spawnResult as never;
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

// reset spawn mock, otherwise there can be some left over from previous test
beforeEach(() => {
  // maybe not mocked
  promisifiedSpawn.mockReset?.();
});
