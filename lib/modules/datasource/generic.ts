import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import { z } from 'zod';
import { logger } from '../../logger';
import { readLocalFile } from '../../util/fs';
import { HttpError } from '../../util/http';
import { parseUrl } from '../../util/url';
import { Datasource } from './datasource';
import type { ReleaseResult } from './types';

export const ReleaseResultZod = z
  .object({
    releases: z.array(
      z
        .object({
          version: z.string(),
          isDeprecated: z.boolean().optional(),
          releaseTimestamp: z.string().optional(),
          sourceUrl: z.string().optional(),
          sourceDirectory: z.string().optional(),
          changelogUrl: z.string().optional(),
        })
        .strict()
    ),
    sourceUrl: z.string().optional(),
    sourceDirectory: z.string().optional(),
    changelogUrl: z.string().optional(),
    homepage: z.string().optional(),
  })
  .strict();

export abstract class GenericDatasource extends Datasource {
  override caching = true;
  override customRegistrySupport = true;

  protected async queryRegistry(
    registryUrl: string | null | undefined
  ): Promise<string | null> {
    if (is.nullOrUndefined(registryUrl)) {
      return null;
    }

    const url = parseUrl(registryUrl);
    if (is.nullOrUndefined(url)) {
      logger.debug(`Failed to parse url ${registryUrl}`);
      return null;
    }

    let response: string | null = null;
    try {
      switch (url.protocol) {
        case 'http:':
        case 'https:':
          response = (await this.http.get(registryUrl)).body;
          break;
        case 'file:':
          response = await readLocalFile(
            registryUrl.replace('file://', ''),
            'utf8'
          );
          break;
        default:
          logger.debug(`Scheme ${url.protocol} is not supported`);
          return null;
      }

      if (!is.nonEmptyString(response)) {
        return null;
      }
    } catch (err) {
      // istanbul ignore else: not testable with nock
      if (err instanceof HttpError) {
        if (err.response?.statusCode === 404) {
          logger.warn({ registryUrl }, `${this.id}: Not Found error`);
          return null;
        }
      }
      this.handleGenericErrors(err);
    }

    return response;
  }

  protected async parseData(
    packageName: string,
    data: unknown
  ): Promise<ReleaseResult | null> {
    const expression = jsonata(packageName);
    // wildcard means same object
    const evaluated =
      packageName === '*' ? data : await expression.evaluate(data);

    const parsed = ReleaseResultZod.safeParse(evaluated);
    if (!parsed.success) {
      logger.debug({ err: parsed.error }, 'Response has failed validation');
      return null;
    }

    return structuredClone(parsed.data);
  }
}
