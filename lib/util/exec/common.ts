import { exec } from 'child_process';
import { promisify } from 'util';
import type { ExecResult, RawExecOptions } from './types';

export const rawExec: (
  cmd: string,
  opts: RawExecOptions
) => Promise<ExecResult> = promisify(exec);
