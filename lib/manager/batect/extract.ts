import { safeLoad } from 'js-yaml';

import { id as gitTagDatasource } from '../../datasource/git-tags';
import { logger } from '../../logger';
import { id as dockerVersioning } from '../../versioning/docker';
import { id as semverVersioning } from '../../versioning/semver';
import { PackageDependency, PackageFile } from '../common';
import { getDep } from '../dockerfile/extract';
import { BatectConfig, BatectGitInclude } from './types';

function loadConfig(content: string): BatectConfig {
  const config = safeLoad(content);

  if (typeof config !== 'object') {
    throw new Error(
      `Configuration file does not contain a YAML object (it is ${typeof config}).`
    );
  }

  return config as BatectConfig;
}

function extractImages(config: BatectConfig): string[] {
  if (config.containers === undefined) {
    return [];
  }

  return Object.values(config.containers)
    .filter((container) => container.image !== undefined)
    .map((container) => container.image);
}

function createImageDependency(tag: string): PackageDependency {
  return {
    ...getDep(tag),
    versioning: dockerVersioning,
  };
}

function extractImageDependencies(config: BatectConfig): PackageDependency[] {
  const images = extractImages(config);
  const deps = images.map((image) => createImageDependency(image));

  logger.trace({ deps }, 'Loaded images from Batect configuration file');

  return deps;
}

function extractGitBundles(config: BatectConfig): BatectGitInclude[] {
  if (config.include === undefined) {
    return [];
  }

  return config.include.filter(
    (include): include is BatectGitInclude =>
      typeof include === 'object' && include.type === 'git'
  );
}

function createBundleDependency(bundle: BatectGitInclude): PackageDependency {
  return {
    depName: bundle.repo,
    currentValue: bundle.ref,
    versioning: semverVersioning,
    datasource: gitTagDatasource,
    commitMessageTopic: 'bundle {{depName}}',
  };
}

function extractBundleDependencies(config: BatectConfig): PackageDependency[] {
  const bundles = extractGitBundles(config);
  const deps = bundles.map((bundle) => createBundleDependency(bundle));

  logger.trace({ deps }, 'Loaded bundles from Batect configuration file');

  return deps;
}

export function extractPackageFile(
  content: string,
  fileName?: string
): PackageFile | null {
  logger.debug({ fileName }, 'batect.extractPackageFile()');

  try {
    const config = loadConfig(content);
    const deps = [
      ...extractImageDependencies(config),
      ...extractBundleDependencies(config),
    ];

    if (deps.length === 0) {
      return null;
    }

    return { deps };
  } catch (err) {
    logger.warn(
      { err, fileName },
      'Extracting dependencies from Batect configuration file failed'
    );

    return null;
  }
}
