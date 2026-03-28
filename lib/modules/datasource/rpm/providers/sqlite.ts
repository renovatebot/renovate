import upath from 'upath';
import { sqlite } from '../../../../expose.ts';
import { logger } from '../../../../logger/index.ts';
import { withCache } from '../../../../util/cache/package/with-cache.ts';
import * as fs from '../../../../util/fs/index.ts';
import { toSha256 } from '../../../../util/hash.ts';
import type { Http } from '../../../../util/http/index.ts';
import type { ReleaseResult } from '../../types.ts';
import {
  buildReleaseResult,
  formatRpmVersion,
  getGunzippedBuffer,
} from './common.ts';

const cacheSubDir = 'rpm';

interface RpmSqlitePackageRow {
  release: string | null;
  version: string | null;
}

export class RpmSqliteMetadataProvider {
  private readonly http: Http;

  constructor(http: Http) {
    this.http = http;
  }

  private async _getExtractedPrimaryDbFile(
    primaryDbUrl: string,
  ): Promise<string> {
    const decompressedBuffer = await getGunzippedBuffer(
      this.http,
      primaryDbUrl,
    );
    const cacheDir = await fs.ensureCacheDir(cacheSubDir);
    const extractedFile = upath.join(
      cacheDir,
      `${toSha256(primaryDbUrl)}.sqlite`,
    );

    await fs.writeSystemFile(extractedFile, decompressedBuffer);

    return extractedFile;
  }

  private getExtractedPrimaryDbFile(primaryDbUrl: string): Promise<string> {
    return withCache(
      {
        namespace: 'datasource-rpm',
        key: `primary-db-file:${primaryDbUrl}`,
        ttlMinutes: 1440,
      },
      () => this._getExtractedPrimaryDbFile(primaryDbUrl),
    );
  }

  async getReleases(
    primaryDbUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    const extractedFile = await this.getExtractedPrimaryDbFile(primaryDbUrl);
    const Sqlite = await sqlite();
    let db: InstanceType<typeof Sqlite> | undefined;

    try {
      db = new Sqlite(extractedFile, {
        fileMustExist: true,
        readonly: true,
      });

      const rows = db
        .prepare('select version, release from packages where name = ?')
        .all(packageName) as RpmSqlitePackageRow[];

      const versions = new Set<string>();
      for (const row of rows) {
        const version = formatRpmVersion(row.version, row.release);
        if (version) {
          versions.add(version);
        }
      }

      const result = buildReleaseResult(versions);
      if (!result) {
        logger.trace(
          `No releases found for package ${packageName} in ${primaryDbUrl}`,
        );
      }

      return result;
    } finally {
      db?.close();
    }
  }
}
