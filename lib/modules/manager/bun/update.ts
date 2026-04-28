import { isPlainObject } from '@sindresorhus/is';
import { weave } from 'jsonc-weaver';
import { logger } from '../../../logger/index.ts';
import { BUN_CATALOG_DEPENDENCY } from '../npm/extract/common/catalogs.ts';
import { updateDependency as npmUpdateDependency } from '../npm/update/index.ts';
import type { UpdateDependencyConfig } from '../types.ts';

const bunCatalogRe = new RegExp(
  `^${BUN_CATALOG_DEPENDENCY}\\.(?<catalogName>.+)$`,
);

/**
 * Locate and update a catalog entry in the parsed package.json object.
 * Bun supports catalogs at the top level or under the `workspaces` object.
 *
 * Returns `true` if the value was found and updated, `false` otherwise.
 */
function updateCatalogValue(
  parsedContents: Record<string, unknown>,
  catalogName: string,
  depName: string,
  newValue: string,
): boolean {
  const targets = findCatalogTargets(parsedContents, catalogName);

  for (const target of targets) {
    if (depName in target) {
      target[depName] = newValue;
      return true;
    }
  }

  return false;
}

/**
 * Find all possible catalog objects where a dependency might live.
 * Checks both top-level and `workspaces`-nested locations.
 */
function findCatalogTargets(
  parsedContents: Record<string, unknown>,
  catalogName: string,
): Record<string, string>[] {
  const targets: Record<string, string>[] = [];
  const workspaces = parsedContents.workspaces;

  if (catalogName === 'default') {
    // Default catalog: look in `catalog` at top level and under `workspaces`
    if (isPlainObject(parsedContents.catalog)) {
      targets.push(parsedContents.catalog as Record<string, string>);
    }
    if (isPlainObject(workspaces) && isPlainObject(workspaces.catalog)) {
      targets.push(workspaces.catalog as Record<string, string>);
    }
  } else {
    // Named catalog: look in `catalogs.<name>` at top level and under `workspaces`
    if (
      isPlainObject(parsedContents.catalogs) &&
      isPlainObject(parsedContents.catalogs[catalogName])
    ) {
      targets.push(
        parsedContents.catalogs[catalogName] as Record<string, string>,
      );
    }
    if (
      isPlainObject(workspaces) &&
      isPlainObject(workspaces.catalogs) &&
      isPlainObject(workspaces.catalogs[catalogName])
    ) {
      targets.push(workspaces.catalogs[catalogName] as Record<string, string>);
    }
  }

  return targets;
}

export function updateDependency({
  fileContent,
  packageFile: packageFileName,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depType, depName } = upgrade;

  const catalogMatch = bunCatalogRe.exec(depType ?? '');
  if (!catalogMatch?.groups) {
    // Not a bun catalog dependency — delegate to the npm manager's updateDependency
    return npmUpdateDependency({
      fileContent,
      packageFile: packageFileName,
      upgrade,
    });
  }

  const catalogName = catalogMatch.groups.catalogName;

  const { newValue } = upgrade;

  if (!depName || !newValue) {
    logger.debug('Missing depName or newValue for bun catalog update');
    return null;
  }

  logger.debug(`bun.updateDependency(): ${depType}.${depName} = ${newValue}`);

  let parsedContents: Record<string, unknown>;
  try {
    parsedContents = JSON.parse(fileContent);
  } catch {
    logger.debug('Error parsing package.json for bun catalog update');
    return null;
  }

  // Check if already at the desired version
  const targets = findCatalogTargets(parsedContents, catalogName);
  for (const target of targets) {
    if (target[depName] === newValue) {
      logger.trace('Version is already updated');
      return fileContent;
    }
  }

  const updated = updateCatalogValue(
    parsedContents,
    catalogName,
    depName,
    newValue,
  );
  if (!updated) {
    logger.debug(
      { catalogName, depName },
      'Could not find bun catalog entry to update',
    );
    return null;
  }

  // Use jsonc-weaver to preserve original formatting
  try {
    return weave(fileContent, parsedContents);
  } catch (err) {
    logger.warn(
      { err },
      'Error weaving JSON to preserve formatting for bun catalog update',
    );
    return null;
  }
}
