import type { ExecOptions as ChildProcessExecOptions } from 'child_process';
import { dirname, join } from 'upath';
import { getAdminConfig } from '../../config/admin';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ensureCacheDir } from '../fs';
import { getCachedTmpDirId, getCachedTmpDirNs } from './cache';
import {
  DockerOptions,
  ExecResult,
  Opt,
  RawExecOptions,
  VolumesPair,
  rawExec,
} from './common';
import { generateDockerCommand, removeDockerContainer } from './docker';
import { getChildProcessEnv } from './env';

type ExtraEnv<T = unknown> = Record<string, T>;

export type CacheOptions = Record<string, string>;

export interface ExecOptions extends ChildProcessExecOptions {
  cwdFile?: string;
  extraEnv?: Opt<ExtraEnv>;
  docker?: Opt<DockerOptions>;
  cache?: Opt<CacheOptions>;
}

function getChildEnv({
  extraEnv = {},
  env: forcedEnv = {},
}: ExecOptions): ExtraEnv<string> {
  const { customEnvVariables: globalConfigEnv } = getAdminConfig();
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

function getCwd({ cwd, cwdFile }: ExecOptions = {}): string {
  const { localDir: defaultCwd } = getAdminConfig();
  const paramCwd = cwdFile ? join(defaultCwd, dirname(cwdFile)) : cwd;
  return paramCwd || defaultCwd;
}

function getRawExecOptions(opts: ExecOptions): RawExecOptions {
  const execOptions: ExecOptions = { ...opts };
  delete execOptions.extraEnv;
  delete execOptions.docker;
  delete execOptions.cwdFile;
  delete execOptions.cache;

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
  const { binarySource } = getAdminConfig();
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
  const { cache = {}, docker } = opts;
  const { customEnvVariables, dockerCache } = getAdminConfig();

  const rawOptions = getRawExecOptions(opts);

  const tmpCacheNs = getCachedTmpDirNs();
  const tmpCacheId = getCachedTmpDirId();

  let rawCommands = typeof cmd === 'string' ? [cmd] : cmd;

  if (isDocker(opts)) {
    logger.debug('Using docker to execute');
    const extraEnv = { ...opts.extraEnv, ...customEnvVariables };
    const childEnv = getChildEnv(opts);
    const envVars = dockerEnvVars(extraEnv, childEnv);
    const cwd = getCwd();
    const dockerOptions: DockerOptions = { ...docker, cwd, envVars };

    const preCommands: string[] = [];
    for (const [cacheEnv, cachePath] of Object.entries(cache)) {
      if (cache && dockerCache && dockerCache !== 'none') {
        const mountTarget = `/tmp`;
        if (dockerCache === 'volume') {
          const tmpCacheName = `${tmpCacheNs}_${tmpCacheId}`;
          const mountedCachePath = join(mountTarget, cachePath);
          const mountPair: VolumesPair = [tmpCacheName, mountTarget];

          dockerOptions.volumes = [...(dockerOptions.volumes || []), mountPair];
          rawOptions.env[cacheEnv] = mountedCachePath;
          preCommands.push(`mkdir -p ${mountedCachePath}`);
        } else if (dockerCache === 'folder') {
          const tmpCacheSubdir = join(tmpCacheNs, tmpCacheId);
          const mountSource = await ensureCacheDir(tmpCacheSubdir);
          const mountPair: VolumesPair = [mountSource, mountTarget];
          dockerOptions.volumes = [...(dockerOptions.volumes || []), mountPair];
          const targetCachePath = join(mountTarget, cachePath);
          rawOptions.env[cacheEnv] = targetCachePath;
        }

        dockerOptions.envVars.push(cacheEnv);
      }
    }

    if (preCommands.length) {
      dockerOptions.preCommands = [
        ...preCommands,
        ...(dockerOptions.preCommands || []),
      ];
    }

    const dockerCommand = await generateDockerCommand(
      rawCommands,
      dockerOptions
    );
    rawCommands = [dockerCommand];
  } else if (cache) {
    for (const [cacheEnv, cachePath] of Object.entries(cache)) {
      const mountSource = join(tmpCacheNs, tmpCacheId);
      const sourceCachePath = join(mountSource, cachePath);
      const cacheLocalPath = await ensureCacheDir(sourceCachePath);
      rawOptions.env[cacheEnv] = cacheLocalPath;
    }
  }

  return { rawCommands, rawOptions };
}

export async function exec(
  cmd: string | string[],
  opts: ExecOptions = {}
): Promise<ExecResult> {
  const { docker } = opts;
  const { dockerChildPrefix } = getAdminConfig();

  const { rawCommands, rawOptions } = await prepareRawExec(cmd, opts);

  let res: ExecResult | null = null;
  for (const rawCmd of rawCommands) {
    const startTime = Date.now();
    if (isDocker(opts)) {
      await removeDockerContainer(docker.image, dockerChildPrefix);
    }
    logger.debug({ command: rawCommands }, 'Executing command');
    logger.trace({ commandOptions: rawOptions }, 'Command options');
    try {
      res = await rawExec(rawCmd, rawOptions);
    } catch (err) {
      logger.debug({ err }, 'rawExec err');
      if (isDocker(opts)) {
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
