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

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const extractedDeps: PackageDependency<ManagerData>[] = [];
  const variables: Record<string, PackageVariables> = {};
  for (const packageFile of reorderFiles(packageFiles)) {
    const content = await readLocalFile(packageFile, 'utf8');
    const dir = upath.dirname(toAbsolute(packageFile));
    if (isProps(packageFile)) {
      variables[dir] = parseProps(content, packageFile);
    } else if (isGradle(packageFile)) {
      const vars = variables[dir];
      const parsedDeps = parseGradle(content, vars, packageFile);
      extractedDeps.push(...parsedDeps);
    }
  }

  if (!extractedDeps.length) {
    return null;
  }

  const packageFilesByName: Record<string, PackageFile> = {};
  extractedDeps.forEach((dep) => {
    const key = dep.managerData.packageFile;
    const pkgFile: PackageFile = packageFilesByName[key] || {
      packageFile: key,
      datasource: datasourceMaven.id,
      deps: [],
    };
    const { deps } = pkgFile;
    deps.push(dep);
    packageFilesByName[key] = pkgFile;
  });

  debugger;

  return Object.values(packageFilesByName);
}
