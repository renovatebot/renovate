import { isNonEmptyArray } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { readLocalDirectory, readLocalFile } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { parseUrl } from '../../../util/url.ts';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';
import { parseHCL } from './hcl/index.ts';
import type { TerraformDefinitionFile } from './hcl/types.ts';
import type { ProviderLock } from './lockfile/types.ts';
import { extractLocks, findLockFile, readLockFile } from './lockfile/util.ts';

export function checkFileContainsDependency(
  content: string,
  checkList: string[],
): boolean {
  return checkList.some((check) => content.includes(check));
}

export function massageProviderLookupName(dep: PackageDependency): void {
  dep.packageName ??= dep.depName;

  // TODO #22198
  if (!dep.packageName!.includes('/')) {
    dep.packageName = `hashicorp/${dep.packageName!}`;
  }

  // handle cases like `Telmate/proxmox`
  // TODO #22198
  dep.packageName = dep.packageName!.toLowerCase();
}

export function getLockedVersion(
  dep: PackageDependency,
  locks: ProviderLock[],
): string | undefined {
  const depRegistryUrl = dep.registryUrls
    ? dep.registryUrls[0]
    : TerraformProviderDatasource.getDefaultRegistryUrls()[0];
  const foundLock = locks.find(
    (lock) =>
      lock.packageName === dep.packageName &&
      lock.registryUrl === depRegistryUrl,
  );
  if (foundLock) {
    return foundLock.version;
  }
  return undefined;
}

export function applyOciDependency(
  dep: PackageDependency,
  source: string,
  registryAliases?: Record<string, string>,
): void {
  const url = parseUrl(source);
  if (!url) {
    dep.skipReason = 'invalid-url';
    return;
  }

  // Strip optional `//subfolder` sub-path (e.g. `example.com/repo//modules/vpc`)
  const imageRef = (url.host + url.pathname).replace(regEx(/\/\/.+$/), '');

  const parsed = getDep(imageRef, {
    specifyReplaceString: false,
    registryAliases,
  });
  dep.packageName = parsed.packageName;
  dep.datasource = parsed.datasource;
  dep.currentValue = url.searchParams.get('tag') ?? undefined;
  dep.currentDigest = url.searchParams.get('digest') ?? undefined;

  if (!dep.currentValue && !dep.currentDigest) {
    dep.skipReason = 'unspecified-version';
  }
}

export async function extractLocksForPackageFile(
  fileName: string,
): Promise<ProviderLock[]> {
  const locks: ProviderLock[] = [];
  const lockFilePath = await findLockFile(fileName);
  if (lockFilePath) {
    const lockFileContent = await readLockFile(lockFilePath);
    if (lockFileContent) {
      const extractedLocks = extractLocks(lockFileContent);
      if (isNonEmptyArray(extractedLocks)) {
        locks.push(...extractedLocks);
      }
    }
  }
  return locks;
}

const terraformFileRegex = regEx(/\.(?:tf|tofu)$/);
const moduleUsingReferenceRegex = regEx(/\b(?:local|var)\./);

/**
 * Reads and parses the other Terraform files of the directory of `packageFile`
 * which contain a module that may use a `local`/`variable` reference.
 * Terraform treats all files of a directory as one module, so a `local` or
 * `variable` can be declared in a different file than the module using it.
 */
export async function readSiblingHclFiles(
  packageFile: string,
): Promise<TerraformDefinitionFile[]> {
  const dir = upath.dirname(packageFile);
  let fileNames: string[];
  try {
    fileNames = coerceArray(await readLocalDirectory(dir));
  } catch (err) {
    logger.debug({ packageFile, err }, 'Terraform: cannot read directory');
    return [];
  }

  const self = upath.normalize(packageFile);
  const siblings: TerraformDefinitionFile[] = [];
  for (const fileName of fileNames.filter((name) =>
    terraformFileRegex.test(name),
  )) {
    const siblingFile = upath.join(dir, fileName);
    if (siblingFile === self) {
      continue;
    }
    const content = await readLocalFile(siblingFile, 'utf8');
    if (
      !content?.includes('module') ||
      !moduleUsingReferenceRegex.test(content)
    ) {
      continue;
    }
    const hclMap = await parseHCL(content, siblingFile);
    if (hclMap) {
      siblings.push(hclMap);
    }
  }
  return siblings;
}
