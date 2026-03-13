import { logger } from '../../../../logger/index.ts';
import type { Http } from '../../../../util/http/index.ts';
import type { ReleaseResult } from '../../types.ts';
import {
  buildReleaseResult,
  formatRpmVersion,
  getCachedGunzippedFile,
} from './common.ts';

interface RpmSqlitePackageRow {
  release: string | null;
  version: string | null;
}

export class RpmSqliteMetadataProvider {
  readonly metadataType = 'primary_db' as const;

  private readonly http: Http;

  constructor(http: Http) {
    this.http = http;
  }

  async getReleases(
    primaryDbUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    const extractedFile = await getCachedGunzippedFile(
      this.http,
      primaryDbUrl,
      'sqlite',
    );
    const { DatabaseSync: Sqlite } = await import('node:sqlite');
    const db = new Sqlite(extractedFile, {
      readOnly: true,
    });

    try {
      const rows = db
        .prepare('select version, release from packages where name = ?')
        .iterate(packageName) as Iterable<RpmSqlitePackageRow>;

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
      db.close();
    }
  }
}
