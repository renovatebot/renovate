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
    // TODO: we should move pnpmCatalogsSchema around to a common/shared
    // location in the npm manager
    document = parseSingleYamlDocument(fileContent);
    parsedContents = pnpmCatalogsSchema.parse(document.toJS());
  } catch (err) {
    logger.debug({ err }, 'Could not parse pnpm-workspace YAML file.');
    return null;
  }

  // Save the old version
  const oldVersion =
    catalogName === 'default'
      ? parsedContents.catalog?.[depName!]
      : parsedContents.catalogs?.[catalogName]?.[depName!];

  if (oldVersion === newValue) {
    logger.trace('Version is already updated');
    return fileContent;
  }

  if (catalogName === 'default') {
    // TODO: We should check whether `catalogs\n:default:\npkg: 1.0.0` is valid,
    // because in that case we need to know whether it was set in `catalog` or
    // `catalogs\ndefault`
    document.setIn(['catalog', depName], newValue);
  } else {
    document.setIn(['catalogs', catalogName, depName], newValue);
  }

  return document.toString();
}
