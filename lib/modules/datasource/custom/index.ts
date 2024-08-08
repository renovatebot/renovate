import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import { logger } from '../../../logger';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { fetchers } from './formats';
import { ReleaseResultZodSchema } from './schema';
import { getCustomConfig } from './utils';

export class CustomDatasource extends Datasource {
  static readonly id = 'custom';

  override customRegistrySupport = true;

  constructor() {
    super(CustomDatasource.id);
  }

  async getReleases(
    getReleasesConfig: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const config = getCustomConfig(getReleasesConfig);
    if (is.nullOrUndefined(config)) {
      return null;
    }

    const { defaultRegistryUrlTemplate, transformTemplates, format } = config;

    const fetcher = fetchers[format];
    const isLocalRegistry = defaultRegistryUrlTemplate.startsWith('file://');

    let data: unknown;
    try {
      if (isLocalRegistry) {
        data = await fetcher.readFile(
          defaultRegistryUrlTemplate.replace('file://', ''),
        );
      } else {
        data = await fetcher.fetch(this.http, defaultRegistryUrlTemplate);
      }
    } catch (e) {
      this.handleHttpErrors(e);
      return null;
    }

    logger.trace({ data }, `Custom manager fetcher '${format}' returned data.`);

    for (const transformTemplate of transformTemplates) {
      const expression = jsonata(transformTemplate);
      data = await expression.evaluate(data);
    }

    try {
      const parsed = ReleaseResultZodSchema.parse(data);
      return structuredClone(parsed);
    } catch (err) {
      logger.debug({ err }, `Response has failed validation`);
      logger.trace({ data }, 'Response that has failed validation');
      return null;
    }
  }

  override getDigest(
    { packageName }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    // Return null here to support setting a digest: value can be provided digest in getReleases
    return Promise.resolve(null);
  }
}
