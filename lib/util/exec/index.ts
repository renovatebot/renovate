import { hrtime } from 'process';
import { promisify } from 'util';
import {
  exec as cpExec,
  ExecOptions as ChildProcessExecOptions,
} from 'child_process';
import { dockerCmd } from './docker';
import { getChildProcessEnv } from './env';
import { logger } from '../../logger';
import { BinarySource, DockerOptions, ExecConfig, Opt } from './common';
import { RenovateConfig } from '../../config';

const execConfig: ExecConfig = {
  binarySource: null,
  dockerUser: null,
  localDir: null,
  cacheDir: null,
};

export function setExecConfig(config: Partial<RenovateConfig>): void {
  for (const key of Object.keys(execConfig)) {
    const value = config[key];
    execConfig[key] = value || null;
  }
}

const pExec: (
  cmd: string,
  opts: ChildProcessExecOptions & { encoding: string }
) => Promise<ExecResult> = promisify(cpExec);

type ExtraEnv<T = unknown> = Record<string, T>;

export interface ExecOptions extends ChildProcessExecOptions {
  extraEnv?: Opt<ExtraEnv>;
  docker?: Opt<DockerOptions>;
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

export async function exec(
  cmd: string | string[],
  opts: ExecOptions = {}
): Promise<ExecResult> {
  const { env, extraEnv, docker } = opts;
  const cwd = opts.cwd || execConfig.localDir;
  const childEnv = createChildEnv(env, extraEnv);

  const execOptions: ExecOptions = { ...opts };
  delete execOptions.extraEnv;
  delete execOptions.docker;

  const pExecOptions: ChildProcessExecOptions & { encoding: string } = {
    encoding: 'utf-8',
    ...execOptions,
    env: childEnv,
    cwd,
  };

  let commands = typeof cmd === 'string' ? [cmd] : cmd;
  if (execConfig.binarySource === BinarySource.Docker && docker) {
    logger.debug('Using docker to execute');
    const dockerOptions = {
      ...docker,
      cwd,
      envVars: dockerEnvVars(extraEnv, childEnv),
    };

    let singleCommand = commands.join(' && ');
    singleCommand = `bash -l -c "${singleCommand.replace(/"/g, '\\"')}"`;
    singleCommand = dockerCmd(singleCommand, dockerOptions, execConfig);
    commands = [singleCommand];
  }

  let res: ExecResult | null = null;
  for (const pExecCommand of commands) {
    const startTime = hrtime();
    res = await pExec(pExecCommand, pExecOptions);
    const duration = hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    if (res) {
      logger.debug(
        { cmd: pExecCommand, seconds, stdout: res.stdout, stderr: res.stderr },
        'exec completed'
      );
    }
  }

  return res;
}
