import upath from 'upath';
import { logger } from '../../../logger';
import {
  getSiblingFileName,
  localPathIsFile,
  readLocalFile,
} from '../../../util/fs';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import { collectPackageJson } from './compat';
import { postExtract } from './post';
import { DenoExtract, ImportMapExtract } from './schema';
import type { DenoManagerData } from './types';

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
      const res = DenoExtract.safeParse({
        content,
        fileName: matchedFile,
      });
      if (!res.success) {
        logger.debug({ matchedFile, err: res.error }, 'Deno: extract failed');
        continue;
      }
      const result = await processDenoExtract(res.data);
      packageFiles.push(...result);
    }
  }

  await postExtract(packageFiles);
  return packageFiles;
}

export async function getLockFiles(
  lock: DenoExtract['content']['lock'],
  fileName: string,
): Promise<string[]> {
  let lockFile: string | undefined;

  if (lock && (await localPathIsFile(lock))) {
    lockFile = lock;
  }

  if (!lockFile) {
    const siblingLockFile = getSiblingFileName(fileName, 'deno.lock');
    if (await localPathIsFile(siblingLockFile)) {
      lockFile = siblingLockFile;
    }
  }

  return lockFile ? [lockFile] : [];
}

export async function processImportMap(
  packageFile: string,
  importMapReferrer: string,
  lockFiles: string[],
): Promise<PackageFile<DenoManagerData> | null> {
  // we can't handle remote import map
  if (packageFile.startsWith('http')) {
    return null;
  }

  const content = await readLocalFile(packageFile, 'utf8');
  if (!content) {
    return null;
  }

  const res = ImportMapExtract.safeParse(content);
  if (!res.success) {
    logger.debug({ packageFile, err: res.error }, 'Deno: extract failed');
    return null;
  }

  const deps: PackageDependency<DenoManagerData>[] = [];
  deps.push(...res.data.dependencies);

  return {
    deps,
    packageFile,
    managerData: {
      importMapReferrer,
    },
    lockFiles,
  };
}

export async function processDenoExtract(
  data: DenoExtract,
): Promise<PackageFile<DenoManagerData>[]> {
  const { content, fileName } = data;

  const lockFiles = await getLockFiles(content.lock, fileName);

  let importMapPackageFile: PackageFile<DenoManagerData> | null = null;
  if (content.importMap) {
    importMapPackageFile = await processImportMap(
      content.importMap,
      fileName,
      lockFiles,
    );
  }

  const packageFile: PackageFile<DenoManagerData> = {
    deps: content.dependencies,
    packageFile: fileName,
    managerData: content.managerData,
    lockFiles,
  } satisfies PackageFile<DenoManagerData>;

  return [packageFile, importMapPackageFile].filter(
    Boolean,
  ) as PackageFile<DenoManagerData>[];
}
