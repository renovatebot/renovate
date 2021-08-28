import { parse } from '@iarna/toml';
import * as upath from 'upath';
import {
  id as datasource,
  defaultRegistryUrls,
} from '../../../datasource/maven';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { dependencyPattern } from '../../pip_requirements/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
} from '../../types';
import type { GradleManagerData } from '../types';
import { parseGradle, parseProps } from './parser';
import type { PackageVariables, VariableRegistry } from './types';
import {
  getVars,
  isGradleFile,
  isPropsFile,
  isTOMLFile,
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
  deps: PackageDependency<GradleManagerData>[]
): PackageDependency<GradleManagerData>[] {
  return deps.map((dep) => ({
    ...dep,
    fileReplacePosition: dep?.managerData?.fileReplacePosition,
  }));
}

function findIndexAfter(
  content: string,
  sliceAfter: string,
  find: string
): number {
  return content
    .slice(content.indexOf(sliceAfter) + sliceAfter.length)
    .indexOf(find);
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const extractedDeps: PackageDependency<GradleManagerData>[] = [];
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
      } else if (isTOMLFile(packageFile)) {
        // Implement TOML file parsing and extraction
        const tomlContent = parse(content);
        const versions = tomlContent['versions'];
        const libs = tomlContent['libraries'];
        const libSubContent = content.slice(content.indexOf('libraries'));
        const versionSubContent = content.slice(content.indexOf('versions'));
        for (const libraryName in libs as object) {
          let { group, name, module, version } = libs[libraryName];
          if (name == null || group == null) {
            const split = module.split(':');
            group = split[0];
            name = split[1];
          }
          const currentVersion =
            typeof version == 'string' ? version : versions[version.ref];
          const fileReplacePosition =
            typeof version == 'string'
              ? findIndexAfter(libSubContent, libraryName, currentVersion)
              : findIndexAfter(versionSubContent, version.ref, currentVersion);
          const dependency = {
            depName: `${group}:${name}`,
            groupName: group,
            currentValue: currentVersion,
            managerData: {
              fileReplacePosition: fileReplacePosition,
              packageFile: packageFile,
            },
          };
          console.log(dependency);
          extractedDeps.push(dependency);
        }
      } else if (isGradleFile(packageFile)) {
        const vars = getVars(registry, dir);
        const {
          deps,
          urls,
          vars: gradleVars,
        } = parseGradle(content, vars, packageFile);
        urls.forEach((url) => {
          if (!registryUrls.includes(url)) {
            registryUrls.push(url);
          }
        });
        registry[dir] = { ...registry[dir], ...gradleVars };
        updateVars(gradleVars);
        console.log('ASDSAWD', deps);
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
