import is from '@sindresorhus/is';
import type { CustomDatasourceConfig } from '../../../config/types';
import { logger } from '../../../logger';
import * as template from '../../../util/template';
import type { GetReleasesConfig } from '../types';

export function massageCustomDatasourceConfig(
  customDatasourceName: string,
  {
    customDatasources,
    packageName,
    registryUrl: defaultRegistryUrl,
  }: GetReleasesConfig,
): Required<CustomDatasourceConfig> | null {
  const customDatasource = customDatasources?.[customDatasourceName];
  if (is.nullOrUndefined(customDatasource)) {
    logger.debug(
      `No custom datasource config provided while ${packageName} has been requested`,
    );
    return null;
  }
  const templateInput = { packageName };

  const registryUrlTemplate =
    defaultRegistryUrl ?? customDatasource.defaultRegistryUrlTemplate;
  if (is.nullOrUndefined(registryUrlTemplate)) {
    logger.debug(
      'No registry url provided by extraction nor datasource configuration',
    );
    return null;
  }
  const registryUrl = template.compile(registryUrlTemplate, templateInput);

  const transformTemplates = customDatasource.transformTemplates ?? [];
  const transform: string[] = [];
  for (const transformTemplate of transformTemplates) {
    const templated = template.compile(transformTemplate, templateInput);
    transform.push(templated);
  }

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

  if (!is.nonEmptyString(customDatasourceName)) {
    logger.debug(
      `No datasource has been supplied while looking up ${getReleasesConfig.packageName}`,
    );
    return null;
  }

  return massageCustomDatasourceConfig(customDatasourceName, getReleasesConfig);
}
