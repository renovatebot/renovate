import upath from 'upath';
import { logger } from '../../../logger';
import { getFileContentMap } from '../../../util/fs';
import { MavenDatasource } from '../../datasource/maven';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import { parseCatalog } from './extract/catalog';
import {
  isGcvPropsFile,
  parseGcv,
  usesGcv,
} from './extract/consistent-versions-plugin';
import { parseGradle, parseProps } from './parser';
import type {
  GradleManagerData,
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

const datasource = MavenDatasource.id;

// Enables reverse sorting in generateBranchConfig()
//
// Required for grouped dependencies to be upgraded
// correctly in single branch.
//
// https://github.com/renovatebot/renovate/issues/8224
function elevateFileReplacePositionField(
  deps: PackageDependency<GradleManagerData>[]
): PackageDependency<GradleManagerData>[] {
  return deps.map((dep) => ({
    ...dep,
    fileReplacePosition: dep?.managerData?.fileReplacePosition,
  }));
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const extractedDeps: PackageDependency<GradleManagerData>[] = [];
  const registry: VariableRegistry = {};
  const packageFilesByName: Record<string, PackageFile> = {};
  const registryUrls: string[] = [];
  const reorderedFiles = reorderFiles(packageFiles);
  const fileContents = await getFileContentMap(packageFiles, true);

  for (const packageFile of reorderedFiles) {
    packageFilesByName[packageFile] = {
      packageFile,
      datasource,
      deps: [],
    };

    try {
      // TODO #7154
      const content = fileContents[packageFile]!;
      const dir = upath.dirname(toAbsolutePath(packageFile));

      const updateVars = (newVars: PackageVariables): void => {
        const oldVars = registry[dir] || {};
        registry[dir] = { ...oldVars, ...newVars };
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
        const vars = getVars(registry, dir);
        const {
          deps,
          urls,
          vars: gradleVars,
        } = parseGradle(content, vars, packageFile, fileContents);
        urls.forEach((url) => {
          if (!registryUrls.includes(url)) {
            registryUrls.push(url);
          }
        });
        registry[dir] = { ...registry[dir], ...gradleVars };
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

  elevateFileReplacePositionField(extractedDeps).forEach((dep) => {
    const key = dep.managerData?.packageFile;
    // istanbul ignore else
    if (key) {
      let pkgFile = packageFilesByName[key];
      // istanbul ignore if: won't happen if "apply from" processes only initially known files
      if (!pkgFile) {
        pkgFile = {
          packageFile: key,
          datasource,
          deps: [],
        } as PackageFile;
      }

      dep.registryUrls = [
        ...new Set([...registryUrls, ...(dep.registryUrls ?? [])]),
      ];

      if (!dep.depType) {
        dep.depType = key.startsWith('buildSrc')
          ? 'devDependencies'
          : 'dependencies';
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
  });

  const result = Object.values(packageFilesByName);
  return result;
}
