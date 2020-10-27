import * as upath from 'upath';
import * as datasourceMaven from '../../datasource/maven';
import { logger } from '../../logger';
import { readLocalFile } from '../../util/fs';
import { ExtractConfig, PackageDependency, PackageFile } from '../common';
import { ManagerData, VariableRegistry } from './common';
import { parseGradle, parseProps } from './parser';
import {
  getVars,
  isGradleFile,
  isPropsFile,
  reorderFiles,
  toAbsolutePath,
} from './utils';

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
      datasource: datasourceMaven.id,
      deps: [],
    };

    try {
      const content = await readLocalFile(packageFile, 'utf8');
      const dir = upath.dirname(toAbsolutePath(packageFile));
      if (isPropsFile(packageFile)) {
        const { vars, deps } = parseProps(content, packageFile);
        registry[dir] = vars;
        extractedDeps.push(...deps);
      } else if (isGradleFile(packageFile)) {
        const vars = getVars(registry, dir);
        const { deps, urls } = parseGradle(content, vars, packageFile);
        urls.forEach((url) => {
          if (!registryUrls.includes(url)) {
            registryUrls.push(url);
          }
        });
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

  extractedDeps.forEach((dep) => {
    const key = dep.managerData.packageFile;
    const pkgFile: PackageFile = packageFilesByName[key];
    const { deps } = pkgFile;
    deps.push({
      ...dep,
      registryUrls: [...(dep.registryUrls || []), ...registryUrls],
    });
    packageFilesByName[key] = pkgFile;
  });

  return Object.values(packageFilesByName);
}
