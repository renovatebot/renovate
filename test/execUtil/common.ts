import { spawn as _spawn } from 'child_process';
import { ExecOptions } from '../../lib/util/exec';

export type CallOptions = ExecOptions | null | undefined;

export type ExecResult =
  | { stdout: string; stderr: string; code?: number }
  | Error;

export type SpawnMock = jest.Mock<typeof _spawn>;

export interface ExecSnapshot {
  cmd: string;
  options?: ExecOptions | null | undefined;
}

export type ExecSnapshots = ExecSnapshot[];
