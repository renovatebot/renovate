import { isObject, isString } from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { UpdateDependencyConfig } from '../types';

interface BunWorkspaces {
  packages?: string[] | string;
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

export function updateBunCatalogDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depType, depName } = upgrade;

  const catalogName = depType?.split('.').at(-1);

  if (!isString(catalogName)) {
    logger.error(
      'No catalogName was found; this is likely an extraction error.',
    );
    return null;
  }

  const { newValue } = upgrade;

  logger.trace(
    `bun.updateBunCatalogDependency(): ${depType}::${catalogName}.${depName} = ${newValue}`,
  );

  try {
    const parsedContents = JSON.parse(fileContent);
    const workspaces = parsedContents.workspaces as BunWorkspaces;

    if (!isObject(workspaces)) {
      logger.debug('No workspaces found in package.json');
      return null;
    }

    let oldVersion: string | undefined;

    if (catalogName === 'default') {
      oldVersion = workspaces.catalog?.[depName!];
      if (oldVersion === newValue) {
        logger.trace('Version is already updated');
        return fileContent;
      }

      if (!isObject(workspaces.catalog)) {
        (workspaces as any).catalog = {};
      }
      (workspaces as any).catalog[depName!] = newValue;
    } else {
      oldVersion = workspaces.catalogs?.[catalogName]?.[depName!];
      if (oldVersion === newValue) {
        logger.trace('Version is already updated');
        return fileContent;
      }

      if (!isObject(workspaces.catalogs)) {
        (workspaces as any).catalogs = {};
      }
      if (!isObject((workspaces as any).catalogs[catalogName])) {
        (workspaces as any).catalogs[catalogName] = {};
      }
      (workspaces as any).catalogs[catalogName][depName!] = newValue;
    }

    return JSON.stringify(parsedContents, null, 2);
  } catch (err) {
    logger.debug({ err }, 'Error updating bun catalog dependency');
    return null;
  }
}
