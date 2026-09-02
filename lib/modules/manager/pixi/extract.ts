import { isString } from '@sindresorhus/is';
import { z } from 'zod/v4';

import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { getSiblingFileName, localPathExists } from '../../../util/fs/index.ts';
import { Result } from '../../../util/result.ts';
import {
  ensureTrailingSlash,
  isHttpUrl,
  joinUrlParts,
  trimTrailingSlash,
} from '../../../util/url.ts';
import {
  defaultRegistryUrl as defaultCondaRegistryApi,
  isPrefixDevUrl,
  platformsParam,
} from '../../datasource/conda/common.ts';
import type { RegistryStrategy } from '../../datasource/index.ts';
import type { PackageFileContent } from '../types.ts';
import {
  type Channels,
  type PixiConfig,
  PixiFile,
  type PixiPackageDependency,
  PixiPyProject,
} from './schema.ts';

export function getUserPixiConfig(
  content: string,
  packageFile: string,
): null | PixiConfig {
  if (
    packageFile === 'pyproject.toml' ||
    packageFile.endsWith('/pyproject.toml')
  ) {
    const { val, err } = Result.parse(content, PixiPyProject).unwrap();
    if (err) {
      logger.debug({ packageFile, err }, `error parsing ${packageFile}`);
      return null;
    }

    return val.tool?.pixi ?? null;
  }

  if (packageFile === 'pixi.toml' || packageFile.endsWith('/pixi.toml')) {
    const { val, err } = Result.parse(content, PixiFile).unwrap();
    if (err) {
      logger.debug({ packageFile, err }, `error parsing ${packageFile}`);
      return null;
    }

    return val;
  }

  const { val, err } = Result.parse(
    content,
    z.union([PixiFile, PixiPyProject.transform((p) => p.tool?.pixi)]),
  ).unwrap();

  if (err) {
    logger.debug({ packageFile, err }, `error parsing ${packageFile}`);
    return null;
  }
  return val ?? null;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.trace(`pixi.extractPackageFile(${packageFile})`);

  const val = getUserPixiConfig(content, packageFile);
  if (!val) {
    return null;
  }

  const lockfileName = getSiblingFileName(packageFile, 'pixi.lock');
  const lockFiles: string[] = [];
  if (await localPathExists(lockfileName)) {
    lockFiles.push(lockfileName);
  }

  const project = val.project;

  const channelPriority = project['channel-priority'];

  let registryStrategy: RegistryStrategy | undefined;

  if (channelPriority === 'disabled') {
    registryStrategy = 'merge';
  }

  // resolve channels and build registry urls for each channel with order
  const conda: PixiPackageDependency[] = [];

  for (const item of val.conda) {
    conda.push(
      addRegistryUrls(
        {
          ...item,
          channels: project.channels,
          registryStrategy,
        },
        project.platforms,
      ),
    );
  }

  for (const item of val.feature.conda) {
    conda.push(
      addRegistryUrls(
        {
          ...item,
          registryStrategy,
          channels: [...coerceArray(item.channels), ...project.channels],
        },
        project.platforms,
      ),
    );
  }

  return {
    lockFiles,
    deps: [conda, val.pypi, val.feature.pypi].flat(),
  };
}

function addRegistryUrls(
  item: PixiPackageDependency,
  platforms: string[],
): PixiPackageDependency {
  const channels = orderChannels(item.channels);

  if (item.channel) {
    return {
      ...item,
      channels,
      registryUrls: [channelToRegistryUrl(item.channel, platforms)],
    };
  }

  if (channels.length === 0) {
    return {
      ...item,
      channels,
      skipStage: 'extract',
      skipReason: 'unknown-registry',
    };
  }

  return {
    ...item,
    channels,
    registryUrls: channels.map((channel) =>
      channelToRegistryUrl(channel, platforms),
    ),
  };
}

/**
 * Resolves a pixi channel to the registry URL the conda datasource should query.
 *
 * A bare channel name (e.g. `conda-forge`) maps to the Anaconda.org REST API.
 * A full URL is a standard conda channel, whose packages live under one subdir
 * per platform plus `noarch`. Those subdirs are reconciled by the datasource
 * rather than expanded into separate registry URLs here, because a version is
 * only usable when it is installable on every platform the workspace targets -
 * an intersection that no `registryStrategy` can express. So the channel URL
 * carries the platforms and stays a single registry URL.
 */
function channelToRegistryUrl(channel: string, platforms: string[]): string {
  if (!isHttpUrl(channel)) {
    return ensureTrailingSlash(joinUrlParts(defaultCondaRegistryApi, channel));
  }

  // prefix.dev channels are resolved through its own API by the conda
  // datasource, so they carry no subdirs to reconcile
  if (isPrefixDevUrl(channel)) {
    return ensureTrailingSlash(channel);
  }

  if (!platforms.length) {
    logger.once.warn(
      { channel },
      'pixi: workspace declares no platforms, so full-URL conda channels are only searched for `noarch` packages',
    );
  }

  return `${trimTrailingSlash(channel)}?${platformsParam}=${platforms.join(',')}`;
}

function orderChannels(channels: Channels = []): string[] {
  return channels
    .map((channel, index) => {
      if (isString(channel)) {
        return { channel, priority: 0, index };
      }

      return { ...channel, index: 0 };
    })
    .toSorted((a, b) => {
      // first based on priority then based on index
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      return a.index - b.index;
    })
    .map((c) => c.channel);
}
