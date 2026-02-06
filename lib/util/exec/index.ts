import { isNonEmptyString } from '@sindresorhus/is';
import upath from 'upath';
import { GlobalConfig } from '../../config/global.ts';
import type { ToolSettingsOptions } from '../../config/types.ts';
import { TEMPORARY_ERROR } from '../../constants/error-messages.ts';
import { logger } from '../../logger/index.ts';
import { getCustomEnv, getUserEnv } from '../env.ts';
import { rawExec } from './common.ts';
import { generateInstallCommands, isDynamicInstall } from './containerbase.ts';
import {
  generateDockerCommand,
  removeDockerContainer,
} from './docker/index.ts';
import { getHermitEnvs, isHermit } from './hermit.ts';
import type {
  CommandWithOptions,
  DockerOptions,
  ExecOptions,
  ExecResult,
  ExtraEnv,
  Opt,
  RawExecOptions,
} from './types.ts';
import { getChildEnv } from './utils.ts';

function dockerEnvVars(extraEnv: ExtraEnv, childEnv: ExtraEnv): string[] {
  const extraEnvKeys = Object.keys(extraEnv);
  return extraEnvKeys.filter((key) => isNonEmptyString(childEnv[key]));
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
  let timeout = opts.timeout;
  // Set default timeout config.executionTimeout if specified; othrwise to 15 minutes
  if (!timeout) {
    if (defaultExecutionTimeout) {
      timeout = defaultExecutionTimeout * 60 * 1000;
    } else {
      timeout = 15 * 60 * 1000;
    }
  }

  // Set default max buffer size to 10MB
  const maxBuffer = opts.maxBuffer ?? 10 * 1024 * 1024;

  return {
    cwd,
    env: childEnv,
    maxBuffer,
    timeout,
    ...(opts.shell !== undefined && { shell: opts.shell }),
    stdin: 'pipe',
    stdout: opts.ignoreStdout ? 'ignore' : 'pipe',
    stderr: 'pipe',
  };
}

function isDocker(docker: Opt<DockerOptions>): docker is DockerOptions {
  return GlobalConfig.get('binarySource') === 'docker' && !!docker;
}

interface RawExecArguments {
  rawCommands: (string | CommandWithOptions)[];
  rawOptions: RawExecOptions;
}

async function prepareRawExec(
  cmd:
    | string
    | string[]
    | CommandWithOptions[]
    | (string | CommandWithOptions)[],
  opts: ExecOptions,
  sideCarImage: string,
): Promise<RawExecArguments> {
  const { docker } = opts;
  const preCommands = opts.preCommands ?? [];
  const customEnvVariables = getCustomEnv();
  const userConfiguredEnv = getUserEnv();
  const { containerbaseDir, binarySource } = GlobalConfig.get();

  if (binarySource === 'docker' || binarySource === 'install') {
    logger.debug(`Setting CONTAINERBASE_CACHE_DIR to ${containerbaseDir!}`);
    opts.env ??= {};
    opts.env.CONTAINERBASE_CACHE_DIR = containerbaseDir;
  }

  let rawOptions = getRawExecOptions(opts);

  let rawCommands = typeof cmd === 'string' ? [cmd] : cmd;

  if (isDocker(docker)) {
    logger.debug({ image: sideCarImage }, 'Using docker to execute');
    const extraEnv = {
      ...opts.extraEnv,
      ...customEnvVariables,
      ...userConfiguredEnv,
    };
    const childEnv = getChildEnv(opts);
    const envVars = [
      ...dockerEnvVars(extraEnv, childEnv),
      'CONTAINERBASE_CACHE_DIR',
    ];
    const cwd = getCwd(opts);
    const dockerOptions: DockerOptions = { ...docker, cwd, envVars };
    const dockerCommand = await generateDockerCommand(
      rawCommands,
      [
        ...(await generateInstallCommands(opts.toolConstraints)),
        ...preCommands,
      ],
      dockerOptions,
      sideCarImage,
    );
    rawCommands = [dockerCommand];
  } else if (isDynamicInstall(opts.toolConstraints)) {
    logger.debug('Using containerbase dynamic installs');
    rawCommands = [
      ...(await generateInstallCommands(opts.toolConstraints)),
      ...preCommands,
      ...rawCommands,
    ];
  } else if (isHermit()) {
    const hermitEnvVars = await getHermitEnvs(rawOptions);
    logger.debug(
      { hermitEnvVars },
      'merging hermit environment variables into the execution options',
    );
    rawOptions = {
      ...rawOptions,
      env: {
        ...rawOptions.env,
        ...hermitEnvVars,
      },
    };
  }

  if (
    GlobalConfig.get('binarySource') === 'global' &&
    opts.toolConstraints?.length
  ) {
    logger.once.debug(
      { toolConstraints: opts.toolConstraints },
      'Ignoring tool contraints because of `binarySource=global`',
    );
  }

  return { rawCommands, rawOptions };
}

export async function exec(
  cmd:
    | string
    | string[]
    | CommandWithOptions[]
    | (string | CommandWithOptions)[],
  opts: ExecOptions = {},
): Promise<ExecResult> {
  const { docker } = opts;
  const dockerChildPrefix = GlobalConfig.get('dockerChildPrefix', 'renovate_');
  const sideCarImage = GlobalConfig.get('dockerSidecarImage')!;

  const { rawCommands, rawOptions } = await prepareRawExec(
    cmd,
    opts,
    sideCarImage,
  );
  const useDocker = isDocker(docker);

  let res: ExecResult = { stdout: '', stderr: '' };
  for (const rawCmd of rawCommands) {
    const startTime = Date.now();
    if (useDocker) {
      await removeDockerContainer(sideCarImage, dockerChildPrefix);
    }
    logger.debug({ command: rawCmd }, 'Executing command');
    logger.trace({ commandOptions: rawOptions }, 'Command options');
    try {
      res = await rawExec(rawCmd, rawOptions);
    } catch (err) {
      const durationMs = Math.round(Date.now() - startTime);
      logger.debug({ err, durationMs }, 'rawExec err');
      if (useDocker) {
        await removeDockerContainer(sideCarImage, dockerChildPrefix).catch(
          (removeErr: Error) => {
            const message: string = err.message;
            throw new Error(
              `Error: "${removeErr.message}" - Original Error: "${message}"`,
            );
          },
        );
      }
      if (err.signal === `SIGTERM`) {
        logger.debug(
          { err },
          'exec interrupted by SIGTERM - run needs to be aborted',
        );
        throw new Error(TEMPORARY_ERROR);
      }
      throw err;
    }
    const durationMs = Math.round(Date.now() - startTime);
    logger.debug(
      {
        durationMs,
        stdout: res.stdout,
        stderr: res.stderr,
      },
      'exec completed',
    );
  }

  return res;
}

export function getToolSettingsOptions(
  repoConfig?: ToolSettingsOptions,
): ToolSettingsOptions {
  let defaults = GlobalConfig.get('toolSettings');
  defaults ??= {
    jvmMaxMemory: 512,
    jvmMemory: 512,
  };

  const options: ToolSettingsOptions = {};

  options.jvmMaxMemory = defaults?.jvmMaxMemory ?? 512;
  options.jvmMemory = defaults?.jvmMemory ?? options.jvmMaxMemory;
  options.nodeMaxMemory ??= defaults?.nodeMaxMemory;

  if (repoConfig !== undefined) {
    if (repoConfig.jvmMaxMemory) {
      if (repoConfig.jvmMaxMemory > options.jvmMaxMemory) {
        logger.once.debug(
          `A higher jvmMaxMemory (${repoConfig.jvmMaxMemory}) than the global configuration (${options.jvmMaxMemory}) is not permitted for Java VM invocations. Using global configuration instead`,
        );
      }

      options.jvmMaxMemory = Math.min(
        options.jvmMaxMemory,
        repoConfig.jvmMaxMemory,
      );
    }

    if (repoConfig.jvmMemory) {
      options.jvmMemory = repoConfig.jvmMemory;
    }

    if (repoConfig.nodeMaxMemory) {
      if (
        options.nodeMaxMemory &&
        repoConfig.nodeMaxMemory > options.nodeMaxMemory
      ) {
        logger.once.debug(
          `A higher nodeMaxMemory (${repoConfig.nodeMaxMemory}) than the global configuration (${options.nodeMaxMemory}) is not permitted for Node invocations. Using global configuration instead`,
        );
      } else {
        options.nodeMaxMemory = repoConfig.nodeMaxMemory;
      }
    }
  }

  options.jvmMaxMemory = Math.floor(options.jvmMaxMemory);
  options.jvmMemory = Math.floor(options.jvmMemory);
  if (options.nodeMaxMemory) {
    options.nodeMaxMemory = Math.floor(options.nodeMaxMemory);
  }

  // make sure that the starting memory can't be more than the max memory
  options.jvmMemory = Math.min(options.jvmMemory, options.jvmMaxMemory);

  if (options.jvmMaxMemory < 512 || options.jvmMemory < 512) {
    options.jvmMaxMemory = Math.max(options.jvmMaxMemory, 512);

    logger.once.debug(
      'Overriding low memory settings for Java VM invocations to a minimum of 512M',
    );
    options.jvmMemory = Math.max(options.jvmMemory, 512);
  }

  return options;
}
