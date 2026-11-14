import { isNonEmptyString, isNullOrUndefined } from '@sindresorhus/is';
import type { CustomDatasourceConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { detachUrlCredentials } from '../../../util/host-rules.ts';
import * as template from '../../../util/template/index.ts';
import type { GetReleasesConfig } from '../types.ts';

export function massageCustomDatasourceConfig(
  customDatasourceName: string,
  {
    customDatasources,
    packageName,
    currentValue,
    registryUrl: defaultRegistryUrl,
  }: GetReleasesConfig,
): Required<CustomDatasourceConfig> | null {
  const customDatasource = customDatasources?.[customDatasourceName];
  if (isNullOrUndefined(customDatasource)) {
    logger.debug(
      `No custom datasource config provided while ${packageName} has been requested`,
    );
    return null;
  }
  const templateInput = { packageName, currentValue };

  const registryUrlTemplate =
    defaultRegistryUrl ?? customDatasource.defaultRegistryUrlTemplate;
  if (isNullOrUndefined(registryUrlTemplate)) {
    logger.debug(
      'No registry url provided by extraction nor datasource configuration',
    );
    return null;
  }
  // the credentials of a URL template are detached from the URL it compiles, the one which is requested with the `custom` host type
  const registryUrl = detachUrlCredentials(
    template.compile(registryUrlTemplate, templateInput),
    ['custom'],
  );

  const transformTemplates = coerceArray(customDatasource.transformTemplates);
  const transform: string[] = [];
  for (const transformTemplate of transformTemplates) {
    const templated = template.compile(transformTemplate, templateInput);
    transform.push(templated);
  }

  logger.trace({ transform }, `Custom datasource compiled data.`);

  return {
    format: customDatasource.format ?? 'json',
    defaultRegistryUrlTemplate: registryUrl,
    transformTemplates: transform,
  };
}

export function getCustomConfig(
  getReleasesConfig: GetReleasesConfig,
): Required<CustomDatasourceConfig> | null {
  const customDatasourceName = getReleasesConfig.datasource?.replace(
    'custom.',
    '',
  );

  if (!isNonEmptyString(customDatasourceName)) {
    logger.debug(
      `No datasource has been supplied while looking up ${getReleasesConfig.packageName}`,
    );
    return null;
  }

  return massageCustomDatasourceConfig(customDatasourceName, getReleasesConfig);
}
