import upath from 'upath';
import { logger } from '../../../logger';
import { getLocalFiles } from '../../../util/fs';
import { MavenDatasource } from '../../datasource/maven';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import { parseCatalog } from './extract/catalog';
import {
  isGcvPropsFile,
  parseGcv,
  usesGcv,
} from './extract/consistent-versions-plugin';
import { parseGradle, parseKotlinSource, parseProps } from './parser';
import { REGISTRY_URLS } from './parser/common';
import type {
  GradleManagerData,
  PackageRegistry,
  VariableRegistry,
} from './types';
import {
  getVars,
  isGradleScriptFile,
  isKotlinSourceFile,
  isPropsFile,
  isTOMLFile,
  reorderFiles,
  toAbsolutePath,
  updateVars,
} from './utils';

const mavenDatasource = MavenDatasource.id;

function updatePackageRegistries(
  packageRegistries: PackageRegistry[],
  urls: PackageRegistry[],
): void {
  for (const url of urls) {
    const registryAlreadyKnown = packageRegistries.some(
      (item) =>
        item.registryUrl === url.registryUrl && item.scope === url.scope,
    );
    if (!registryAlreadyKnown) {
      packageRegistries.push(url);
    }
  }
}

function getRegistryUrlsForDep(
  packageRegistries: PackageRegistry[],
  dep: PackageDependency<GradleManagerData>,
): string[] {
  const scope = dep.depType === 'plugin' ? 'plugin' : 'dep';

  const registryUrls = packageRegistries
    .filter((item) => item.scope === scope)
    .map((item) => item.registryUrl);

  if (!registryUrls.length && scope === 'plugin') {
    registryUrls.push(REGISTRY_URLS.gradlePluginPortal);
  }

  return [...new Set(registryUrls)];
}

async function parsePackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
  extractedDeps: PackageDependency<GradleManagerData>[],
  packageFilesByName: Record<string, PackageFile>,
  packageRegistries: PackageRegistry[],
): Promise<PackageDependency<GradleManagerData>[]> {
  const varRegistry: VariableRegistry = {};
  const fileContents = await getLocalFiles(packageFiles);

  for (const packageFile of packageFiles) {
    packageFilesByName[packageFile] = {
      packageFile,
      datasource: mavenDatasource,
      deps: [],
    };

    try {
      // TODO #22198
      const content = fileContents[packageFile]!;
      const packageFileDir = upath.dirname(toAbsolutePath(packageFile));

      if (isPropsFile(packageFile)) {
        const { vars, deps } = parseProps(content, packageFile);
        updateVars(varRegistry, packageFileDir, vars);
        extractedDeps.push(...deps);
      } else if (isTOMLFile(packageFile)) {
        const deps = parseCatalog(packageFile, content);
        extractedDeps.push(...deps);
      } else if (
        isGcvPropsFile(packageFile) &&
        usesGcv(packageFile, fileContents)
      ) {
        const deps = parseGcv(packageFile, fileContents);
        extractedDeps.push(...deps);
      } else if (isKotlinSourceFile(packageFile)) {
        const vars = getVars(varRegistry, packageFileDir);
        const { vars: gradleVars, deps } = parseKotlinSource(
          content,
          vars,
          packageFile,
        );
        updateVars(varRegistry, '/', gradleVars);
        extractedDeps.push(...deps);
      } else if (isGradleScriptFile(packageFile)) {
        const vars = getVars(varRegistry, packageFileDir);
        const {
          deps,
          urls,
          vars: gradleVars,
        } = parseGradle(content, vars, packageFile, fileContents);
        updatePackageRegistries(packageRegistries, urls);
        updateVars(varRegistry, packageFileDir, gradleVars);
        extractedDeps.push(...deps);
      }
    } catch (err) {
      logger.debug(
        { err, config, packageFile },
        `Failed to process Gradle file`,
      );
    }
  }

  return extractedDeps;
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const packageFilesByName: Record<string, PackageFile> = {};
  const packageRegistries: PackageRegistry[] = [];
  const extractedDeps: PackageDependency<GradleManagerData>[] = [];
  const kotlinSourceFiles = packageFiles.filter(isKotlinSourceFile);
  const gradleFiles = reorderFiles(
    packageFiles.filter((e) => !kotlinSourceFiles.includes(e)),
  );

  await parsePackageFiles(
    config,
    [...kotlinSourceFiles, ...kotlinSourceFiles, ...gradleFiles],
    extractedDeps,
    packageFilesByName,
    packageRegistries,
  );

  if (!extractedDeps.length) {
    return null;
  }

  for (const dep of extractedDeps) {
    dep.fileReplacePosition = dep?.managerData?.fileReplacePosition; // #8224

    const key = dep.managerData?.packageFile;
    // istanbul ignore else
    if (key) {
      let pkgFile: PackageFile = packageFilesByName[key];
      // istanbul ignore if: won't happen if "apply from" processes only initially known files
      if (!pkgFile) {
        pkgFile = {
          packageFile: key,
          datasource: mavenDatasource,
          deps: [],
        };
      }

      if (!dep.datasource) {
        dep.datasource = mavenDatasource;
      }

      if (dep.datasource === mavenDatasource) {
        dep.registryUrls = getRegistryUrlsForDep(packageRegistries, dep);

        if (!dep.depType) {
          dep.depType =
            key.startsWith('buildSrc') && !kotlinSourceFiles.length
              ? 'devDependencies'
              : 'dependencies';
        }
      }

      const depAlreadyInPkgFile = pkgFile.deps.some(
        (item) =>
          item.depName === dep.depName &&
          item.managerData?.fileReplacePosition ===
            dep.managerData?.fileReplacePosition,
      );
      if (!depAlreadyInPkgFile) {
        pkgFile.deps.push(dep);
      }

      packageFilesByName[key] = pkgFile;
    } else {
      logger.debug({ dep }, `Failed to process Gradle dependency`);
    }
  }

  return Object.values(packageFilesByName);
}
