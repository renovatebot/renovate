import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import { logger } from '../../../logger';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { fetch as jsonFetch, read as jsonRead } from './formats/json';
import { fetch as plainFetch, read as plainRead } from './formats/plain';
import { fetch as yamlFetch, read as yamlRead } from './formats/yaml';
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

    const {
      isLocalRegistry,
      defaultRegistryUrlTemplate,
      transformTemplates,
      format,
    } = config;

    let data: unknown;
    if (isLocalRegistry) {
      switch (format) {
        case 'plain':
          data = await plainRead(defaultRegistryUrlTemplate);
          break;
        case 'yaml':
          data = await yamlRead(defaultRegistryUrlTemplate);
          break;
        case 'json':
          data = await jsonRead(defaultRegistryUrlTemplate);
          break;
      }
    } else {
      try {
        switch (format) {
          case 'plain':
            data = await plainFetch(this.http, defaultRegistryUrlTemplate);
            break;
          case 'yaml':
            data = await yamlFetch(this.http, defaultRegistryUrlTemplate);
            break;
          case 'json':
            data = await jsonFetch(this.http, defaultRegistryUrlTemplate);
            break;
        }
      } catch (e) {
        this.handleHttpErrors(e);
        return null;
      }
    }

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
}
