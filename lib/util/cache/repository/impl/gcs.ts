import type { File as GcsFile } from '@google-cloud/storage';
import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import { getEnv } from '../../../env';
import { outputCacheFile } from '../../../fs';
import { getGcsClient, parseGcsUrl } from '../../../gcs';
import { getLocalCacheFileName } from '../common';
import type { RepoCacheRecord } from '../schema';
import { RepoCacheBase } from './base';

export class RepoCacheGcs extends RepoCacheBase {
  private readonly cacheFile: GcsFile;

  constructor(repository: string, fingerprint: string, gcsUrl: string) {
    super(repository, fingerprint);

    const gcsClient = getGcsClient();
    const { bucket, pathname } = parseGcsUrl(gcsUrl)!;

    this.cacheFile = gcsClient
      .bucket(bucket)
      .file(this.getCacheFilename(pathname));
  }

  async read(): Promise<string | null> {
    try {
      const [fileExists] = await this.cacheFile.exists();

      if (!fileExists) {
        logger.debug('RepoCacheGcs.read() - No cached file found');
        return null;
      }

      const [fileContent] = await this.cacheFile.download();

      logger.debug('RepoCacheGcs.read() - success');

      return fileContent.toString('utf8');
    } catch (err) {
      logger.warn({ err }, 'RepoCacheGcs.read() - failure');

      return null;
    }
  }

  async write(data: RepoCacheRecord): Promise<void> {
    const stringifiedCache = JSON.stringify(data);

    try {
      await this.cacheFile.save(stringifiedCache, {
        contentType: 'application/json',
      });

      if (is.nonEmptyString(getEnv().RENOVATE_X_REPO_CACHE_FORCE_LOCAL)) {
        const cacheLocalFileName = getLocalCacheFileName(
          this.platform,
          this.repository,
        );
        await outputCacheFile(cacheLocalFileName, stringifiedCache);
      }
    } catch (err) {
      logger.warn({ err }, 'RepoCacheGcs.write() - failure');
    }
  }

  private getCacheFilename(pathname: string): string {
    let pathnameWithSlash = pathname;
    if (pathname && !pathname.endsWith('/')) {
      logger.warn(
        { pathname },
        'RepoCacheGcs.getCacheFilename() - appending missing trailing slash to pathname',
      );
      pathnameWithSlash += '/';
    }

    return `${pathnameWithSlash}${this.platform}/${this.repository}/cache.json`;
  }
}
