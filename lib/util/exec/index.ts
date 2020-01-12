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

type ExtraEnv<T = unknown> = Record<string, T>;

export interface ExecOptions extends ChildProcessExecOptions {
  extraEnv?: ExtraEnv | null | undefined;
  docker?: DockerOptions | null | undefined;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
}

function createChildEnv(
  env: NodeJS.ProcessEnv,
  extraEnv: ExtraEnv
): ExtraEnv<string> {
  const extraEnvKeys = Object.keys(extraEnv || {});

  const childEnv =
    env || extraEnv
      ? {
          ...extraEnv,
          ...getChildProcessEnv(extraEnvKeys),
          ...env,
        }
      : getChildProcessEnv();

  const result: ExtraEnv<string> = {};
  Object.entries(childEnv).forEach(([key, val]) => {
    if (val === null) return;
    if (val === undefined) return;
    result[key] = val.toString();
  });
  return result;
}

function dockerEnvVars(
  extraEnv: ExtraEnv,
  childEnv: ExtraEnv<string>
): string[] {
  const extraEnvKeys = Object.keys(extraEnv || {});
  return extraEnvKeys.filter(key => typeof childEnv[key] !== 'undefined');
}

export function exec(cmd: string, opts: ExecOptions = {}): Promise<ExecResult> {
  const { env, extraEnv, docker, cwd } = opts;
  const childEnv = createChildEnv(env, extraEnv);

  const execOptions: ExecOptions = { ...opts };
  delete execOptions.extraEnv;
  delete execOptions.docker;

  const pExecOptions: ChildProcessExecOptions & { encoding: string } = {
    encoding: 'utf-8',
    ...execOptions,
    env: childEnv,
  };

  let pExecCommand = cmd;
  if (docker) {
    const dockerOptions = {
      ...docker,
      cwd,
      envVars: dockerEnvVars(extraEnv, childEnv),
    };

    pExecCommand = dockerCmd(cmd, dockerOptions);
  }

  return pExec(pExecCommand, pExecOptions);
}
