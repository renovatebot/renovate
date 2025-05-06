import is from '@sindresorhus/is';
import { z } from 'zod';

import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { getSiblingFileName, localPathExists } from '../../../util/fs';
import { Result } from '../../../util/result';
import { Toml } from '../../../util/schema-utils';
import {
  ensureTrailingSlash,
  isHttpUrl,
  joinUrlParts,
} from '../../../util/url';
import type { RegistryStrategy } from '../../datasource';
import { defaultRegistryUrl as defaultCondaRegistryApi } from '../../datasource/conda/common';
import { PyProjectSchema } from '../pep621/schema';
import type { PackageFileContent } from '../types';
import {
  type Channels,
  type PixiConfig,
  type PixiPackageDependency,
  PixiToml,
} from './schema';

const PyProjectToml = Toml.pipe(PyProjectSchema);

export function getUserPixiConfig(
  content: string,
  packageFile: string,
): null | PixiConfig {
  if (
    packageFile === 'pyproject.toml' ||
    packageFile.endsWith('/pyproject.toml')
  ) {
    const { val, err } = Result.parse(content, PyProjectToml).unwrap();
    if (err) {
      logger.debug({ packageFile, err }, `error parsing ${packageFile}`);
      return null;
    }

    return val.tool?.pixi ?? null;
  }

  if (packageFile === 'pixi.toml' || packageFile.endsWith('/pixi.toml')) {
    const { val, err } = Result.parse(content, PixiToml).unwrap();
    if (err) {
      logger.debug({ packageFile, err }, `error parsing ${packageFile}`);
      return null;
    }

    return val;
  }

  const { val, err } = Result.parse(
    content,
    z.union([PixiToml, PyProjectToml.transform((p) => p.tool?.pixi)]),
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
      addRegistryUrls({
        ...item,
        channels: project.channels,
        registryStrategy,
      }),
    );
  }

  for (const item of val.feature.conda) {
    conda.push(
      addRegistryUrls({
        ...item,
        registryStrategy,
        channels: [...coerceArray(item.channels), ...project.channels],
      }),
    );
  }

  return {
    lockFiles,
    deps: [conda, val.pypi, val.feature.pypi].flat(),
  };
}

function addRegistryUrls(item: PixiPackageDependency): PixiPackageDependency {
  const channels = orderChannels(item.channels);

  if (item.channel) {
    return {
      ...item,
      channels,
      registryUrls: [channelToRegistryUrl(item.channel)],
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

  const registryUrls: string[] = [];
  for (const channel of channels) {
    registryUrls.push(channelToRegistryUrl(channel));
  }

  return {
    ...item,
    channels,
    registryUrls,
  };
}

function channelToRegistryUrl(channel: string): string {
  if (isHttpUrl(channel)) {
    return ensureTrailingSlash(channel);
  }

  return ensureTrailingSlash(joinUrlParts(defaultCondaRegistryApi, channel));
}

function orderChannels(channels: Channels = []): string[] {
  return channels
    .map((channel, index) => {
      if (is.string(channel)) {
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
