import { isNonEmptyString, isString } from '@sindresorhus/is';
import { join } from 'shlex';
import { GlobalConfig } from '../../../config/global.ts';
import { SYSTEM_INSUFFICIENT_MEMORY } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { newlineRegex, regEx } from '../../regex.ts';
import { uniq } from '../../uniq.ts';
import { rawExec } from '../common.ts';
import type {
  CommandWithOptions,
  DockerOptions,
  VolumeOption,
  VolumesPair,
} from '../types.ts';
import { isCommandWithOptions } from '../utils.ts';

const prefetchedImages = new Map<string, string>();

const digestRegex = regEx('Digest: (.*?)\n');

export const sideCarName = 'sidecar';

export async function prefetchDockerImage(taggedImage: string): Promise<void> {
  if (prefetchedImages.has(taggedImage)) {
    logger.debug(
      `Docker image is already prefetched: ${taggedImage}@${prefetchedImages.get(
        taggedImage,
      )!}`,
    );
  } else {
    logger.debug(`Fetching Docker image: ${taggedImage}`);
    const res = await rawExec(`docker pull ${taggedImage}`, {});
    const imageDigest = digestRegex.exec(res?.stdout)?.[1] ?? 'unknown';
    logger.debug(
      `Finished fetching Docker image ${taggedImage}@${imageDigest}`,
    );
    prefetchedImages.set(taggedImage, imageDigest);
  }
}

export function resetPrefetchedImages(): void {
  prefetchedImages.clear();
}

function expandVolumeOption(x: VolumeOption): VolumesPair | null {
  if (isNonEmptyString(x)) {
    return [x, x];
  }
  if (Array.isArray(x) && x.length === 2) {
    const [from, to] = x;
    // v8 ignore else -- TODO: add test #40625
    if (isNonEmptyString(from) && isNonEmptyString(to)) {
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

function prepareVolumes(volumes: VolumeOption[]): string[] {
  const expanded: (VolumesPair | null)[] = volumes.map(expandVolumeOption);
  const filtered: VolumesPair[] = expanded.filter(
    (vol): vol is VolumesPair => vol !== null,
  );
  const unique: VolumesPair[] = uniq<VolumesPair>(filtered, volumesEql);
  return unique.map(([from, to]) => `-v "${from}":"${to}"`);
}

function getContainerName(name: string, prefix?: string): string {
  return `${prefix ?? 'renovate_'}${name}`.replace(regEx(/\//g), '_');
}

function getContainerLabel(prefix: string | undefined): string {
  return `${prefix ?? 'renovate_'}child`;
}

export async function removeDockerContainer(
  image: string,
  prefix: string,
): Promise<void> {
  const containerName = getContainerName(sideCarName, prefix);
  let cmd = `docker ps --filter name=${containerName} -aq`;
  try {
    const res = await rawExec(cmd, {});
    const containerId = res?.stdout?.trim() || '';
    if (containerId.length) {
      logger.debug(`Removing container with ID: ${containerId}`);
      cmd = `docker rm -f ${containerId}`;
      await rawExec(cmd, {});
    } else {
      logger.trace({ image, containerName }, 'No running containers to remove');
    }
  } catch (err) {
    logger.warn(
      { image, containerName, cmd, err },
      'Could not remove Docker container',
    );
  }
}

export async function removeDanglingContainers(): Promise<void> {
  if (GlobalConfig.get('binarySource') !== 'docker') {
    return;
  }

  try {
    const containerLabel = getContainerLabel(
      GlobalConfig.get('dockerChildPrefix'),
    );
    logger.debug(
      `Removing dangling child containers with label ${containerLabel}`,
    );
    const res = await rawExec(
      `docker ps --filter label=${containerLabel} -aq`,
      {},
    );
    if (res?.stdout?.trim().length) {
      const containerIds = res.stdout
        .trim()
        .split(newlineRegex)
        .map((container) => container.trim())
        .filter(Boolean);
      logger.debug({ containerIds }, 'Removing dangling child containers');
      await rawExec(`docker rm -f ${containerIds.join(' ')}`, {});
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
  commands: (string | CommandWithOptions)[],
  preCommands: (string | CommandWithOptions)[],
  options: DockerOptions,
  sideCarImage: string,
): Promise<string> {
  const { envVars, cwd } = options;
  const volumes = options.volumes ?? [];
  const {
    localDir,
    cacheDir,
    containerbaseDir,
    dockerUser,
    dockerChildPrefix,
    dockerCliOptions,
  } = GlobalConfig.get();
  const result = ['docker run --rm'];
  const containerName = getContainerName(sideCarName, dockerChildPrefix);
  const containerLabel = getContainerLabel(dockerChildPrefix);
  result.push(`--name=${containerName}`);
  result.push(`--label=${containerLabel}`);
  if (dockerUser) {
    result.push(`--user=${dockerUser}`);
  }
  if (dockerCliOptions) {
    result.push(dockerCliOptions);
  }

  const volumeDirs: VolumeOption[] = [localDir, cacheDir];
  if (containerbaseDir) {
    if (cacheDir && containerbaseDir.startsWith(cacheDir)) {
      logger.debug('containerbaseDir is inside cacheDir');
    } else {
      logger.debug('containerbaseDir is separate from cacheDir');
      volumeDirs.push(containerbaseDir);
    }
  } else {
    logger.debug('containerbaseDir is missing');
  }
  volumeDirs.push(...volumes);
  result.push(...prepareVolumes(volumeDirs));

  // v8 ignore else -- TODO: add test #40625
  if (envVars) {
    result.push(
      ...uniq(envVars)
        .filter(isString)
        .map((e) => `-e ${e}`),
    );
  }

  if (cwd) {
    result.push(`-w "${cwd}"`);
  }

  logger.debug({ image: sideCarImage }, 'Resolved tag constraint');

  await prefetchDockerImage(sideCarImage);
  result.push(sideCarImage);

  const bashCommandParts = [];

  for (const preCommand of preCommands) {
    if (
      isCommandWithOptions(preCommand) &&
      isString(join(preCommand.command))
    ) {
      if (preCommand.ignoreFailure) {
        bashCommandParts.push(`${join(preCommand.command)} || true`);
      } else {
        bashCommandParts.push(join(preCommand.command));
      }
    } else if (isString(preCommand)) {
      bashCommandParts.push(preCommand);
    }
  }

  for (const command of commands) {
    if (isCommandWithOptions(command)) {
      if (command.ignoreFailure) {
        bashCommandParts.push(`${join(command.command)} || true`);
      } else {
        bashCommandParts.push(join(command.command));
      }
    } else {
      bashCommandParts.push(command);
    }
  }

  const bashCommand = bashCommandParts.join(' && ');
  result.push(`bash -l -c "${bashCommand.replace(regEx(/"/g), '\\"')}"`); // lgtm [js/incomplete-sanitization]

  return result.join(' ');
}
