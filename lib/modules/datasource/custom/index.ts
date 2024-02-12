import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import { logger } from '../../../logger';
import { getParentDir, readLocalDirectory, statLocalFile } from '../../../util/fs';
import { ensureLocalPath } from '../../../util/fs/util';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
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
        const localPath = ensureLocalPath(
          defaultRegistryUrlTemplate.replace('file://', ''),
        );
        const localFileStat = await statLocalFile(localPath);
        if (localFileStat === null || !localFileStat.isFile()) {
          logger.debug({ localPath }, `Local file not found`);
          const parentDirList = readLocalDirectory(getParentDir(localPath));
          logger.debug({ parentDirList }, `Parent dir list`);
          data = null;
        } else {
          data = await fetcher.readFile(localPath);
        }
      } else {
        data = await fetcher.fetch(this.http, defaultRegistryUrlTemplate);
      }
    } catch (e) {
      this.handleHttpErrors(e);
      return null;
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
