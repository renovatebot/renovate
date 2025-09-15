import upath from 'upath';
import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import type { ExtractConfig, PackageFile } from '../types';
import {
  detectNodeCompatWorkspaces,
  extractDenoCompatiblePackageJson,
} from './compat';
import { postExtract } from './post';
import { DenoExtract } from './schema';
import type { DenoManagerData } from './types';

export async function collectPackageJson(
  lockFile: string,
): Promise<PackageFile<DenoManagerData>[] | null> {
  const lockFiles = [lockFile];
  const packageFiles: PackageFile<DenoManagerData>[] = [];
  const rootPackageJson = getSiblingFileName(lockFile, 'package.json');
  const rootPackageFile =
    await extractDenoCompatiblePackageJson(rootPackageJson);
  if (rootPackageFile) {
    const pkg = {
      ...rootPackageFile,
      lockFiles,
    };

    // detect node compat workspaces
    const result = await detectNodeCompatWorkspaces(pkg);
    if (!result) {
      return null;
    }
    const { workspaces, packagePaths } = result;
    pkg.managerData = {
      ...pkg.managerData,
      // override workspace
      workspaces,
    };
    packageFiles.push(pkg);

    for (const packagePath of packagePaths) {
      const packageFile = await extractDenoCompatiblePackageJson(packagePath);
      if (packageFile) {
        const pkg = {
          ...packageFile,
          lockFiles,
        };
        packageFiles.push(pkg);
      }
    }
  }

  return packageFiles;
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  matchedFiles: string[],
): Promise<PackageFile<DenoManagerData>[]> {
  const packageFiles: PackageFile<DenoManagerData>[] = [];

  for (const matchedFile of matchedFiles) {
    if (upath.basename(matchedFile) === 'deno.lock') {
      // node-compat
      const extracted = await collectPackageJson(matchedFile);
      if (extracted) {
        packageFiles.push(...extracted);
      }
    }

    // deno.json or deno.jsonc
    if (upath.basename(matchedFile).startsWith('deno.json')) {
      const content = await readLocalFile(matchedFile, 'utf8');
      const res = await DenoExtract.safeParseAsync({
        content,
        fileName: matchedFile,
      });
      if (!res.success) {
        logger.debug({ matchedFile, err: res.error }, 'Deno: extract failed');
        continue;
      }
      packageFiles.push(...res.data);
    }
  }

  await postExtract(packageFiles);
  return packageFiles;
}
