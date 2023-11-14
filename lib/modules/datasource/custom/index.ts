import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import { logger } from '../../../logger';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { fetch as plainFetch } from './formats/plain';
import { fetch as yamlFetch } from './formats/yaml';
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
    let response: unknown;
    try {
      switch (format) {
        case 'plain':
          response = await plainFetch(this.http, defaultRegistryUrlTemplate);
          break;
        case 'yaml':
          response = await yamlFetch(this.http, defaultRegistryUrlTemplate);
          break;
        case 'json':
          response = (await this.http.getJson(defaultRegistryUrlTemplate)).body;
      }
    } catch (e) {
      this.handleHttpErrors(e);
      return null;
    }

    let data = response;

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
