import { isString } from '@sindresorhus/is';
import { logger } from '../../../../logger/index.ts';
import { coerceArray } from '../../../../util/array.ts';
import { readLocalFile, writeLocalFile } from '../../../../util/fs/index.ts';
import type { FileChange } from '../../../../util/git/types.ts';
import type { PostUpdateConfig } from '../../types.ts';
import { PNPM_CATALOG_DEPENDENCY } from '../extract/common/catalogs.ts';
import type { NpmManagerData } from '../types.ts';
import { updateDependency } from '../update/dependency/index.ts';
import type { AdditionalPackageFiles } from './types.ts';

const catalogDepTypePrefix = `${PNPM_CATALOG_DEPENDENCY}.`;

const referencingDepTypes = new Set([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]);

interface CatalogRename {
  catalogName: string;
  depName: string;
  newName: string;
  pnpmLockFile: string;
}

function referencesCatalog(
  value: string | null | undefined,
  catalogName: string,
): boolean {
  if (value === `catalog:${catalogName}`) {
    return true;
  }
  return catalogName === 'default' && value === 'catalog:';
}

function getCatalogRenames(
  config: PostUpdateConfig<NpmManagerData>,
): CatalogRename[] {
  const updatedFiles = new Set(
    config.updatedPackageFiles?.map((file) => file.path),
  );
  const renames: CatalogRename[] = [];
  for (const upgrade of config.upgrades) {
    const { depType, depName, newName, packageFile } = upgrade;
    const pnpmLockFile = upgrade.managerData?.pnpmLockFile;
    if (
      !depType?.startsWith(catalogDepTypePrefix) ||
      !depName ||
      !newName ||
      newName === depName ||
      // only follow catalog entries which were renamed in this update
      !packageFile ||
      !updatedFiles.has(packageFile) ||
      !isString(pnpmLockFile)
    ) {
      continue;
    }
    renames.push({
      catalogName: depType.slice(catalogDepTypePrefix.length),
      depName,
      newName,
      pnpmLockFile,
    });
  }
  return renames;
}

/**
 * A replacement of a pnpm catalog entry renames its key in `pnpm-workspace.yaml`.
 * The `package.json` files of the workspace which reference it with `catalog:` or `catalog:<name>` are renamed here too, keeping the reference, so that pnpm can still resolve them.
 */
export async function renamePnpmCatalogReferences(
  config: PostUpdateConfig<NpmManagerData>,
  packageFiles: AdditionalPackageFiles,
): Promise<FileChange[]> {
  const renames = getCatalogRenames(config);
  if (!renames.length) {
    return [];
  }
  const updatedFiles: FileChange[] = [];
  for (const packageFile of coerceArray(packageFiles.npm)) {
    const fileName = packageFile.packageFile;
    const pnpmLockFile = packageFile.managerData?.pnpmLockFile;
    if (!fileName?.endsWith('package.json') || !isString(pnpmLockFile)) {
      continue;
    }
    // the updated package files have already been written to disk
    const originalContent = await readLocalFile(fileName, 'utf8');
    if (!originalContent) {
      continue;
    }
    let content = originalContent;
    for (const rename of renames) {
      if (rename.pnpmLockFile !== pnpmLockFile) {
        continue;
      }
      for (const dep of coerceArray(packageFile.deps)) {
        if (
          dep.depName !== rename.depName ||
          !referencingDepTypes.has(dep.depType!) ||
          !referencesCatalog(dep.currentValue, rename.catalogName)
        ) {
          continue;
        }
        const newContent = updateDependency({
          fileContent: content,
          packageFile: fileName,
          upgrade: {
            depType: dep.depType,
            depName: dep.depName,
            newName: rename.newName,
            newValue: dep.currentValue!,
          },
        });
        if (!newContent) {
          logger.debug(
            { packageFile: fileName, depName: dep.depName },
            'Could not rename pnpm catalog reference',
          );
          continue;
        }
        content = newContent;
      }
    }
    if (content === originalContent) {
      continue;
    }
    logger.debug(`Renaming pnpm catalog references in ${fileName}`);
    await writeLocalFile(fileName, content);
    updatedFiles.push({ type: 'addition', path: fileName, contents: content });
  }
  return updatedFiles;
}
