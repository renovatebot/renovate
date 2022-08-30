import is from '@sindresorhus/is';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { rawExec } from './common';
import { generateInstallCommands, isDynamicInstall } from './containerbase';
import { generateDockerCommand, removeDockerContainer } from './docker';
import { getChildProcessEnv } from './env';
import { getHermitEnvs, isHermit } from './hermit';
import type {
  DockerOptions,
  ExecOptions,
  ExecResult,
  ExtraEnv,
  Opt,
  RawExecOptions,
} from './types';

function getChildEnv({
  extraEnv,
  env: forcedEnv = {},
}: ExecOptions): Record<string, string> {
  const globalConfigEnv = GlobalConfig.get('customEnvVariables');

  const inheritedKeys: string[] = [];
  for (const [key, val] of Object.entries(extraEnv ?? {})) {
    if (is.string(val)) {
      inheritedKeys.push(key);
    }
  }

  const parentEnv = getChildProcessEnv(inheritedKeys);
  const combinedEnv = {
    ...extraEnv,
    ...parentEnv,
    ...globalConfigEnv,
    ...forcedEnv,
  };

  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(combinedEnv)) {
    if (is.string(val)) {
      result[key] = `${val}`;
    }
  }

  return result;
}

function dockerEnvVars(extraEnv: ExtraEnv, childEnv: ExtraEnv): string[] {
  const extraEnvKeys = Object.keys(extraEnv || {});
  return extraEnvKeys.filter((key) => is.nonEmptyString(childEnv[key]));
}

function getCwd({ cwd, cwdFile }: ExecOptions): string | undefined {
  const defaultCwd = GlobalConfig.get('localDir');
  const paramCwd = cwdFile
    ? upath.join(defaultCwd, upath.dirname(cwdFile))
    : cwd;
  return paramCwd ?? defaultCwd;
}

function getRawExecOptions(opts: ExecOptions): RawExecOptions {
  const defaultExecutionTimeout = GlobalConfig.get('executionTimeout');
  const childEnv = getChildEnv(opts);
  const cwd = getCwd(opts);
  const rawExecOptions: RawExecOptions = {
    cwd,
    encoding: 'utf-8',
    env: childEnv,
    maxBuffer: opts.maxBuffer,
    timeout: opts.timeout,
  };
  // Set default timeout config.executionTimeout if specified; othrwise to 15 minutes
  if (!rawExecOptions.timeout) {
    if (defaultExecutionTimeout) {
      rawExecOptions.timeout = defaultExecutionTimeout * 60 * 1000;
    } else {
      rawExecOptions.timeout = 15 * 60 * 1000;
    }
  }

  // Set default max buffer size to 10MB
  rawExecOptions.maxBuffer = rawExecOptions.maxBuffer ?? 10 * 1024 * 1024;
  return rawExecOptions;
}

function isDocker(docker: Opt<DockerOptions>): docker is DockerOptions {
  const { binarySource } = GlobalConfig.get();
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
  const { customEnvVariables, containerbaseDir, binarySource } =
    GlobalConfig.get();

  if (binarySource === 'docker' || binarySource === 'install') {
    logger.debug(`Setting BUILDPACK_CACHE_DIR to ${containerbaseDir!}`);
    opts.env ??= {};
    opts.env.BUILDPACK_CACHE_DIR = containerbaseDir;
  }

  const rawOptions = getRawExecOptions(opts);

  let rawCommands = typeof cmd === 'string' ? [cmd] : cmd;

  if (isDocker(docker)) {
    logger.debug({ image: docker.image }, 'Using docker to execute');
    const extraEnv = {
      ...opts.extraEnv,
      ...customEnvVariables,
    };
    const childEnv = getChildEnv(opts);
    const envVars = [
      ...dockerEnvVars(extraEnv, childEnv),
      'BUILDPACK_CACHE_DIR',
    ];
    const cwd = getCwd(opts);
    const dockerOptions: DockerOptions = { ...docker, cwd, envVars };
    const preCommands = [
      ...(await generateInstallCommands(opts.toolConstraints)),
      ...(opts.preCommands ?? []),
    ];
    const dockerCommand = await generateDockerCommand(
      rawCommands,
      preCommands,
      dockerOptions
    );
    rawCommands = [dockerCommand];
  } else if (isDynamicInstall(opts.toolConstraints)) {
    logger.debug('Using containerbase dynamic installs');
    rawCommands = [
      ...(await generateInstallCommands(opts.toolConstraints)),
      ...(opts.preCommands ?? []),
      ...rawCommands,
    ];
  } else if (isHermit()) {
    const hermitEnvVars = await getHermitEnvs(rawOptions);
    logger.debug(
      { hermitEnvVars },
      'merging hermit environment variables into the execution options'
    );
    rawOptions.env = {
      ...rawOptions.env,
      ...hermitEnvVars,
    };
  }

  return { rawCommands, rawOptions };
}

export async function exec(
  cmd: string | string[],
  opts: ExecOptions = {}
): Promise<ExecResult> {
  const { docker } = opts;
  const dockerChildPrefix =
    GlobalConfig.get('dockerChildPrefix') ?? 'renovate_';

  const { rawCommands, rawOptions } = await prepareRawExec(cmd, opts);
  const useDocker = isDocker(docker);

  let res: ExecResult = { stdout: '', stderr: '' };
  for (const rawCmd of rawCommands) {
    const startTime = Date.now();
    if (useDocker) {
      await removeDockerContainer(docker.image, dockerChildPrefix);
    }
    logger.debug({ command: rawCmd }, 'Executing command');
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

  return res;
}
