import type { File as GCSFile } from '@google-cloud/storage';
import { GlobalConfig } from '../../../../config/global.ts';
import { logger } from '../../../../logger/index.ts';
import { outputCacheFile } from '../../../fs/index.ts';
import { getGCSClient, parseGCSUrl } from '../../../gcs.ts';
import { getLocalCacheFileName } from '../common.ts';
import type { RepoCacheRecord } from '../schema.ts';
import { RepoCacheBase } from './base.ts';

export class RepoCacheGCS extends RepoCacheBase {
  private readonly bucket?: string;
  private readonly objectPath: string;

  constructor(repository: string, fingerprint: string, url: string) {
    super(repository, fingerprint);

    const parts = parseGCSUrl(url);
    if (!parts?.bucket) {
      logger.warn({ url }, 'RepoCacheGCS() - invalid GCS URL');
      this.objectPath = '';
      return;
    }

    this.bucket = parts.bucket;
    this.objectPath = `${this.getCacheFolder(parts.pathname)}${this.platform}/${this.repository}/cache.json`;
  }

  private async getCacheFile(): Promise<GCSFile | undefined> {
    if (!this.bucket) {
      return undefined;
    }

    const client = await getGCSClient();
    return client.bucket(this.bucket).file(this.objectPath);
  }

  async read(): Promise<string | null> {
    try {
      const cacheFile = await this.getCacheFile();
      if (!cacheFile) {
        return null;
      }

      const [res] = await cacheFile.download();
      logger.debug('RepoCacheGCS.read() - success');
      return res.toString('utf8');
    } catch (err) {
      // https://cloud.google.com/storage/docs/json_api/v1/status-codes
      if (err.code === 404) {
        logger.debug('RepoCacheGCS.read() - No cached file found');
      } else {
        logger.warn({ err }, 'RepoCacheGCS.read() - failure');
      }
    }
    return null;
  }

  async write(data: RepoCacheRecord): Promise<void> {
    const stringifiedCache = JSON.stringify(data);
    try {
      const cacheFile = await this.getCacheFile();
      if (!cacheFile) {
        logger.warn('RepoCacheGCS.write() - invalid GCS URL');
        return;
      }

      await cacheFile.save(stringifiedCache, {
        contentType: 'application/json',
        resumable: false,
      });
      if (GlobalConfig.get('repositoryCacheForceLocal')) {
        const cacheLocalFileName = getLocalCacheFileName(
          this.platform,
          this.repository,
        );
        await outputCacheFile(cacheLocalFileName, stringifiedCache);
      }
    } catch (err) {
      logger.warn({ err }, 'RepoCacheGCS.write() - failure');
    }
  }

  private getCacheFolder(pathname: string | undefined): string {
    if (!pathname) {
      return '';
    }

    if (pathname.endsWith('/')) {
      return pathname;
    }

    logger.warn(
      { pathname },
      'RepoCacheGCS.getCacheFolder() - appending missing trailing slash to pathname',
    );
    return `${pathname}/`;
  }
}
