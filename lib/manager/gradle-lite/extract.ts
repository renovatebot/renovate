import * as upath from 'upath';
import * as datasourceMaven from '../../datasource/maven';
import { readLocalFile } from '../../util/fs';
import { ExtractConfig, PackageDependency, PackageFile } from '../common';
import { ManagerData, PackageVariables } from './common';
import { parseGradle, parseProps } from './parser';

function isGradle(path: string): boolean {
  const filename = upath.basename(path).toLowerCase();
  return filename.endsWith('.gradle') || filename.endsWith('.gradle.kts');
}

function isProps(path: string): boolean {
  const filename = upath.basename(path).toLowerCase();
  return filename === 'gradle.properties';
}

function toAbsolute(packageFile: string): string {
  return upath.join(packageFile.replace(/^[/\\]*/, '/'));
}

export function reorderFiles(packageFiles: string[]): string[] {
  return packageFiles.sort((x, y) => {
    const xAbs = toAbsolute(x);
    const yAbs = toAbsolute(y);

    const xDir = upath.dirname(xAbs);
    const yDir = upath.dirname(yAbs);

    if (xDir === yDir) {
      if (
        (isGradle(xAbs) && isGradle(yAbs)) ||
        (isProps(xAbs) && isProps(yAbs))
      ) {
        if (xAbs > yAbs) {
          return 1;
        }
        if (xAbs < yAbs) {
          return -1;
        }
      } else if (isGradle(xAbs)) {
        return 1;
      } else if (isGradle(yAbs)) {
        return -1;
      }
    } else if (xDir.startsWith(yDir)) {
      return 1;
    } else if (yDir.startsWith(xDir)) {
      return -1;
    }

    return 0;
  });
}

type VariableRegistry = Record<string, PackageVariables>;

function getVars(
  registry: VariableRegistry,
  dir: string,
  vars: PackageVariables = registry[dir] || {}
): PackageVariables {
  const parentDir = upath.dirname(dir);
  if (parentDir === dir) {
    return vars;
  }
  const parentVars = registry[parentDir] || {};
  return getVars(registry, parentDir, { ...parentVars, ...vars });
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const extractedDeps: PackageDependency<ManagerData>[] = [];
  const registry: VariableRegistry = {};
  const packageFilesByName: Record<string, PackageFile> = {};
  for (const packageFile of reorderFiles(packageFiles)) {
    packageFilesByName[packageFile] = {
      packageFile,
      datasource: datasourceMaven.id,
      deps: [],
    };

    const content = await readLocalFile(packageFile, 'utf8');
    const dir = upath.dirname(toAbsolute(packageFile));
    if (isProps(packageFile)) {
      const { vars, deps } = parseProps(content, packageFile);
      registry[dir] = vars;
      extractedDeps.push(...deps);
    } else if (isGradle(packageFile)) {
      const vars = getVars(registry, dir);
      const deps = parseGradle(content, vars, packageFile);
      extractedDeps.push(...deps);
    }
  }

  if (!extractedDeps.length) {
    return null;
  }

  extractedDeps.forEach((dep) => {
    const key = dep.managerData.packageFile;
    const pkgFile: PackageFile = packageFilesByName[key];
    const { deps } = pkgFile;
    deps.push(dep);
    packageFilesByName[key] = pkgFile;
  });

  return Object.values(packageFilesByName);
}
