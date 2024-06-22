import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global';
import { SYSTEM_INSUFFICIENT_MEMORY } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { getPkgReleases } from '../../../modules/datasource';
import * as versioning from '../../../modules/versioning';
import { newlineRegex, regEx } from '../../regex';
import { uniq } from '../../uniq';
import { rawExec } from '../common';
import type { DockerOptions, Opt, VolumeOption, VolumesPair } from '../types';

const prefetchedImages = new Map<string, string>();

const digestRegex = regEx('Digest: (.*?)\n');

export const sideCarImage = 'sidecar';

export async function prefetchDockerImage(taggedImage: string): Promise<void> {
  if (prefetchedImages.has(taggedImage)) {
    logger.debug(
      `Docker image is already prefetched: ${taggedImage}@${prefetchedImages.get(
        taggedImage,
      )!}`,
    );
  } else {
    logger.debug(`Fetching Docker image: ${taggedImage}`);
    const res = await rawExec(`docker pull ${taggedImage}`, {
      encoding: 'utf-8',
    });
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

function prepareVolumes(volumes: VolumeOption[]): string[] {
  const expanded: (VolumesPair | null)[] = volumes.map(expandVolumeOption);
  const filtered: VolumesPair[] = expanded.filter(
    (vol): vol is VolumesPair => vol !== null,
  );
  const unique: VolumesPair[] = uniq<VolumesPair>(filtered, volumesEql);
  return unique.map(([from, to]) => `-v "${from}":"${to}"`);
}

function prepareCommands(commands: Opt<string>[]): string[] {
  return commands.filter<string>((command): command is string =>
    is.string(command),
  );
}

export async function getDockerTag(
  packageName: string,
  constraint: string,
  scheme: string,
): Promise<string> {
  const ver = versioning.get(scheme);

  if (!ver.isValid(constraint)) {
    logger.warn(
      { scheme, constraint },
      `Invalid Docker image version constraint`,
    );
    return 'latest';
  }

  logger.debug(
    { packageName, scheme, constraint },
    `Found version constraint - checking for a compatible image to use`,
  );
  const imageReleases = await getPkgReleases({
    datasource: 'docker',
    packageName,
    versioning: scheme,
  });
  if (imageReleases?.releases) {
    let versions = imageReleases.releases.map((release) => release.version);
    versions = versions.filter(
      (version) => ver.isVersion(version) && ver.matches(version, constraint),
    );
    // Prefer stable versions over unstable, even if the range satisfies both types
    if (!versions.every((version) => ver.isStable(version))) {
      logger.debug('Filtering out unstable versions');
      versions = versions.filter((version) => ver.isStable(version));
    }
    const version = versions.sort(ver.sortVersions.bind(ver)).pop();
    if (version) {
      logger.debug(
        { packageName, scheme, constraint, version },
        `Found compatible image version`,
      );
      return version;
    }
  } else {
    logger.error({ packageName }, `Docker exec: no releases found`);
    return 'latest';
  }
  logger.warn(
    { packageName, constraint, scheme },
    'Failed to find a tag satisfying constraint, using "latest" tag instead',
  );
  return 'latest';
}

function getContainerName(image: string, prefix?: string | undefined): string {
  return `${prefix ?? 'renovate_'}${image}`.replace(regEx(/\//g), '_');
}

function getContainerLabel(prefix: string | undefined): string {
  return `${prefix ?? 'renovate_'}child`;
}

export async function removeDockerContainer(
  image: string,
  prefix: string,
): Promise<void> {
  const containerName = getContainerName(image, prefix);
  let cmd = `docker ps --filter name=${containerName} -aq`;
  try {
    const res = await rawExec(cmd, {
      encoding: 'utf-8',
    });
    const containerId = res?.stdout?.trim() || '';
    if (containerId.length) {
      logger.debug(`Removing container with ID: ${containerId}`);
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
    const res = await rawExec(
      `docker ps --filter label=${containerLabel} -aq`,
      {
        encoding: 'utf-8',
      },
    );
    if (res?.stdout?.trim().length) {
      const containerIds = res.stdout
        .trim()
        .split(newlineRegex)
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
  preCommands: string[],
  options: DockerOptions,
): Promise<string> {
  const { envVars, cwd } = options;
  let image = sideCarImage;
  const volumes = options.volumes ?? [];
  const {
    localDir,
    cacheDir,
    containerbaseDir,
    dockerUser,
    dockerChildPrefix,
    dockerCliOptions,
    dockerSidecarImage,
  } = GlobalConfig.get();
  const result = ['docker run --rm'];
  const containerName = getContainerName(image, dockerChildPrefix);
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

  if (envVars) {
    result.push(
      ...uniq(envVars)
        .filter(is.string)
        .map((e) => `-e ${e}`),
    );
  }

  if (cwd) {
    result.push(`-w "${cwd}"`);
  }

  // TODO: #22198
  image = dockerSidecarImage!;

  // TODO: add constraint: const tag = getDockerTag(image, sideCarImageVersion, 'semver');
  logger.debug(
    { image /*, tagConstraint: sideCarImageVersion, tag */ },
    'Resolved tag constraint',
  );

  const taggedImage = image; // TODO: tag ? `${image}:${tag}` : `${image}`;
  await prefetchDockerImage(taggedImage);
  result.push(taggedImage);

  const bashCommand = [...prepareCommands(preCommands), ...commands].join(
    ' && ',
  );
  result.push(`bash -l -c "${bashCommand.replace(regEx(/"/g), '\\"')}"`); // lgtm [js/incomplete-sanitization]

  return result.join(' ');
}
