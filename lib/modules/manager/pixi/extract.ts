import is from '@sindresorhus/is';
import { z } from 'zod';

import { logger } from '../../../logger';
import { getSiblingFileName, localPathExists } from '../../../util/fs';
import { Result } from '../../../util/result';
import { Toml } from '../../../util/schema-utils';
import { ensureTrailingSlash } from '../../../util/url';
import { defaultRegistryUrl as defaultCondaRegistryAPi } from '../../datasource/conda/common';
import { PyProjectSchema } from '../pep621/schema';
import type { ExtractConfig, PackageFileContent } from '../types';
import {
  type Channels,
  type PixiConfig,
  type PixiPackageDependency,
  PixiToml,
} from './schema';

const PyProjectToml = Toml.pipe(PyProjectSchema);

function getUserPixiConfig(
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
  config: ExtractConfig = {},
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
  const channels: Channels = structuredClone(project.channels);
  // resolve channels and build registry urls for each channel with order
  const conda: PixiPackageDependency[] = [];

  // Process val.conda items
  for (const item of val.conda) {
    conda.push({ ...item, channels } satisfies PixiPackageDependency);
  }

  // Process val.feature.conda items
  for (const item of val.feature.conda) {
    conda.push({
      ...item,
      channels: [...(item.channels ?? []), ...project.channels],
    });
  }

  // Process each item to add registryUrls or skipReason
  for (let i = 0; i < conda.length; i++) {
    const item = conda[i];
    const channels = orderChannels(item.channels);

    if (item.channel) {
      conda[i] = {
        ...item,
        channels,
        registryUrls: [
          channelToRegistryUrl(item.channel, config.registryAliases),
        ],
      };
      continue;
    }

    if (channels.length === 0) {
      conda[i] = {
        ...item,
        channels,
        skipStage: 'extract',
        skipReason: 'unknown-registry',
      };
      continue;
    }

    const registryUrls: string[] = [];
    for (const channel of channels) {
      registryUrls.push(channelToRegistryUrl(channel, config.registryAliases));
    }

    conda[i] = {
      ...item,
      channels,
      registryUrls,
    } satisfies PixiPackageDependency;
  }

  return {
    lockFiles,
    deps: [...conda, ...val.pypi, ...val.feature.pypi],
  };
}

function channelToRegistryUrl(
  channel: string,
  aliasConfig?: Record<string, string>,
): string {
  // help to alias mirror url to anaconda repo
  const alias = aliasConfig?.[channel] ?? channel;
  if (looksLikeUrl(alias)) {
    return ensureTrailingSlash(alias);
  }

  return `${defaultCondaRegistryAPi}${alias}/`;
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

function looksLikeUrl(s: string): boolean {
  return s.startsWith('https://') || s.startsWith('http://');
}
