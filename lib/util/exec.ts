import { promisify } from 'util';
import {
  exec as cpExec,
  ExecOptions as ChildProcessExecOptions,
} from 'child_process';
import { dockerCmd, DockerOptions } from './docker';
import { getChildProcessEnv } from './env';
import { defaultEnvVars } from './envVars';

const pExec: (
  cmd: string,
  opts: ChildProcessExecOptions & { encoding: string }
) => Promise<ExecResult> = promisify(cpExec);

export interface ExecOptions extends ChildProcessExecOptions {
  envVars?: string[];
  docker?: DockerOptions;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export function exec(cmd: string, opts: ExecOptions = {}): Promise<ExecResult> {
  const { env: customEnv = {}, envVars = [], docker, cwd } = opts;

  let pExecCommand = cmd;
  const pExecOptions = {
    encoding: 'utf-8',
    ...opts,
  };
  delete pExecOptions.envVars;
  delete pExecOptions.docker;

  const processEnv = getChildProcessEnv(envVars);
  const isCustomEnv = !!opts.env || typeof opts.envVars !== 'undefined';
  if (isCustomEnv) {
    [...defaultEnvVars, ...envVars].forEach(key => {
      if (
        typeof customEnv[key] === 'undefined' &&
        typeof processEnv[key] !== 'undefined'
      ) {
        customEnv[key] = processEnv[key];
      }
    });
  }
  pExecOptions.env = isCustomEnv ? customEnv : processEnv;

  if (docker) {
    const dockerOptions = {
      ...docker,
      cwd,
      envVars: envVars.filter(
        key => typeof pExecOptions.env[key] !== 'undefined'
      ),
    };

    pExecCommand = dockerCmd(cmd, dockerOptions);
  }

  return pExec(pExecCommand, pExecOptions);
}
