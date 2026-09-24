import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import type { NonEmptyArray } from '../../../types/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { parse } from '../../../util/html.ts';
import type { HttpError } from '../../../util/http/index.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import {
  isVersion,
  id as rubyVersioningId,
} from '../../versioning/ruby/index.ts';
import { RegistryDatasource } from '../datasource.ts';
import type { RegistryGetReleasesConfig, ReleaseResult } from '../types.ts';

export class RubyVersionDatasource extends RegistryDatasource {
  static readonly id = 'ruby-version';

  constructor() {
    super(RubyVersionDatasource.id);
  }

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return ['https://www.ruby-lang.org/'];
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  override readonly defaultVersioning = rubyVersioningId;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `release-list` table in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'We use the URL: https://github.com/ruby/ruby.';

  private async fetchReleases({
    registryUrl,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    const res: ReleaseResult = {
      homepage: 'https://www.ruby-lang.org',
      sourceUrl: 'https://github.com/ruby/ruby',
      releases: [],
    };
    const rubyVersionsUrl = `${registryUrl}en/downloads/releases/`;
    try {
      const response = await this.http.getText(rubyVersionsUrl);

      const root = parse(response.body);
      const rows = coerceArray(
        root.querySelector('.release-list')?.querySelectorAll('tr'),
      );
      rows.forEach((row) => {
        const tds = row.querySelectorAll('td');
        const columns: string[] = [];
        tds.forEach((td) => columns.push(td.innerHTML));
        if (columns.length) {
          const version = columns[0].replace('Ruby ', '');
          if (isVersion(version)) {
            const releaseTimestamp = asTimestamp(columns[1]);
            const changelogUrl = columns[2]
              .replace('<a href="', 'https://www.ruby-lang.org')
              .replace('">more...</a>', '');
            res.releases.push({ version, releaseTimestamp, changelogUrl });
          }
        }
      });
      if (!res.releases.length) {
        logger.warn({ registryUrl }, 'Missing ruby releases');
        return null;
      }
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return res;
  }

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: 'all',
        cacheable: true,
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }

  override handleHttpErrors(err: HttpError): never | void {
    throw new ExternalHostError(err);
  }
}
