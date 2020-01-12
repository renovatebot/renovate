import { promisify } from 'util';
import {
  exec as cpExec,
  ExecOptions as ChildProcessExecOptions,
} from 'child_process';
import { dockerCmd, DockerOptions } from './docker';
import { getChildProcessEnv } from './env';

const pExec: (
  cmd: string,
  opts: ChildProcessExecOptions & { encoding: string }
) => Promise<ExecResult> = promisify(cpExec);

export interface ExecOptions extends ChildProcessExecOptions {
  extraEnv?: Record<string, string>;
  docker?: DockerOptions;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export function exec(cmd: string, opts: ExecOptions = {}): Promise<ExecResult> {
  const { env, extraEnv, docker, cwd } = opts;

  const pExecOptions = {
    encoding: 'utf-8',
    ...opts,
  };
  delete pExecOptions.extraEnv;
  delete pExecOptions.docker;

  const extraEnvKeys = Object.keys(extraEnv || {});
  pExecOptions.env =
    env || extraEnv
      ? {
          ...extraEnv,
          ...getChildProcessEnv(extraEnvKeys),
          ...env,
        }
      : getChildProcessEnv();

  let pExecCommand = cmd;
  if (docker) {
    const dockerOptions = {
      ...docker,
      cwd,
      envVars: extraEnvKeys.filter(
        key => typeof pExecOptions.env[key] !== 'undefined'
      ),
    };

    pExecCommand = dockerCmd(cmd, dockerOptions);
  }

  return pExec(pExecCommand, pExecOptions);
}
