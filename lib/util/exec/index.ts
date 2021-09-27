import type { ExecOptions as ChildProcessExecOptions } from 'child_process';
import { dirname, join } from 'upath';
import { getGlobalConfig } from '../../config/global';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import {
  DockerOptions,
  ExecResult,
  Opt,
  RawExecOptions,
  rawExec,
} from './common';
import { generateDockerCommand, removeDockerContainer } from './docker';
import { getChildProcessEnv } from './env';

type ExtraEnv<T = unknown> = Record<string, T>;

export interface ExecOptions extends ChildProcessExecOptions {
  cwdFile?: string;
  extraEnv?: Opt<ExtraEnv>;
  docker?: Opt<DockerOptions>;
}

function getChildEnv({
  extraEnv = {},
  env: forcedEnv = {},
}: ExecOptions): ExtraEnv<string> {
  const { customEnvVariables: globalConfigEnv } = getGlobalConfig();

  const inheritedKeys = Object.entries(extraEnv).reduce(
    (acc, [key, val]) =>
      val === null || val === undefined ? acc : [...acc, key],
    []
  );
  const parentEnv = getChildProcessEnv(inheritedKeys);
  const childEnv = Object.entries({
    ...extraEnv,
    ...parentEnv,
    ...globalConfigEnv,
    ...forcedEnv,
  }).reduce(
    (acc, [key, val]) =>
      val === null || val === undefined
        ? acc
        : { ...acc, [key]: val.toString() },
    {}
  );
  return childEnv;
}

function dockerEnvVars(
  extraEnv: ExtraEnv,
  childEnv: ExtraEnv<string>
): string[] {
  const extraEnvKeys = Object.keys(extraEnv || {});
  return extraEnvKeys.filter(
    (key) => typeof childEnv[key] === 'string' && childEnv[key].length > 0
  );
}

function getCwd({ cwd, cwdFile }: ExecOptions): string {
  const { localDir: defaultCwd } = getGlobalConfig();
  const paramCwd = cwdFile ? join(defaultCwd, dirname(cwdFile)) : cwd;
  return paramCwd || defaultCwd;
}

function getRawExecOptions(opts: ExecOptions): RawExecOptions {
  const execOptions: ExecOptions = { ...opts };
  delete execOptions.extraEnv;
  delete execOptions.docker;
  delete execOptions.cwdFile;

  const childEnv = getChildEnv(opts);
  const cwd = getCwd(opts);
  const rawExecOptions: RawExecOptions = {
    encoding: 'utf-8',
    ...execOptions,
    env: childEnv,
    cwd,
  };
  // Set default timeout to 15 minutes
  rawExecOptions.timeout = rawExecOptions.timeout || 15 * 60 * 1000;
  // Set default max buffer size to 10MB
  rawExecOptions.maxBuffer = rawExecOptions.maxBuffer || 10 * 1024 * 1024;
  return rawExecOptions;
}

function isDocker({ docker }: ExecOptions): boolean {
  const { binarySource } = getGlobalConfig();
  return binarySource === 'docker' && !!docker;
}

interface RawExecArguments {
  rawCommands: string[];
  rawOptions: RawExecOptions;
}

async function prepareRawExec(
  cmd: string | string[],
  opts: ExecOptions = {}
): Promise<RawExecArguments> {
  const { docker } = opts;
  const { customEnvVariables } = getGlobalConfig();

  const rawOptions = getRawExecOptions(opts);

  let rawCommands = typeof cmd === 'string' ? [cmd] : cmd;

  if (isDocker(opts)) {
    logger.debug('Using docker to execute');
    const extraEnv = { ...opts.extraEnv, ...customEnvVariables };
    const childEnv = getChildEnv(opts);
    const envVars = dockerEnvVars(extraEnv, childEnv);
    const cwd = getCwd(opts);
    const dockerOptions: DockerOptions = { ...docker, cwd, envVars };

    const dockerCommand = await generateDockerCommand(
      rawCommands,
      dockerOptions
    );
    rawCommands = [dockerCommand];
  }

  return { rawCommands, rawOptions };
}

export async function exec(
  cmd: string | string[],
  opts: ExecOptions = {}
): Promise<ExecResult> {
  const { docker } = opts;
  const { dockerChildPrefix } = getGlobalConfig();

  const { rawCommands, rawOptions } = await prepareRawExec(cmd, opts);
  const useDocker = isDocker(opts);

  let res: ExecResult | null = null;
  for (const rawCmd of rawCommands) {
    const startTime = Date.now();
    if (useDocker) {
      await removeDockerContainer(docker.image, dockerChildPrefix);
    }
    logger.debug({ command: rawCommands }, 'Executing command');
    logger.trace({ commandOptions: rawOptions }, 'Command options');
    try {
      res = await rawExec(rawCmd, rawOptions);
    } catch (err) {
      logger.debug({ err }, 'rawExec err');
      if (useDocker) {
        await removeDockerContainer(docker.image, dockerChildPrefix).catch(
          (removeErr: Error) => {
            const message: string = err.message;
            throw new Error(
              `Error: "${removeErr.message}" - Original Error: "${message}"`
            );
          }
        );
      }
      if (err.signal === `SIGTERM`) {
        logger.debug(
          { err },
          'exec interrupted by SIGTERM - run needs to be aborted'
        );
        throw new Error(TEMPORARY_ERROR);
      }
      throw err;
    }
    const durationMs = Math.round(Date.now() - startTime);
    if (res) {
      logger.debug(
        {
          cmd: rawCmd,
          durationMs,
          stdout: res.stdout,
          stderr: res.stderr,
        },
        'exec completed'
      );
    }
  }

  return res;
}
