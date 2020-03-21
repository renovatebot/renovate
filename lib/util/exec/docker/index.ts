import {
  VolumeOption,
  VolumesPair,
  DockerOptions,
  ExecConfig,
  Opt,
  rawExec,
} from '../common';
import { logger } from '../../../logger';
import * as versioning from '../../../versioning';
import { getPkgReleases } from '../../../datasource/docker';

const prefetchedImages = new Set<string>();

async function prefetchDockerImage(taggedImage: string): Promise<void> {
  if (!prefetchedImages.has(taggedImage)) {
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
  if (typeof x === 'string') {
    return [x, x];
  }
  if (Array.isArray(x) && x.length === 2) {
    const [from, to] = x;
    if (typeof from === 'string' && typeof to === 'string') {
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
  return array.filter((x, idx, arr) => {
    return arr.findIndex(y => eql(x, y)) === idx;
  });
}

function prepareVolumes(volumes: VolumeOption[] = []): string[] {
  const expanded: (VolumesPair | null)[] = volumes.map(expandVolumeOption);
  const filtered: VolumesPair[] = expanded.filter(vol => vol !== null);
  const unique: VolumesPair[] = uniq<VolumesPair>(filtered, volumesEql);
  return unique.map(([from, to]) => {
    return `-v "${from}":"${to}"`;
  });
}

function prepareCommands(commands: Opt<string>[]): string[] {
  return commands.filter(command => command && typeof command === 'string');
}

async function getDockerTag(
  lookupName: string,
  constraint: string,
  scheme: string
): Promise<string> {
  const { isValid, isVersion, matches, sortVersions } = versioning.get(scheme);

  if (!isValid(constraint)) {
    logger.warn({ constraint }, `Invalid ${scheme} version constraint`);
    return 'latest';
  }

  logger.debug(
    { constraint },
    `Found ${scheme} version constraint - checking for a compatible ${lookupName} image to use`
  );
  const imageReleases = await getPkgReleases({ lookupName });
  if (imageReleases && imageReleases.releases) {
    let versions = imageReleases.releases.map(release => release.version);
    versions = versions.filter(
      version => isVersion(version) && matches(version, constraint)
    );
    versions = versions.sort(sortVersions);
    if (versions.length) {
      const version = versions.pop();
      logger.debug(
        { constraint, version },
        `Found compatible ${scheme} version`
      );
      return version;
    }
  } /* istanbul ignore next */ else {
    logger.error(`No ${lookupName} releases found`);
    return 'latest';
  }
  logger.warn(
    { constraint },
    'Failed to find a tag satisfying ruby constraint, using latest ruby image instead'
  );
  return 'latest';
}

function getContainerName(image: string): string {
  return image.replace(/\//g, '_');
}

export async function removeDockerContainer(image): Promise<void> {
  const containerName = getContainerName(image);
  try {
    const res = await rawExec(
      `docker ps --filter name=${containerName} -aq | xargs --no-run-if-empty docker rm -f`,
      { encoding: 'utf-8' }
    );
    if (res?.stdout?.trim().length) {
      const containerId = res.stdout.trim();
      logger.info(
        { image, containerName, containerId },
        'Finished Docker container removal'
      );
    } else {
      logger.trace({ image, containerName }, 'No running containers to remove');
    }
  } catch (err) /* istanbul ignore next */ {
    logger.trace({ err }, 'removeDockerContainer err');
    logger.info({ image, containerName }, 'Could not remove Docker container');
  }
}

// istanbul ignore next
export async function removeDanglingContainers(): Promise<void> {
  try {
    const res = await rawExec(
      `docker ps --filter label=renovate_child -aq | xargs --no-run-if-empty docker rm -f`,
      { encoding: 'utf-8' }
    );
    if (res?.stdout?.trim().length) {
      const containerIds = res.stdout
        .trim()
        .split('\n')
        .map(container => container.trim())
        .filter(Boolean);
      logger.debug({ containerIds }, 'Removed dangling child containers');
    } else {
      logger.trace('No dangling containers to remove');
    }
  } catch (err) {
    logger.warn({ err }, 'Error removing dangling containers');
  }
}

export async function generateDockerCommand(
  commands: string[],
  options: DockerOptions,
  config: ExecConfig
): Promise<string> {
  const { image, envVars, cwd, tagScheme, tagConstraint } = options;
  const volumes = options.volumes || [];
  const preCommands = options.preCommands || [];
  const postCommands = options.postCommands || [];
  const { localDir, cacheDir, dockerUser } = config;

  const result = ['docker run --rm'];
  const containerName = getContainerName(image);
  result.push(`--name=${containerName}`);
  result.push(`--label=renovate_child`);
  if (dockerUser) {
    result.push(`--user=${dockerUser}`);
  }

  result.push(...prepareVolumes([localDir, cacheDir, ...volumes]));

  if (envVars) {
    result.push(
      ...uniq(envVars)
        .filter(x => typeof x === 'string')
        .map(e => `-e ${e}`)
    );
  }

  if (cwd) {
    result.push(`-w "${cwd}"`);
  }

  let tag;
  if (options.tag) {
    tag = options.tag;
  } else if (tagConstraint) {
    tag = await getDockerTag(image, tagConstraint, tagScheme || 'semver');
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
