import * as path from 'path';
import { safeLoad } from 'js-yaml';

import { id as gitTagDatasource } from '../../datasource/git-tags';
import { logger } from '../../logger';
import { readLocalFile } from '../../util/fs';
import { id as dockerVersioning } from '../../versioning/docker';
import { id as semverVersioning } from '../../versioning/semver';
import { ExtractConfig, PackageDependency, PackageFile } from '../common';
import { getDep } from '../dockerfile/extract';
import { BatectConfig, BatectFileInclude, BatectGitInclude } from './types';

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

function extractReferencedConfigFiles(
  config: BatectConfig,
  fileName: string
): string[] {
  if (config.include === undefined) {
    return [];
  }

  const dirName = path.dirname(fileName);

  const paths = [
    ...config.include.filter(
      (include): include is string => typeof include === 'string'
    ),
    ...config.include
      .filter(
        (include): include is BatectFileInclude =>
          typeof include === 'object' && include.type === 'file'
      )
      .map((include) => include.path),
  ].filter((p) => p !== undefined && p !== null);

  return paths.map((p) => path.join(dirName, p));
}

interface ExtractionResult {
  deps: PackageDependency[];
  referencedConfigFiles: string[];
}

function extractPackageFile(
  content: string,
  fileName: string
): ExtractionResult | null {
  logger.debug({ fileName }, 'batect.extractPackageFile()');

  try {
    const config = loadConfig(content);
    const deps = [
      ...extractImageDependencies(config),
      ...extractBundleDependencies(config),
    ];

    const referencedConfigFiles = extractReferencedConfigFiles(
      config,
      fileName
    );

    return { deps, referencedConfigFiles };
  } catch (err) {
    logger.warn(
      { err, fileName },
      'Extracting dependencies from Batect configuration file failed'
    );

    return null;
  }
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const filesToExamine = [...packageFiles];
  const filesAlreadyExamined = [];
  const results: PackageFile[] = [];

  while (filesToExamine.length > 0) {
    const packageFile = filesToExamine.pop();
    filesAlreadyExamined.push(packageFile);

    const content = await readLocalFile(packageFile, 'utf8');
    const result = extractPackageFile(content, packageFile);

    if (result !== null) {
      result.referencedConfigFiles.forEach((f) => {
        if (
          filesAlreadyExamined.indexOf(f) === -1 &&
          filesToExamine.indexOf(f) === -1
        ) {
          filesToExamine.push(f);
        }
      });

      results.push({
        manager: 'batect',
        packageFile,
        deps: result.deps,
      });
    }
  }

  return results;
}
