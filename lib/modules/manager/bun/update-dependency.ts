import { isArray, isObject, isString } from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { NpmPackage } from '../npm/extract/types';
import { updateDependency as updateNpmDependency } from '../npm/update/dependency';
import {
  getNewGitValue,
  getNewNpmAliasValue,
} from '../npm/update/dependency/common';
import type { UpdateDependencyConfig } from '../types';
import { type BunWorkspaces, getBunCatalogsFromPackageJson } from './catalogs';

export function updateBunCatalogDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depType, depName } = upgrade;

  const catalogName = depType?.split('.').at(-1);

  if (!isString(catalogName) || !isString(depName)) {
    logger.error(
      'No catalogName or depName was found; this is likely an extraction error.',
    );
    return null;
  }

  let { newValue } = upgrade;

  newValue = getNewGitValue(upgrade) ?? newValue;
  newValue = getNewNpmAliasValue(newValue, upgrade) ?? newValue;

  logger.trace(
    `bun.updateBunCatalogDependency(): ${depType}::${catalogName}.${depName} = ${newValue}`,
  );

  try {
    const parsedContents: NpmPackage = JSON.parse(fileContent);
    const bunCatalogs = getBunCatalogsFromPackageJson(parsedContents);

    if (!bunCatalogs) {
      logger.debug('No catalogs found in package.json');
      return null;
    }

    const { catalog, catalogs } = bunCatalogs;
    const oldVersion =
      catalogName === 'default'
        ? catalog?.[depName]
        : catalogs?.[catalogName]?.[depName];

    if (oldVersion === newValue) {
      logger.trace('Version is already updated');
      return fileContent;
    }

    const workspaces = parsedContents.workspaces;
    const isWorkspacesObject = isObject(workspaces) && !isArray(workspaces);

    if (catalogName === 'default') {
      if (isWorkspacesObject) {
        const bunWorkspaces = workspaces as BunWorkspaces;
        bunWorkspaces.catalog ??= {};
        bunWorkspaces.catalog[depName] = newValue!;
      } else {
        const typedContents = parsedContents as NpmPackage & {
          catalog: Record<string, string>;
        };
        typedContents.catalog ??= {};
        typedContents.catalog[depName] = newValue!;
      }
    } else {
      if (isWorkspacesObject) {
        const bunWorkspaces = workspaces as BunWorkspaces;
        bunWorkspaces.catalogs ??= {};
        bunWorkspaces.catalogs[catalogName] ??= {};
        bunWorkspaces.catalogs[catalogName][depName] = newValue!;
      } else {
        const typedContents = parsedContents as NpmPackage & {
          catalogs: Record<string, Record<string, string>>;
        };
        typedContents.catalogs ??= {};
        typedContents.catalogs[catalogName] ??= {};
        typedContents.catalogs[catalogName][depName] = newValue!;
      }
    }

    return JSON.stringify(parsedContents, null, 2);
  } catch (err) {
    logger.debug({ err }, 'Error updating bun catalog dependency');
    return null;
  }
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  if (upgrade.depType?.startsWith('bun.catalog')) {
    return updateBunCatalogDependency({ fileContent, upgrade });
  }

  return updateNpmDependency({ fileContent, upgrade });
}
