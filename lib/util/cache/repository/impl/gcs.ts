import type { File as GCSFile } from '@google-cloud/storage';
import { GlobalConfig } from '../../../../config/global.ts';
import { logger } from '../../../../logger/index.ts';
import { outputCacheFile } from '../../../fs/index.ts';
import { getGCSClient, parseGCSUrl } from '../../../gcs.ts';
import { getLocalCacheFileName } from '../common.ts';
import type { RepoCacheRecord } from '../schema.ts';
import { RepoCacheBase } from './base.ts';

export class RepoCacheGCS extends RepoCacheBase {
  private readonly cacheFile?: GCSFile;

  constructor(repository: string, fingerprint: string, url: string) {
    super(repository, fingerprint);

    const parts = parseGCSUrl(url);
    if (!parts?.bucket) {
      logger.warn({ url }, 'RepoCacheGCS() - invalid GCS URL');
      return;
    }

    const dir = this.getCacheFolder(parts.pathname);
    this.cacheFile = getGCSClient()
      .bucket(parts.bucket)
      .file(`${dir}${this.platform}/${this.repository}/cache.json`);
  }

  async read(): Promise<string | null> {
    if (!this.cacheFile) {
      return null;
    }

    try {
      const [res] = await this.cacheFile.download();
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
    if (!this.cacheFile) {
      logger.warn('RepoCacheGCS.write() - invalid GCS URL');
      return;
    }

    const stringifiedCache = JSON.stringify(data);
    try {
      await this.cacheFile.save(stringifiedCache, {
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
