import is from '@sindresorhus/is';
import { logger } from '../../../../../logger';
import { parseSingleYamlDocument } from '../../../../../util/yaml';
import type { UpdateDependencyConfig } from '../../../types';
import { pnpmCatalogsSchema } from '../../extract/pnpm';
import { getNewGitValue, getNewNpmAliasValue } from './common';

export function updatePnpmCatalogDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depType, managerData, depName } = upgrade;

  const catalogName = managerData?.catalogName;

  if (!is.string(catalogName)) {
    logger.error(
      'No catalogName was found; this is likely an extractoin error.',
    );
    return null;
  }

  let { newValue } = upgrade;

  newValue = getNewGitValue(upgrade) ?? newValue;
  newValue = getNewNpmAliasValue(newValue, upgrade) ?? newValue;

  logger.info(
    `npm.updatePnpmCatalogDependency(): ${depType}:${managerData?.catalogName}.${depName} = ${newValue}`,
  );

  let document;
  let parsedContents;

  try {
    document = parseSingleYamlDocument(fileContent);
    parsedContents = pnpmCatalogsSchema.parse(document.toJS());
  } catch (err) {
    logger.debug({ err }, 'Could not parse pnpm-workspace YAML file.');
    return null;
  }

  // In pnpm-workspace.yaml, the default catalog can be either `catalog` or
  // `catalog.default`, but not both (pnpm throws outright with a config error).
  // Thus, we must check which entry is being used, to reference it from the
  // right place.
  const usesImplicitDefaultCatalog = parsedContents.catalog !== undefined;

  // Save the old version
  const oldVersion =
    catalogName === 'default' && usesImplicitDefaultCatalog
      ? parsedContents.catalog?.[depName!]
      : parsedContents.catalogs?.[catalogName]?.[depName!];

  if (oldVersion === newValue) {
    logger.trace('Version is already updated');
    return fileContent;
  }

  if (catalogName === 'default' && usesImplicitDefaultCatalog) {
    document.setIn(['catalog', depName], newValue);
  } else {
    document.setIn(['catalogs', catalogName, depName], newValue);
  }

  return document.toString();
}
