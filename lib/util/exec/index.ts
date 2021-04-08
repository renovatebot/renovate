import type { ExecOptions as ChildProcessExecOptions } from 'child_process';
import { dirname, join } from 'upath';
import { getAdminConfig } from '../../config/admin';
import type { RenovateConfig } from '../../config/types';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import {
  BinarySource,
  DockerOptions,
  ExecConfig,
  ExecResult,
  Opt,
  RawExecOptions,
  rawExec,
} from './common';
import {
  generateDockerCommand,
  removeDanglingContainers,
  removeDockerContainer,
} from './docker';
import { getChildProcessEnv } from './env';

const execConfig: ExecConfig = {
  binarySource: null,
  localDir: null,
  cacheDir: null,
};

export async function setExecConfig(
  config: Partial<RenovateConfig>
): Promise<void> {
  for (const key of Object.keys(execConfig)) {
    const value = config[key];
    execConfig[key] = value || null;
  }
  if (execConfig.binarySource === 'docker') {
    await removeDanglingContainers(getAdminConfig().dockerChildPrefix);
  }
}

type ExtraEnv<T = unknown> = Record<string, T>;

export interface ExecOptions extends ChildProcessExecOptions {
  cwdFile?: string;
  extraEnv?: Opt<ExtraEnv>;
  docker?: Opt<DockerOptions>;
}

function createChildEnv(
  env: NodeJS.ProcessEnv,
  extraEnv: ExtraEnv
): ExtraEnv<string> {
  const extraEnvEntries = Object.entries({ ...extraEnv }).filter(([_, val]) => {
    if (val === null) {
      return false;
    }
    if (val === undefined) {
      return false;
    }
    return true;
  });
  const extraEnvKeys = Object.keys(extraEnvEntries);

  const childEnv = {
    ...extraEnv,
    ...getChildProcessEnv(extraEnvKeys),
    ...env,
  };

  const result: ExtraEnv<string> = {};
  Object.entries(childEnv).forEach(([key, val]) => {
    if (val === null) {
      return;
    }
    if (val === undefined) {
      return;
    }
    result[key] = val.toString();
  });
  return result;
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

export async function exec(
  cmd: string | string[],
  opts: ExecOptions = {}
): Promise<ExecResult> {
  const { env, docker, cwdFile } = opts;
  const { dockerChildPrefix, customEnvVariables } = getAdminConfig();
  const extraEnv = { ...opts.extraEnv, ...customEnvVariables };
  let cwd;
  // istanbul ignore if
  if (cwdFile) {
    cwd = join(execConfig.localDir, dirname(cwdFile));
  }
  cwd = cwd || opts.cwd || execConfig.localDir;
  const childEnv = createChildEnv(env, extraEnv);

  const execOptions: ExecOptions = { ...opts };
  delete execOptions.extraEnv;
  delete execOptions.docker;
  delete execOptions.cwdFile;

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

  let commands = typeof cmd === 'string' ? [cmd] : cmd;
  const useDocker = execConfig.binarySource === BinarySource.Docker && docker;
  if (useDocker) {
    logger.debug('Using docker to execute');
    const dockerOptions = {
      ...docker,
      cwd,
      envVars: dockerEnvVars(extraEnv, childEnv),
    };

    const dockerCommand = await generateDockerCommand(
      commands,
      dockerOptions,
      execConfig
    );
    commands = [dockerCommand];
  }

  let res: ExecResult | null = null;
  for (const rawExecCommand of commands) {
    const startTime = Date.now();
    if (useDocker) {
      await removeDockerContainer(docker.image, dockerChildPrefix);
    }
    logger.debug({ command: rawExecCommand }, 'Executing command');
    logger.trace({ commandOptions: rawExecOptions }, 'Command options');
    try {
      res = await rawExec(rawExecCommand, rawExecOptions);
    } catch (err) {
      logger.trace({ err }, 'rawExec err');
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
          cmd: rawExecCommand,
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
