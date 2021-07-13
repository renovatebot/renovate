import { ExternalHostError } from '../../types/errors/external-host-error';
import { cache } from '../../util/cache/package/decorator';
import { parse } from '../../util/html';
import { HttpError } from '../../util/http/types';
import { isVersion, id as rubyVersioningId } from '../../versioning/ruby';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export class RubyVersionDatasource extends Datasource {
  static readonly id = 'ruby-version';

  constructor() {
    super(RubyVersionDatasource.id);
  }

  readonly defaultRegistryUrls = ['https://www.ruby-lang.org/'];

  readonly customRegistrySupport = false;

  readonly defaultVersioning = rubyVersioningId;

  @cache({ namespace: `datasource-${RubyVersionDatasource.id}`, key: 'all' })
  async getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const res: ReleaseResult = {
      homepage: 'https://www.ruby-lang.org',
      sourceUrl: 'https://github.com/ruby/ruby',
      releases: [],
    };
    const rubyVersionsUrl = `${registryUrl}en/downloads/releases/`;
    try {
      const response = await this.http.get(rubyVersionsUrl);

      const root = parse(response.body);
      const rows = root.querySelector('.release-list').querySelectorAll('tr');
      rows.forEach((row) => {
        const tds = row.querySelectorAll('td');
        const columns: string[] = [];
        tds.forEach((td) => columns.push(td.innerHTML));
        if (columns.length) {
          const version = columns[0].replace('Ruby ', '');
          if (isVersion(version)) {
            const releaseTimestamp = columns[1];
            const changelogUrl = columns[2]
              .replace('<a href="', 'https://www.ruby-lang.org')
              .replace('">more...</a>', '');
            res.releases.push({ version, releaseTimestamp, changelogUrl });
          }
        }
      });
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return res;
  }

  // eslint-disable-next-line class-methods-use-this
  override handleSpecificErrors(err: HttpError): never | void {
    throw new ExternalHostError(err);
  }
}
