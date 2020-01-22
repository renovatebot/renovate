import { join } from 'path';
import { hrtime } from 'process';
import { ExecOptions as ChildProcessExecOptions } from 'child_process';
import { dockerCmd } from './docker';
import { getChildProcessEnv } from './env';
import { logger } from '../../logger';
import {
  BinarySource,
  ExecConfig,
  ExecResult,
  RawExecOptions,
  rawExec,
  Opt,
  DockerOptions,
} from './common';
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

type ExtraEnv<T = unknown> = Record<string, T>;

export interface ExecOptions extends ChildProcessExecOptions {
  subDirectory?: string;
  extraEnv?: Opt<ExtraEnv>;
  docker?: Opt<DockerOptions>;
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
  const { env, extraEnv, docker, subDirectory } = opts;
  let cwd;
  // istanbul ignore if
  if (subDirectory) {
    cwd = join(execConfig.localDir, subDirectory);
  }
  cwd = cwd || opts.cwd || execConfig.localDir;
  const childEnv = createChildEnv(env, extraEnv);

  const execOptions: ExecOptions = { ...opts };
  delete execOptions.extraEnv;
  delete execOptions.docker;
  delete execOptions.subDirectory;

  const rawExecOptions: RawExecOptions = {
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

    let rawCommand = commands.join(' && ');
    rawCommand = `bash -l -c "${rawCommand.replace(/"/g, '\\"')}"`;
    rawCommand = await dockerCmd(rawCommand, dockerOptions, execConfig);
    commands = [rawCommand];
  }

  let res: ExecResult | null = null;
  for (const rawExecCommand of commands) {
    const startTime = hrtime();
    res = await rawExec(rawExecCommand, rawExecOptions);
    const duration = hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    if (res) {
      logger.debug(
        {
          cmd: rawExecCommand,
          seconds,
          stdout: res.stdout,
          stderr: res.stderr,
        },
        'exec completed'
      );
    }
  }

  return res;
}
