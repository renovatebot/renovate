import { cache } from '../../../util/cache/package/decorator';
import { asTimestamp } from '../../../util/timestamp';
import * as rustToolchainNightly from '../../versioning/rust-toolchain-nightly';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

export class RustNightlyDatasource extends Datasource {
  static readonly id = 'rust-nightly';

  constructor() {
    super(RustNightlyDatasource.id);
  }

  override readonly defaultRegistryUrls = [
    'https://rust-lang.github.io/rustup-components-history/',
  ];

  override readonly defaultVersioning = rustToolchainNightly.id;

  override readonly customRegistrySupport = false;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the date in the version.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'We use the URL: https://github.com/rust-lang/rust.';

  @cache({
    namespace: `datasource-${RustNightlyDatasource.id}`,
    key: ({ registryUrl }: GetReleasesConfig) => `${registryUrl}`,
    ttlMinutes: 60,
  })
  async getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const url = `${registryUrl}x86_64-unknown-linux-gnu/rust.json`;

    let releases: Release[];
    try {
      const response =
        await this.http.getJsonUnchecked<Record<string, boolean | string>>(url);
      const data = response.body;

      releases = Object.keys(data)
        .filter((key) => key !== 'last_available' && data[key] === true)
        .map((date) => {
          const version = `nightly-${date}`;
          const releaseTimestamp = asTimestamp(date);
          return { version, releaseTimestamp };
        });
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const res: ReleaseResult = {
      releases,
      sourceUrl: 'https://github.com/rust-lang/rust',
    };
    if (res.releases.length) {
      return res;
    }
    return null;
  }
}
