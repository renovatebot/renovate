import { promisify } from 'util';
import {
  exec as cpExec,
  ExecOptions as ChildProcessExecOptions,
} from 'child_process';
import { dockerCmd, DockerOptions } from './docker';

const pExec: (
  cmd: string,
  opts: ChildProcessExecOptions & { encoding: string }
) => Promise<ExecResult> = promisify(cpExec);

export interface ExecOptions extends ChildProcessExecOptions {
  docker?: DockerOptions;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export function exec(
  cmd: string,
  options?: ExecOptions & { docker?: DockerOptions }
): Promise<ExecResult> {
  let pExecCommand = cmd;
  const pExecOptions = { ...options, encoding: 'utf-8' };

  if (options && options.docker) {
    const { cwd, docker } = options;
    pExecCommand = dockerCmd(cmd, { ...docker, cwd });
    delete pExecOptions.docker;
  }

  return pExec(pExecCommand, pExecOptions);
}
