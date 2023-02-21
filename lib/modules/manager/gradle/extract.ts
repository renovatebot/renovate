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
import { parseGradle, parseProps } from './parser';
import { REGISTRY_URLS } from './parser/common';
import type {
  GradleManagerData,
  PackageRegistry,
  PackageVariables,
  VariableRegistry,
} from './types';
import {
  getVars,
  isGradleScriptFile,
  isPropsFile,
  isTOMLFile,
  reorderFiles,
  toAbsolutePath,
} from './utils';

const mavenDatasource = MavenDatasource.id;

function getRegistryUrlsForDep(
  packageRegistries: PackageRegistry[],
  dep: PackageDependency<GradleManagerData>
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

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const extractedDeps: PackageDependency<GradleManagerData>[] = [];
  const varRegistry: VariableRegistry = {};
  const packageFilesByName: Record<string, PackageFile> = {};
  const packageRegistries: PackageRegistry[] = [];
  const reorderedFiles = reorderFiles(packageFiles);
  const fileContents = await getLocalFiles(packageFiles);

  for (const packageFile of reorderedFiles) {
    packageFilesByName[packageFile] = {
      packageFile,
      datasource: mavenDatasource,
      deps: [],
    };

    try {
      // TODO #7154
      const content = fileContents[packageFile]!;
      const packageFileDir = upath.dirname(toAbsolutePath(packageFile));

      const updateVars = (newVars: PackageVariables): void => {
        const oldVars = varRegistry[packageFileDir] || {};
        varRegistry[packageFileDir] = { ...oldVars, ...newVars };
      };

      if (isPropsFile(packageFile)) {
        const { vars, deps } = parseProps(content, packageFile);
        updateVars(vars);
        extractedDeps.push(...deps);
      } else if (isTOMLFile(packageFile)) {
        const updatesFromCatalog = parseCatalog(packageFile, content);
        extractedDeps.push(...updatesFromCatalog);
      } else if (
        isGcvPropsFile(packageFile) &&
        usesGcv(packageFile, fileContents)
      ) {
        const updatesFromGcv = parseGcv(packageFile, fileContents);
        extractedDeps.push(...updatesFromGcv);
      } else if (isGradleScriptFile(packageFile)) {
        const vars = getVars(varRegistry, packageFileDir);
        const {
          deps,
          urls,
          vars: gradleVars,
        } = parseGradle(content, vars, packageFile, fileContents);
        for (const url of urls) {
          const registryAlreadyKnown = packageRegistries.some(
            (item) =>
              item.registryUrl === url.registryUrl && item.scope === url.scope
          );
          if (!registryAlreadyKnown) {
            packageRegistries.push(url);
          }
        }
        varRegistry[packageFileDir] = {
          ...varRegistry[packageFileDir],
          ...gradleVars,
        };
        updateVars(gradleVars);
        extractedDeps.push(...deps);
      }
    } catch (err) {
      logger.warn(
        { err, config, packageFile },
        `Failed to process Gradle file`
      );
    }
  }

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
          dep.depType = key.startsWith('buildSrc')
            ? 'devDependencies'
            : 'dependencies';
        }
      }

      const depAlreadyInPkgFile = pkgFile.deps.some(
        (item) =>
          item.depName === dep.depName &&
          item.managerData?.fileReplacePosition ===
            dep.managerData?.fileReplacePosition
      );
      if (!depAlreadyInPkgFile) {
        pkgFile.deps.push(dep);
      }

      packageFilesByName[key] = pkgFile;
    } else {
      logger.warn({ dep }, `Failed to process Gradle dependency`);
    }
  }

  return Object.values(packageFilesByName);
}
