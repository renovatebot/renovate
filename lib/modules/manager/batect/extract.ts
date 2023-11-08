import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import upath from 'upath';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { id as dockerVersioning } from '../../versioning/docker';
import { id as semverVersioning } from '../../versioning/semver';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type {
  BatectConfig,
  BatectFileInclude,
  BatectGitInclude,
  BatectInclude,
  ExtractionResult,
} from './types';

function loadConfig(content: string): BatectConfig {
  const config = load(content);

  if (typeof config !== 'object') {
    throw new Error(
      `Configuration file does not contain a YAML object (it is ${typeof config}).`,
    );
  }

  return config as BatectConfig;
}

function extractImages(config: BatectConfig): string[] {
  if (config.containers === undefined) {
    return [];
  }

  return Object.values(config.containers)
    .map((container) => container.image)
    .filter(is.string);
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

function includeIsGitInclude(
  include: BatectInclude,
): include is BatectGitInclude {
  return typeof include === 'object' && include.type === 'git';
}

function extractGitBundles(config: BatectConfig): BatectGitInclude[] {
  if (config.include === undefined) {
    return [];
  }

  return config.include.filter(includeIsGitInclude);
}

function createBundleDependency(bundle: BatectGitInclude): PackageDependency {
  return {
    depName: bundle.repo,
    currentValue: bundle.ref,
    versioning: semverVersioning,
    datasource: GitTagsDatasource.id,
    commitMessageTopic: 'bundle {{depName}}',
  };
}

function extractBundleDependencies(config: BatectConfig): PackageDependency[] {
  const bundles = extractGitBundles(config);
  const deps = bundles.map((bundle) => createBundleDependency(bundle));

  logger.trace({ deps }, 'Loaded bundles from Batect configuration file');

  return deps;
}

function includeIsStringFileInclude(include: BatectInclude): include is string {
  return typeof include === 'string';
}

function includeIsObjectFileInclude(
  include: BatectInclude,
): include is BatectFileInclude {
  return typeof include === 'object' && include.type === 'file';
}

function extractReferencedConfigFiles(
  config: BatectConfig,
  fileName: string,
): string[] {
  if (config.include === undefined) {
    return [];
  }

  const dirName = upath.dirname(fileName);

  const paths = [
    ...config.include.filter(includeIsStringFileInclude),
    ...config.include
      .filter(includeIsObjectFileInclude)
      .map((include) => include.path),
  ].filter((p) => p !== undefined && p !== null);

  return paths.map((p) => upath.join(dirName, p));
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): ExtractionResult | null {
  logger.trace(`batect.extractPackageFile(${packageFile})`);

  try {
    const config = loadConfig(content);
    const deps = [
      ...extractImageDependencies(config),
      ...extractBundleDependencies(config),
    ];

    const referencedConfigFiles = extractReferencedConfigFiles(
      config,
      packageFile,
    );

    return { deps, referencedConfigFiles };
  } catch (err) {
    logger.debug(
      { err, packageFile },
      'Extracting dependencies from Batect configuration file failed',
    );

    return null;
  }
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const filesToExamine = new Set<string>(packageFiles);
  const filesAlreadyExamined = new Set<string>();
  const results: PackageFile[] = [];

  while (filesToExamine.size > 0) {
    const packageFile = filesToExamine.values().next().value;
    filesToExamine.delete(packageFile);
    filesAlreadyExamined.add(packageFile);

    const content = await readLocalFile(packageFile, 'utf8');
    // TODO #22198
    const result = extractPackageFile(content!, packageFile);

    if (result !== null) {
      result.referencedConfigFiles.forEach((f) => {
        if (!filesAlreadyExamined.has(f) && !filesToExamine.has(f)) {
          filesToExamine.add(f);
        }
      });

      results.push({
        packageFile,
        deps: result.deps,
      });
    }
  }

  return results;
}
