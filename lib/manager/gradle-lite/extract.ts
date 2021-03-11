import * as upath from 'upath';
import { id as datasource, defaultRegistryUrls } from '../../datasource/maven';
import { logger } from '../../logger';
import { readLocalFile } from '../../util/fs';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { ManagerData, PackageVariables, VariableRegistry } from './common';
import { parseGradle, parseProps } from './parser';
import {
  getVars,
  isGradleFile,
  isPropsFile,
  reorderFiles,
  toAbsolutePath,
} from './utils';

// Enables reverse sorting in generateBranchConfig()
//
// Required for grouped dependencies to be upgraded
// correctly in single branch.
//
// https://github.com/renovatebot/renovate/issues/8224
function elevateFileReplacePositionField(
  deps: PackageDependency<ManagerData>[]
): PackageDependency<ManagerData>[] {
  return deps.map((dep) => ({
    ...dep,
    fileReplacePosition: dep?.managerData?.fileReplacePosition,
  }));
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const extractedDeps: PackageDependency<ManagerData>[] = [];
  const registry: VariableRegistry = {};
  const packageFilesByName: Record<string, PackageFile> = {};
  const registryUrls = [];
  for (const packageFile of reorderFiles(packageFiles)) {
    packageFilesByName[packageFile] = {
      packageFile,
      datasource,
      deps: [],
    };

    try {
      const content = await readLocalFile(packageFile, 'utf8');
      const dir = upath.dirname(toAbsolutePath(packageFile));

      const updateVars = (newVars: PackageVariables): void => {
        const oldVars = registry[dir] || {};
        registry[dir] = { ...oldVars, ...newVars };
      };

      if (isPropsFile(packageFile)) {
        const { vars, deps } = parseProps(content, packageFile);
        updateVars(vars);
        extractedDeps.push(...deps);
      } else if (isGradleFile(packageFile)) {
        const vars = getVars(registry, dir);
        const { deps, urls, vars: gradleVars } = parseGradle(
          content,
          vars,
          packageFile
        );
        urls.forEach((url) => {
          if (!registryUrls.includes(url)) {
            registryUrls.push(url);
          }
        });
        registry[dir] = { ...registry[dir], ...gradleVars };
        updateVars(gradleVars);
        extractedDeps.push(...deps);
      }
    } catch (e) {
      logger.warn(
        { config, packageFile },
        `Failed to process Gradle file: ${packageFile}`
      );
    }
  }

  if (!extractedDeps.length) {
    return null;
  }

  elevateFileReplacePositionField(extractedDeps).forEach((dep) => {
    const key = dep.managerData.packageFile;
    const pkgFile: PackageFile = packageFilesByName[key];
    const { deps } = pkgFile;
    deps.push({
      ...dep,
      registryUrls: [
        ...new Set([
          ...defaultRegistryUrls,
          ...(dep.registryUrls || []),
          ...registryUrls,
        ]),
      ],
    });
    packageFilesByName[key] = pkgFile;
  });

  return Object.values(packageFilesByName);
}
