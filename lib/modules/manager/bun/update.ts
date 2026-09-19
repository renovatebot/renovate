import { isPlainObject } from '@sindresorhus/is';
import { weave } from 'jsonc-weaver';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { BUN_CATALOG_DEPENDENCY } from '../npm/extract/common/catalogs.ts';
import {
  getNewGitValue,
  getNewNpmAliasValue,
} from '../npm/update/dependency/common.ts';
import { updateDependency as npmUpdateDependency } from '../npm/update/index.ts';
import type { UpdateDependencyConfig } from '../types.ts';

const bunCatalogRe = regEx(`^${BUN_CATALOG_DEPENDENCY}\\.(?<catalogName>.+)$`);

function getCatalog(scope: unknown, catalogName: string): unknown {
  if (!isPlainObject(scope)) {
    return null;
  }
  if (catalogName === 'default') {
    return scope.catalog;
  }
  return isPlainObject(scope.catalogs) ? scope.catalogs[catalogName] : null;
}

/**
 * Bun catalogs live at the top level of the root `package.json` or under its
 * `workspaces` object. Returns the catalog object containing `depName`.
 */
function findCatalogWithDep(
  parsedContents: Record<string, unknown>,
  catalogName: string,
  depName: string,
): Record<PropertyKey, unknown> | null {
  for (const scope of [parsedContents, parsedContents.workspaces]) {
    const catalog = getCatalog(scope, catalogName);
    if (isPlainObject(catalog) && depName in catalog) {
      return catalog;
    }
  }
  return null;
}

export function updateDependency(
  config: UpdateDependencyConfig,
): string | null {
  const { fileContent, upgrade } = config;
  const { depType, depName } = upgrade;

  const catalogName = bunCatalogRe.exec(depType ?? '')?.groups?.catalogName;
  if (!catalogName) {
    return npmUpdateDependency(config);
  }

  let { newValue } = upgrade;
  newValue = getNewGitValue(upgrade) ?? newValue;
  newValue = getNewNpmAliasValue(newValue, upgrade) ?? newValue;

  if (!depName || !newValue) {
    logger.debug('Missing depName or newValue for bun catalog update');
    return null;
  }

  logger.debug(`bun.updateDependency(): ${depType}.${depName} = ${newValue}`);

  try {
    const parsedContents: Record<string, unknown> = JSON.parse(fileContent);
    const catalog = findCatalogWithDep(parsedContents, catalogName, depName);
    if (!catalog) {
      logger.debug({ catalogName, depName }, 'Bun catalog entry not found');
      return null;
    }
    if (catalog[depName] === newValue) {
      logger.trace('Version is already updated');
      return fileContent;
    }
    catalog[depName] = newValue;
    return weave(fileContent, parsedContents);
  } catch (err) {
    logger.debug({ err }, 'Error updating bun catalog dependency');
    return null;
  }
}
