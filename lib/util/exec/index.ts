import type { ExecOptions as ChildProcessExecOptions } from 'child_process';
import { dirname, join } from 'upath';
import { getAdminConfig } from '../../config/admin';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ensureCacheDir, ensureDir, privateCacheDir } from '../fs';
import {
  DockerOptions,
  ExecResult,
  Opt,
  RawExecOptions,
  VolumesPair,
  rawExec,
} from './common';
import {
  generateDockerCommand,
  getTmpCacheName,
  removeDockerContainer,
} from './docker';
import { getChildProcessEnv } from './env';

type ExtraEnv<T = unknown> = Record<string, T>;

export interface CacheDirOption {
  dir: string;
  env: string;
}

export interface ExecOptions extends ChildProcessExecOptions {
  cwdFile?: string;
  extraEnv?: Opt<ExtraEnv>;
  docker?: Opt<DockerOptions>;
  cacheDir?: Opt<CacheDirOption>;
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
  const { env, docker, cwdFile, cacheDir } = opts;
  const {
    binarySource,
    dockerChildPrefix,
    dockerCache,
    customEnvVariables,
    localDir,
  } = getAdminConfig();

  const extraEnv = { ...opts.extraEnv, ...customEnvVariables };
  let cwd;
  // istanbul ignore if
  if (cwdFile) {
    cwd = join(localDir, dirname(cwdFile));
  }
  cwd = cwd || opts.cwd || localDir;
  const childEnv = createChildEnv(env, extraEnv);

  const execOptions: ExecOptions = { ...opts };
  delete execOptions.extraEnv;
  delete execOptions.docker;
  delete execOptions.cwdFile;
  delete execOptions.cacheDir;

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
  const useDocker = binarySource === 'docker' && docker;
  if (useDocker) {
    logger.debug('Using docker to execute');
    const envVars = dockerEnvVars(extraEnv, childEnv);
    const dockerOptions: DockerOptions = { ...docker, cwd, envVars };

    if (cacheDir) {
      const tmpCacheName = getTmpCacheName();
      if (dockerCache === 'volume') {
        const mountTarget = `/tmp`;
        const mountedCachePath = join(mountTarget, cacheDir.dir);
        const mountPair: VolumesPair = [tmpCacheName, mountTarget];

        dockerOptions.volumes = [...(dockerOptions.volumes || []), mountPair];
        rawExecOptions.env[cacheDir.env] = mountedCachePath;
        dockerOptions.preCommands = [
          `mkdir -p ${mountedCachePath}`,
          ...(dockerOptions.preCommands || []),
        ];
      } else if (dockerCache === 'mount') {
        const mountSource = join(privateCacheDir(), tmpCacheName);
        const sourceCachePath = join(mountSource, cacheDir.dir);
        const mountTarget = join('/tmp/', tmpCacheName);
        const targetCachePath = join(mountTarget, cacheDir.dir);
        const mountPair: VolumesPair = [mountSource, mountTarget];

        dockerOptions.volumes = [...(dockerOptions.volumes || []), mountPair];
        rawExecOptions.env[cacheDir.env] = targetCachePath;
        await ensureDir(sourceCachePath);
      }

      dockerOptions.envVars.push(cacheDir.env);
    }

    const dockerCommand = await generateDockerCommand(commands, dockerOptions);
    commands = [dockerCommand];
  } else if (cacheDir) {
    const cacheLocalPath = await ensureCacheDir(cacheDir.dir);
    rawExecOptions.env[cacheDir.env] = cacheLocalPath;
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
