import fs from 'fs';
import zlib from 'zlib';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { getExpression } from '../../../util/jsonata';
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

    const { defaultRegistryUrlTemplate, transformTemplates, format, compressionType } = config;

    const fetcher = fetchers[format];
    const isLocalRegistry = defaultRegistryUrlTemplate.startsWith('file://');

    let data: unknown;
    try {
      if (isLocalRegistry) {
        data = await fetcher.readFile(
          defaultRegistryUrlTemplate.replace('file://', ''),
        );
      } else {
        switch (compressionType) {
          case 'gzip':
            data = await fetcher.fetch(this.http, await this.extractGZip(defaultRegistryUrlTemplate));
            break;
          case 'none':
          default:
            // default to no compression
            data = await fetcher.fetch(this.http, defaultRegistryUrlTemplate);
            break;
        }
      }
    } catch (e) {
      this.handleHttpErrors(e);
      return null;
    }

    logger.trace(
      { data },
      `Custom datasource API fetcher '${format}' received data. Starting transformation.`,
    );

    for (const transformTemplate of transformTemplates) {
      const expression = getExpression(transformTemplate);

      if (expression instanceof Error) {
        logger.once.warn(
          { errorMessage: expression.message },
          `Invalid JSONata expression: ${transformTemplate}`,
        );
        return null;
      }

      try {
        const modifiedData = await expression.evaluate(data);

        logger.trace(
          { before: data, after: modifiedData },
          `Custom datasource transformed data.`,
        );

        data = modifiedData;
      } catch (err) {
        logger.once.warn(
          { err },
          `Error while evaluating JSONata expression: ${transformTemplate}`,
        );
        return null;
      }
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

  private extractGZip(filePath: string): Promise<string> {
    const outputFilePath = filePath.replace(/\.gz$/, ''); // Remove .gz extension

    // Create a read stream for the gzip file
    const fileContents = fs.createReadStream(filePath);

    // Create a write stream for the extracted file
    const writeStream = fs.createWriteStream(outputFilePath);

    // Use zlib to decompress the gzip file
    const unzip = zlib.createGunzip();

    return new Promise<string>((resolve, reject) => {
      fileContents
        .pipe(unzip)
        .pipe(writeStream)
        .on('finish', () => {
          resolve(outputFilePath); // Return the path of the extracted file
        })
        .on('error', (err: Error) => {
          reject(err); // Handle errors
        });
    });
  }
}
