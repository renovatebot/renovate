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
  }: GetReleasesConfig
): Required<CustomDatasourceConfig> | null {
  const customDatasource = customDatasources?.[customDatasourceName];
  if (is.nullOrUndefined(customDatasource)) {
    logger.debug(
      `No custom datasource config provided while ${packageName} has been requested`
    );
    return null;
  }
  const templateInput = { packageName };

  const registryUrlTemplate =
    defaultRegistryUrl ?? customDatasource.registryUrlTemplate;
  if (is.nullOrUndefined(registryUrlTemplate)) {
    logger.debug(
      'No registry url provided by extraction nor datasource configuration'
    );
    return null;
  }
  const registryUrl = template.compile(registryUrlTemplate, templateInput);

  const pathTemplate = customDatasource.pathTemplate ?? '';
  const path = template.compile(pathTemplate, templateInput);
  return {
    format: customDatasource.format ?? 'json',
    registryUrlTemplate: registryUrl,
    pathTemplate: path,
    transform: customDatasource.transform ?? '',
  };
}
