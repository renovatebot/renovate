import is from '@sindresorhus/is';
import { parseDocument } from 'yaml';
import { logger } from '../../../../../logger';
import { parseSingleYaml } from '../../../../../util/yaml';
import type { UpdateDependencyConfig } from '../../../types';
import { pnpmCatalogsSchema } from '../../extract/pnpm';

// TODO(fpapado): move this somewhere else, e.g. npm/update/dependency/pnpm
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

  // Handle git tags or digests
  if (upgrade.currentRawValue) {
    if (upgrade.currentDigest) {
      logger.debug('Updating package.json git digest');
      newValue = upgrade.currentRawValue.replace(
        upgrade.currentDigest,
        // TODO #22198

        upgrade.newDigest!.substring(0, upgrade.currentDigest.length),
      );
    } else {
      logger.debug('Updating package.json git version tag');
      newValue = upgrade.currentRawValue.replace(
        upgrade.currentValue,
        upgrade.newValue,
      );
    }
  }

  // Handle aliases
  if (upgrade.npmPackageAlias) {
    newValue = `npm:${upgrade.packageName}@${newValue}`;
  }

  logger.info(
    `npm.updatePnpmCatalogDependency(): ${depType}:${managerData?.catalogName}.${depName} = ${newValue}`,
  );

  // Save the old version
  let parsedContents;

  try {
    // TODO: we should move pnpmCatalogsSchema around to a common/shared location in the npm manager
    parsedContents = parseSingleYaml(fileContent, {
      customSchema: pnpmCatalogsSchema,
    });
  } catch (err) {
    logger.debug({ err }, 'Could not parse pnpm-workspace YAML file.');
    return null;
  }

  const oldVersion =
    catalogName === 'default'
      ? parsedContents.catalog?.[depName!]
      : parsedContents.catalogs?.[catalogName]?.[depName!];

  if (oldVersion === newValue) {
    logger.trace('Version is already updated');
    return fileContent;
  }

  // TODO: Consider separating `parseSingleYaml` and
  // `parseSingleYamlDocument`/`yamlDocumentToJS`, so that we can keep the unified API
  const document = parseDocument(fileContent, {
    uniqueKeys: false,
    strict: false,
  });

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
