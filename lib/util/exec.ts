// istanbul ignore file
import { promisify } from 'util';
import { exec as cpExec, ExecOptions } from 'child_process';

const pExec = promisify(cpExec);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export function exec(cmd: string, options?: ExecOptions): Promise<ExecResult> {
  return pExec(cmd, { ...options, encoding: 'utf-8' });
}
