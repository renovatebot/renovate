import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import { logger } from '../../../logger';
import { newlineRegex } from '../../../util/regex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { ReleaseResultZodSchema } from './schema';
import { massageCustomDatasourceConfig } from './utils';

export class CustomDatasource extends Datasource {
  static readonly id = 'custom';

  override customRegistrySupport = true;

  constructor() {
    super(CustomDatasource.id);
  }

  async getReleases(
    getReleasesConfig: GetReleasesConfig
  ): Promise<ReleaseResult | null> {
    const customDatasourceName = getReleasesConfig.datasource?.replace(
      'custom.',
      ''
    );

    if (!is.nonEmptyString(customDatasourceName)) {
      logger.debug(
        `No datasource has been supplied while looking up ${getReleasesConfig.packageName}`
      );
      return null;
    }

    const config = massageCustomDatasourceConfig(
      customDatasourceName,
      getReleasesConfig
    );
    if (is.nullOrUndefined(config)) {
      return null;
    }

    const { defaultRegistryUrlTemplate, transformTemplates, format } = config;
    // TODO add here other format options than JSON and "plain"
    let response: unknown;
    try {
      if (format === 'plain') {
        response = await this.fetchPlainFormat(defaultRegistryUrlTemplate);
      } else {
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

  private async fetchPlainFormat(url: string): Promise<unknown> {
    const response = await this.http.get(url, {
      headers: {
        Accept: 'text/plain',
      },
    });
    const contentType = response.headers['content-type'];
    if (!contentType?.startsWith('text/')) {
      return null;
    }
    const versions = response.body.split(newlineRegex).map((version) => {
      return {
        version: version.trim(),
      };
    });
    return {
      releases: versions,
    };
  }
}
