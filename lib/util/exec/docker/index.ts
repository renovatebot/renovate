import is from '@sindresorhus/is';
import cryptoRandomString from 'crypto-random-string';
import { join } from 'upath';
import { getAdminConfig } from '../../../config/admin';
import { SYSTEM_INSUFFICIENT_MEMORY } from '../../../constants/error-messages';
import { getPkgReleases } from '../../../datasource';
import { logger } from '../../../logger';
import * as versioning from '../../../versioning';
import { chmod, ensureCacheDir, exists, readdir, remove, stat } from '../../fs';
import { ensureTrailingSlash } from '../../url';
import {
  DockerOptions,
  Opt,
  VolumeOption,
  VolumesPair,
  rawExec,
} from '../common';

const prefetchedImages = new Set<string>();

export async function prefetchDockerImage(taggedImage: string): Promise<void> {
  if (prefetchedImages.has(taggedImage)) {
    logger.debug(`Docker image is already prefetched: ${taggedImage}`);
  } else {
    logger.debug(`Fetching Docker image: ${taggedImage}`);
    prefetchedImages.add(taggedImage);
    await rawExec(`docker pull ${taggedImage}`, { encoding: 'utf-8' });
    logger.debug(`Finished fetching Docker image`);
  }
}

export function resetPrefetchedImages(): void {
  prefetchedImages.clear();
}

function expandVolumeOption(x: VolumeOption): VolumesPair | null {
  if (is.nonEmptyString(x)) {
    return [x, x];
  }
  if (Array.isArray(x) && x.length === 2) {
    const [from, to] = x;
    if (is.nonEmptyString(from) && is.nonEmptyString(to)) {
      return [from, to];
    }
  }
  return null;
}

function volumesEql(x: VolumesPair, y: VolumesPair): boolean {
  const [xFrom, xTo] = x;
  const [yFrom, yTo] = y;
  return xFrom === yFrom && xTo === yTo;
}

function uniq<T = unknown>(
  array: T[],
  eql = (x: T, y: T): boolean => x === y
): T[] {
  return array.filter((x, idx, arr) => arr.findIndex((y) => eql(x, y)) === idx);
}

function prepareVolumes(volumes: VolumeOption[] = []): string[] {
  const expanded: (VolumesPair | null)[] = volumes.map(expandVolumeOption);
  const filtered: VolumesPair[] = expanded.filter((vol) => vol !== null);
  const unique: VolumesPair[] = uniq<VolumesPair>(filtered, volumesEql);
  return unique.map(([from, to]) => `-v "${from}":"${to}"`);
}

function prepareCommands(commands: Opt<string>[]): string[] {
  return commands.filter((command) => command && typeof command === 'string');
}

export async function getDockerTag(
  depName: string,
  constraint: string,
  scheme: string
): Promise<string> {
  const ver = versioning.get(scheme);

  if (!ver.isValid(constraint)) {
    logger.warn({ constraint }, `Invalid ${scheme} version constraint`);
    return 'latest';
  }

  logger.debug(
    { depName, scheme, constraint },
    `Found version constraint - checking for a compatible image to use`
  );
  const imageReleases = await getPkgReleases({
    datasource: 'docker',
    depName,
    versioning: scheme,
  });
  if (imageReleases?.releases) {
    let versions = imageReleases.releases.map((release) => release.version);
    versions = versions.filter(
      (version) => ver.isVersion(version) && ver.matches(version, constraint)
    );
    versions = versions.sort(ver.sortVersions.bind(ver));
    if (versions.length) {
      const version = versions.pop();
      logger.debug(
        { depName, scheme, constraint, version },
        `Found compatible image version`
      );
      return version;
    }
  } else {
    logger.error(`No ${depName} releases found`);
    return 'latest';
  }
  logger.warn(
    { depName, constraint, scheme },
    'Failed to find a tag satisfying constraint, using "latest" tag instead'
  );
  return 'latest';
}

function getContainerName(image: string, prefix?: string): string {
  return `${prefix || 'renovate_'}${image}`.replace(/\//g, '_');
}

function getContainerLabel(prefix: string): string {
  return `${prefix || 'renovate_'}child`;
}

export async function removeDockerContainer(
  image: string,
  prefix: string
): Promise<void> {
  const containerName = getContainerName(image, prefix);
  let cmd = `docker ps --filter name=${containerName} -aq`;
  try {
    const res = await rawExec(cmd, {
      encoding: 'utf-8',
    });
    const containerId = res?.stdout?.trim() || '';
    if (containerId.length) {
      logger.debug({ containerId }, 'Removing container');
      cmd = `docker rm -f ${containerId}`;
      await rawExec(cmd, {
        encoding: 'utf-8',
      });
    } else {
      logger.trace({ image, containerName }, 'No running containers to remove');
    }
  } catch (err) {
    logger.warn(
      { image, containerName, cmd, err },
      'Could not remove Docker container'
    );
  }
}

export async function removeDanglingContainers(): Promise<void> {
  const { binarySource, dockerChildPrefix } = getAdminConfig();
  if (binarySource !== 'docker') {
    return;
  }

  try {
    const containerLabel = getContainerLabel(dockerChildPrefix);
    const res = await rawExec(
      `docker ps --filter label=${containerLabel} -aq`,
      {
        encoding: 'utf-8',
      }
    );
    if (res?.stdout?.trim().length) {
      const containerIds = res.stdout
        .trim()
        .split('\n')
        .map((container) => container.trim())
        .filter(Boolean);
      logger.debug({ containerIds }, 'Removing dangling child containers');
      await rawExec(`docker rm -f ${containerIds.join(' ')}`, {
        encoding: 'utf-8',
      });
    } else {
      logger.debug('No dangling containers to remove');
    }
  } catch (err) {
    if (err.errno === 'ENOMEM') {
      throw new Error(SYSTEM_INSUFFICIENT_MEMORY);
    }
    if (err.stderr?.includes('Cannot connect to the Docker daemon')) {
      logger.info('No docker daemon found');
    } else {
      logger.warn({ err }, 'Error removing dangling containers');
    }
  }
}

export async function generateDockerCommand(
  commands: string[],
  options: DockerOptions
): Promise<string> {
  const { envVars, cwd, tagScheme, tagConstraint } = options;
  let image = options.image;
  const volumes = options.volumes || [];
  const preCommands = options.preCommands || [];
  const postCommands = options.postCommands || [];
  const {
    localDir,
    cacheDir,
    dockerUser,
    dockerChildPrefix,
    dockerImagePrefix,
  } = getAdminConfig();
  const result = ['docker run --rm'];
  const containerName = getContainerName(image, dockerChildPrefix);
  const containerLabel = getContainerLabel(dockerChildPrefix);
  result.push(`--name=${containerName}`);
  result.push(`--label=${containerLabel}`);
  if (dockerUser) {
    result.push(`--user=${dockerUser}`);
  }

  result.push(...prepareVolumes([localDir, cacheDir, ...volumes]));

  if (envVars) {
    result.push(
      ...uniq(envVars)
        .filter((x) => typeof x === 'string')
        .map((e) => `-e ${e}`)
    );
  }

  if (cwd) {
    result.push(`-w "${cwd}"`);
  }

  image = `${ensureTrailingSlash(dockerImagePrefix ?? 'renovate')}${image}`;

  let tag: string;
  if (options.tag) {
    tag = options.tag;
  } else if (tagConstraint) {
    const tagVersioning = tagScheme || 'semver';
    tag = await getDockerTag(image, tagConstraint, tagVersioning);
    logger.debug(
      { image, tagConstraint, tagVersioning, tag },
      'Resolved tag constraint'
    );
  } else {
    logger.debug({ image }, 'No tag or tagConstraint specified');
  }

  const taggedImage = tag ? `${image}:${tag}` : `${image}`;
  await prefetchDockerImage(taggedImage);
  result.push(taggedImage);

  const bashCommand = [
    ...prepareCommands(preCommands),
    ...commands,
    ...prepareCommands(postCommands),
  ].join(' && ');
  result.push(`bash -l -c "${bashCommand.replace(/"/g, '\\"')}"`); // lgtm [js/incomplete-sanitization]

  return result.join(' ');
}

export async function volumePrune(
  meta?: Record<string, string>
): Promise<void> {
  const cmdParts = ['docker', 'volume', 'prune', '--force'];

  const kvPairs = Object.entries(meta);
  const filterOptions = kvPairs.map(([k, v]) => `--filter label=${k}=${v}`);
  cmdParts.push(...filterOptions);

  const cmd = cmdParts.join(' ');
  await rawExec(cmd, { encoding: 'utf-8' });
}

export async function volumeCreate(
  name: string,
  meta?: Record<string, string>
): Promise<void> {
  const cmdParts = ['docker', 'volume', 'create'];

  if (meta) {
    const kvPairs = Object.entries(meta);
    const labelOptions = kvPairs.map(([k, v]) => `--label ${k}=${v}`);
    cmdParts.push(...labelOptions);
  }

  cmdParts.push(name);

  const cmd = cmdParts.join(' ');
  await rawExec(cmd, { encoding: 'utf-8' });
}

let tmpId: string = null;

export function getTmpCacheId(): string {
  if (!tmpId) {
    tmpId = cryptoRandomString({ length: 16 });
  }
  return tmpId;
}

export function resetTmpCacheId(): void {
  tmpId = null;
}

export function getTmpCacheNs(): string {
  const { dockerChildPrefix } = getAdminConfig();
  return getContainerName('tmpdir_cache', dockerChildPrefix);
}

async function fixPermissionsBeforeDelete(entry: string): Promise<void> {
  try {
    if (await exists(entry)) {
      const stats = await stat(entry);
      if (stats.isDirectory()) {
        await chmod(entry, '755');
        const children = await readdir(entry);
        for (const child of children) {
          await fixPermissionsBeforeDelete(join(entry, child));
        }
      } else if (stats.isFile()) {
        await chmod(entry, '644');
      }
    }
  } catch (err) {
    logger.debug({ err }, 'Permissions fixing error');
  }
}

export async function removeDockerTmpCaches(): Promise<void> {
  resetTmpCacheId();

  const { binarySource, cacheDir, dockerCache } = getAdminConfig();
  if (binarySource === 'docker') {
    const cacheNamespace = getTmpCacheNs();
    if (dockerCache === 'volume') {
      logger.trace(`Deleting Docker cache volume: ${cacheNamespace}_*`);
      await volumePrune({ renovate: cacheNamespace });
    } else if (dockerCache === 'mount') {
      const cacheRoot = join(cacheDir, cacheNamespace);
      if (await exists(cacheRoot)) {
        logger.trace(`Deleting Docker cache directory: ${cacheRoot}`);
        try {
          await remove(cacheRoot);
        } catch (err) {
          await fixPermissionsBeforeDelete(cacheRoot);
          await remove(cacheRoot);
        }
      }
    }
  }
}

export async function ensureDockerTmpCache(): Promise<void> {
  const { binarySource, dockerCache } = getAdminConfig();
  if (binarySource === 'docker') {
    const cacheNs = getTmpCacheNs();
    const cacheId = getTmpCacheId();
    if (dockerCache === 'volume') {
      const cacheName = `${cacheNs}_${cacheId}`;
      logger.trace(`Creating Docker cache volume: ${cacheName}`);
      await volumeCreate(cacheName, { renovate: cacheNs });
    } else if (dockerCache === 'mount') {
      const cacheRoot = join(cacheNs, cacheId);
      logger.trace(`Creating Docker cache directory: ${cacheRoot}`);
      await ensureCacheDir(cacheRoot);
    }
  }
}
